(ns metabase.query-knowledge.embed
  "OpenAI-compatible embeddings client for query knowledge indexing/retrieval."
  (:require
   [clj-http.client :as http]
   [clojure.string :as str]
   [metabase.query-knowledge.settings :as qk.settings]
   [metabase.util.json :as json]
   [metabase.util.log :as log]))

(def ^:private batch-size 16)
(def ^:private timeout-ms (* 3 60 1000))

(defn embedding-configured?
  "True when base URL and model are set."
  []
  (boolean
   (and (not (str/blank? (qk.settings/query-knowledge-embedding-base-url)))
        (not (str/blank? (qk.settings/query-knowledge-embedding-model))))))

(defn embedding-identity
  "Stable identity string for the configured embedding endpoint+model, or empty when unconfigured."
  []
  (if-not (embedding-configured?)
    ""
    (str (str/replace (qk.settings/query-knowledge-embedding-base-url) #"/+$" "")
         "|"
         (qk.settings/query-knowledge-embedding-model))))

(defn- embeddings-url []
  (let [base (str/replace (qk.settings/query-knowledge-embedding-base-url) #"/+$" "")]
    (str base "/embeddings")))

(defn- post-embeddings! [inputs]
  (let [api-key (qk.settings/query-knowledge-embedding-api-key)
        headers (cond-> {"Content-Type" "application/json"}
                  (not (str/blank? api-key)) (assoc "Authorization" (str "Bearer " api-key)))
        body    {:model (qk.settings/query-knowledge-embedding-model)
                 :input inputs}
        resp    (http/post (embeddings-url)
                           {:headers         headers
                            :body            (json/encode body)
                            :as              :json
                            :socket-timeout  timeout-ms
                            :conn-timeout    15000
                            :throw-exceptions false})]
    (when-not (<= 200 (:status resp) 299)
      (throw (ex-info (format "Embedding API returned HTTP %s" (:status resp))
                      {:status (:status resp)
                       :body   (:body resp)})))
    (let [data (get-in resp [:body :data])]
      (when (not= (count data) (count inputs))
        (throw (ex-info "Embedding response count mismatch"
                        {:expected (count inputs) :got (count data)})))
      ;; Preserve order by :index when present
      (->> data
           (sort-by #(or (:index %) 0))
           (mapv :embedding)))))

(defn embed!
  "Embed `texts` via the configured OpenAI-compatible endpoint. Returns a vector of float vectors.
   Throws when embedding is not configured or the API fails."
  [texts]
  (when-not (embedding-configured?)
    (throw (ex-info "Embedding is not configured" {:type ::not-configured})))
  (when (seq texts)
    (try
      (into []
            (mapcat (fn [batch] (post-embeddings! batch)))
            (partition-all batch-size texts))
      (catch Exception e
        (log/warnf e "Query knowledge embedding failed")
        (throw e)))))
