(ns metabase.external-agent.client
  "HTTP client for Agent platform iframe-token minting (same contract as marketing research client)."
  (:require
   [clj-http.client :as http]
   [clojure.string :as str]
   [metabase.external-agent.settings :as ea.settings]
   [metabase.util.json :as json]
   [metabase.util.log :as log]))

(defn configured?
  "True when API base, API key, UI origin, and agent id are present."
  []
  (boolean
   (and (not (str/blank? (ea.settings/external-agent-api-base)))
        (not (str/blank? (ea.settings/external-agent-api-key)))
        (not (str/blank? (ea.settings/external-agent-ui-origin)))
        (not (str/blank? (ea.settings/external-agent-id))))))

(defn public-config
  "Non-secret iframe mount info for the Metabase sidebar."
  []
  {:enabled   (configured?)
   :ui_origin (str/replace (or (ea.settings/external-agent-ui-origin) "") #"/+$" "")
   :ui_base   (let [base (str/trim (or (ea.settings/external-agent-ui-base) ""))]
                (cond
                  (str/blank? base) ""
                  (str/starts-with? base "/") (str/replace base #"/+$" "")
                  :else (str "/" (str/replace base #"/+$" ""))))
   :agent_id  (or (ea.settings/external-agent-id) "")})

(defn- api-url [path]
  (str (str/replace (ea.settings/external-agent-api-base) #"/+$" "") path))

(defn issue-iframe-token!
  "POST /auth/iframe-tokens with X-API-Key. Returns {:token :expires_in}."
  []
  (when-not (configured?)
    (throw (ex-info "External Agent iframe SSO is not configured"
                    {:status-code 503 :type ::not-configured})))
  (let [resp (http/post (api-url "/auth/iframe-tokens")
                        {:headers         {"Accept"       "application/json"
                                           "X-API-Key"    (ea.settings/external-agent-api-key)
                                           "Content-Type" "application/json"}
                         :body            "{}"
                         :as              :json
                         :socket-timeout  15000
                         :conn-timeout    10000
                         :throw-exceptions false})
        status (:status resp)
        body   (:body resp)]
    (when-not (= 200 status)
      (log/warnf "Agent iframe-token HTTP %s body=%s" status body)
      (throw (ex-info (format "Agent platform returned HTTP %s" status)
                      {:status-code 502 :upstream status})))
    ;; Platform envelope: {code, message, data:{token, expiresIn}}
    (let [code (or (:code body) 0)
          data (or (:data body) body)
          token (or (:token data) (:Token data))
          expires (or (:expiresIn data) (:expires_in data) 0)]
      (when-not (and (or (nil? code) (zero? code)) (not (str/blank? token)))
        (throw (ex-info (or (:message body) "Failed to mint iframe token")
                        {:status-code 502 :body body})))
      {:token      token
       :expires_in (long expires)})))
