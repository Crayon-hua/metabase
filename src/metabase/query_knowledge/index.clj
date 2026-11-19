(ns metabase.query-knowledge.index
  "Build embedding documents from metadata + knowledge and persist them."
  (:require
   [clojure.string :as str]
   [metabase.query-knowledge.db :as qk.db]
   [metabase.query-knowledge.embed :as qk.embed]
   [metabase.query-knowledge.metadata :as qk.metadata]
   [metabase.util.json :as json]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]))

(defn- truncate [s n]
  (let [chars (vec s)]
    (if (<= (count chars) n)
      s
      (apply str (subvec chars 0 n)))))

(defn- aliases-by-table [aliases]
  (group-by :table aliases))

(defn build-documents
  "Build indexable documents from catalog tables and knowledge body."
  [tables body]
  (let [aliases (aliases-by-table (or (:aliases body) []))
        table-docs
        (map-indexed
         (fn [i table]
           (let [sb (StringBuilder.)]
             (.append sb (str (:name table) " " (or (:comment table) "")))
             (doseq [col (:columns table)]
               (.append sb (str "\n" (:name col) " " (:type col) " " (or (:comment col) ""))))
             (doseq [a (get aliases (:name table) [])]
               (.append sb (str "\n" (or (:column a) "") " " (:name a) " "
                                (str/join " " (or (:synonyms a) [])) " "
                                (or (:description a) ""))))
             {:kind "table" :position i :text (truncate (str sb) 6000)}))
         tables)
        term-docs
        (map-indexed
         (fn [i term]
           {:kind "term"
            :position i
            :text (str (:name term) " "
                       (str/join " " (or (:synonyms term) [])) " "
                       (or (:description term) ""))})
         (or (:terms body) []))]
    (into (vec table-docs) term-docs)))

(mu/defn reindex!
  "Rebuild vector documents for `database-id` from current metadata + knowledge.
   Returns {:document_count n :embedding_model id} or {:skipped true :reason …}."
  [database-id :- ms/PositiveInt]
  (let [row   (qk.db/by-database-id database-id)
        body  (or (:body row) qk.db/empty-body)
        rev   (or (:revision row) 0)
        ident (qk.embed/embedding-identity)]
    (cond
      (str/blank? ident)
      {:skipped true :reason "embedding-not-configured" :document_count 0}

      :else
      (let [tables (qk.metadata/catalog-tables database-id)
            docs   (build-documents tables body)]
        (if (empty? docs)
          (do
            (qk.db/delete-documents! database-id)
            (qk.db/set-embedding-model! database-id ident)
            {:document_count 0 :embedding_model ident :revision rev})
          (let [vectors (qk.embed/embed! (mapv :text docs))
                rows    (mapv (fn [doc vec]
                                {:database_id     database-id
                                 :kind            (:kind doc)
                                 :position        (:position doc)
                                 :text            (:text doc)
                                 :embedding       (json/encode vec)
                                 :embedding_model ident
                                 :revision        rev})
                              docs
                              vectors)]
            (qk.db/delete-documents! database-id)
            (qk.db/insert-documents! rows)
            (qk.db/set-embedding-model! database-id ident)
            {:document_count (count rows)
             :embedding_model ident
             :revision rev}))))))
