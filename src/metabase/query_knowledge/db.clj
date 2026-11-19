(ns metabase.query-knowledge.db
  "App-DB accessors for query knowledge and documents."
  (:require
   [metabase.query-knowledge.schema :as qk.schema]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(def empty-body
  "Default knowledge body."
  {:aliases [] :terms [] :relations []})

(mu/defn by-database-id :- [:maybe ::qk.schema/query-knowledge]
  "Knowledge row for `database-id`, or nil."
  [database-id :- ms/PositiveInt]
  (t2/select-one :model/QueryKnowledge :database_id database-id))

(mu/defn upsert!
  "Insert or update knowledge for `database-id` with optimistic locking on `expected-revision`.
   When `expected-revision` is 0/nil and no row exists, inserts revision 1.
   Returns the saved row, or nil on conflict."
  [database-id       :- ms/PositiveInt
   expected-revision :- [:maybe :int]
   body              :- ::qk.schema/body
   embedding-model   :- :string]
  (let [existing (by-database-id database-id)
        rev      (or expected-revision 0)]
    (cond
      (and (nil? existing) (zero? rev))
      (t2/insert-returning-instance! :model/QueryKnowledge
                                     {:database_id     database-id
                                      :revision        1
                                      :body            body
                                      :embedding_model embedding-model})

      (and existing (= (:revision existing) rev))
      (do
        (t2/update! :model/QueryKnowledge (:id existing)
                    {:revision        (inc rev)
                     :body            body
                     :embedding_model embedding-model})
        (by-database-id database-id))

      :else
      nil)))

(mu/defn delete-documents!
  "Delete all indexed documents for `database-id`."
  [database-id :- ms/PositiveInt]
  (t2/delete! :model/QueryKnowledgeDocument :database_id database-id))

(mu/defn insert-documents!
  "Bulk-insert document rows."
  [rows :- [:sequential ::qk.schema/query-knowledge-document.update]]
  (when (seq rows)
    (t2/insert! :model/QueryKnowledgeDocument rows)))

(mu/defn documents-for-database :- [:sequential ::qk.schema/query-knowledge-document]
  "All documents for `database-id` at `revision` (any revision when nil)."
  ([database-id :- ms/PositiveInt]
   (t2/select :model/QueryKnowledgeDocument :database_id database-id))
  ([database-id :- ms/PositiveInt
    revision    :- :int]
   (t2/select :model/QueryKnowledgeDocument :database_id database-id :revision revision)))

(mu/defn document-count :- :int
  "Number of indexed documents for `database-id`."
  [database-id :- ms/PositiveInt]
  (t2/count :model/QueryKnowledgeDocument :database_id database-id))

(mu/defn set-embedding-model!
  "Update embedding_model on the knowledge row without bumping revision."
  [database-id     :- ms/PositiveInt
   embedding-model :- :string]
  (when-let [existing (by-database-id database-id)]
    (t2/update! :model/QueryKnowledge (:id existing) {:embedding_model embedding-model})))
