(ns metabase.query-knowledge.core
  "Public API for query knowledge: get/save/reindex/retrieve."
  (:require
   [metabase.query-knowledge.db :as qk.db]
   [metabase.query-knowledge.embed :as qk.embed]
   [metabase.query-knowledge.index :as qk.index]
   [metabase.query-knowledge.metadata :as qk.metadata]
   [metabase.query-knowledge.retrieve :as qk.retrieve]
   [metabase.query-knowledge.schema :as qk.schema]
   [metabase.query-knowledge.settings :as qk.settings]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]))

(defn- normalize-body [body]
  {:aliases   (mapv (fn [a]
                      {:table       (or (:table a) "")
                       :column      (or (:column a) "")
                       :name        (or (:name a) "")
                       :synonyms    (vec (or (:synonyms a) []))
                       :description (or (:description a) "")})
                    (or (:aliases body) []))
   :terms     (mapv (fn [t]
                      {:name        (or (:name t) "")
                       :synonyms    (vec (or (:synonyms t) []))
                       :description (or (:description t) "")})
                    (or (:terms body) []))
   :relations (mapv (fn [r]
                      (cond-> {:table        (or (:table r) "")
                               :column       (or (:column r) "")
                               :targetTable  (or (:targetTable r) "")
                               :targetColumn (or (:targetColumn r) "")}
                        (:constraint r) (assoc :constraint (:constraint r))))
                    (or (:relations body) []))})

(defn embedding-settings
  "Public (non-secret) embedding settings snapshot for Admin UI."
  []
  {:base_url          (or (qk.settings/query-knowledge-embedding-base-url) "")
   :model             (or (qk.settings/query-knowledge-embedding-model) "")
   :api_key_configured (boolean (not-empty (qk.settings/query-knowledge-embedding-api-key)))
   :configured        (qk.embed/embedding-configured?)})

(mu/defn get-knowledge
  "Knowledge + tables + index status for Admin UI / MCP."
  [database-id :- ms/PositiveInt]
  (when-not (qk.metadata/database-exists? database-id)
    (throw (ex-info "Database not found" {:status-code 404 :database-id database-id})))
  (let [row    (qk.db/by-database-id database-id)
        body   (normalize-body (or (:body row) qk.db/empty-body))
        tables (qk.metadata/catalog-tables database-id)
        rev    (or (:revision row) 0)
        docs   (qk.db/document-count database-id)
        ident  (qk.embed/embedding-identity)]
    {:database_id     database-id
     :revision        rev
     :knowledge       body
     :tables          tables
     :embedding_model (or (:embedding_model row) "")
     :index           {:document_count docs
                       :ready          (and (pos? docs)
                                            (not-empty ident)
                                            (= ident (or (:embedding_model row) "")))
                       :configured     (qk.embed/embedding-configured?)}
     :embedding       (embedding-settings)}))

(mu/defn save-knowledge!
  "Save knowledge body with optimistic locking. Optionally reindex when embedding is configured.
   Returns the same shape as [[get-knowledge]]."
  [database-id       :- ms/PositiveInt
   expected-revision :- [:maybe :int]
   body              :- ::qk.schema/body
   {:keys [reindex?]} :- [:map [:reindex? {:optional true} :boolean]]]
  (when-not (qk.metadata/database-exists? database-id)
    (throw (ex-info "Database not found" {:status-code 404 :database-id database-id})))
  (let [normalized (normalize-body body)
        ident      (or (qk.embed/embedding-identity) "")
        saved      (qk.db/upsert! database-id (or expected-revision 0) normalized ident)]
    (when-not saved
      (throw (ex-info "配置已更新，请重新加载后再保存"
                      {:status-code 409 :database-id database-id})))
    (when (and reindex? (qk.embed/embedding-configured?))
      (try
        (qk.index/reindex! database-id)
        (catch Exception e
          ;; Knowledge is saved; surface index failure as soft warning on next get
          (throw (ex-info (str "知识已保存，但重建索引失败：" (ex-message e))
                          {:status-code 502 :cause e})))))
    (get-knowledge database-id)))

(mu/defn reindex-knowledge!
  "Rebuild vector index for `database-id`."
  [database-id :- ms/PositiveInt]
  (when-not (qk.metadata/database-exists? database-id)
    (throw (ex-info "Database not found" {:status-code 404 :database-id database-id})))
  (let [result (qk.index/reindex! database-id)]
    (assoc (get-knowledge database-id) :reindex result)))

(mu/defn retrieve
  "Retrieve hybrid evidence for a natural-language question."
  [database-id :- ms/PositiveInt
   question    :- ms/NonBlankString]
  (when-not (qk.metadata/database-exists? database-id)
    (throw (ex-info "Database not found" {:status-code 404 :database-id database-id})))
  (qk.retrieve/retrieve-evidence database-id question))
