(ns metabase.mcp.v2.tools.query-knowledge
  "MCP tools for query knowledge: get/save knowledge and hybrid evidence retrieve (no SQL generation)."
  (:require
   [metabase.api.common :as api]
   [metabase.mcp.v2.common :as common]
   [metabase.mcp.v2.message :as message]
   [metabase.mcp.v2.registry :as registry]
   [metabase.metabot.scope :as metabot.scope]
   [metabase.query-knowledge.core :as qk.core]
   [metabase.util.malli.schema :as ms]))

(set! *warn-on-reflection* true)

(defn- knowledge-payload [state]
  {:database_id (:database_id state)
   :revision    (:revision state)
   :aliases     (get-in state [:knowledge :aliases])
   :terms       (get-in state [:knowledge :terms])
   :relations   (get-in state [:knowledge :relations])
   :index       (:index state)})

(registry/deftool get-query-knowledge
  "Return business query knowledge (aliases, terms, relations) configured for a Metabase database_id. Use before retrieve_query_evidence when you need the full configured vocabulary; for a specific question prefer retrieve_query_evidence which returns the relevant subset plus tables."
  {:name           "get_query_knowledge"
   :default-access :allowed
   :scope          metabot.scope/agent-content-read
   :annotations    {:readOnlyHint true :idempotentHint true}
   :args           [:map {:closed true}
                    [:database_id ms/PositiveInt]]}
  [{:keys [database_id]} _context]
  (try
    (common/success-content (knowledge-payload (qk.core/get-knowledge database_id)))
    (catch clojure.lang.ExceptionInfo e
      (if (= 404 (:status-code (ex-data e)))
        (common/throw-teaching-error
         (message/msg ["No Metabase database with id %s."] database_id))
        (throw e)))))

(registry/deftool save-query-knowledge
  "Save business query knowledge (aliases, terms, relations) for a Metabase database_id. Pass the revision from get_query_knowledge for optimistic locking. Does not generate SQL."
  {:name           "save_query_knowledge"
   :default-access :denied
   :scope          metabot.scope/agent-content-write
   :annotations    {:readOnlyHint false :idempotentHint false}
   :args           [:map {:closed true}
                    [:database_id ms/PositiveInt]
                    [:revision {:optional true} [:maybe :int]]
                    [:aliases {:optional true} [:maybe [:sequential :map]]]
                    [:terms {:optional true} [:maybe [:sequential :map]]]
                    [:relations {:optional true} [:maybe [:sequential :map]]]
                    [:reindex {:optional true} [:maybe :boolean]]]}
  [{:keys [database_id revision aliases terms relations reindex]} _context]
  ;; Writes require an admin session user in practice; MCP tokens are still scoped.
  (when-not api/*is-superuser?*
    (common/throw-teaching-error
     (message/msg ["Saving query knowledge requires an admin user."])))
  (try
    (let [state (qk.core/save-knowledge! database_id
                                         (or revision 0)
                                         {:aliases   (or aliases [])
                                          :terms     (or terms [])
                                          :relations (or relations [])}
                                         {:reindex? (boolean reindex)})]
      (common/success-content (knowledge-payload state)))
    (catch clojure.lang.ExceptionInfo e
      (let [{:keys [status-code]} (ex-data e)]
        (case status-code
          404 (common/throw-teaching-error
               (message/msg ["No Metabase database with id %s."] database_id))
          409 (common/throw-teaching-error
               (message/msg ["Knowledge was updated elsewhere; call get_query_knowledge and retry."]))
          (throw e))))))

(registry/deftool retrieve-query-evidence
  "Retrieve schema and business evidence for a natural-language analytics question against a Metabase database_id: relevant tables (with columns), aliases, business terms, and relations. Uses hybrid keyword + vector retrieval when embeddings are configured; otherwise keywords only. Does NOT generate SQL — use this evidence with browse_data / execute_sql as needed."
  {:name           "retrieve_query_evidence"
   :default-access :allowed
   :scope          metabot.scope/agent-content-read
   :annotations    {:readOnlyHint true :idempotentHint true}
   :args           [:map {:closed true}
                    [:database_id ms/PositiveInt]
                    [:question [:string {:min 1 :description "The user's analytics question in natural language."}]]]}
  [{:keys [database_id question]} _context]
  (try
    (let [{:keys [evidence warning error]} (qk.core/retrieve database_id question)]
      (if (= "no-tables" error)
        (common/throw-teaching-error
         (message/msg [(or warning "未找到相关表，请补充业务名称或配置表字段同义词")]))
        (common/success-content
         (cond-> evidence
           warning (assoc :warning warning)))))
    (catch clojure.lang.ExceptionInfo e
      (if (= 404 (:status-code (ex-data e)))
        (common/throw-teaching-error
         (message/msg ["No Metabase database with id %s."] database_id))
        (throw e)))))
