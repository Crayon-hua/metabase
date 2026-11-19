(ns metabase.query-knowledge.metadata
  "Load Metabase-synced Database/Table/Field metadata as catalog tables for retrieve/index."
  (:require
   [clojure.string :as str]
   [metabase.util.malli :as mu]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(defn- field->column [field]
  (cond-> {:name (or (:name field) "")
           :type (name (or (:base_type field) :type/*))}
    (not (str/blank? (:description field)))
    (assoc :comment (:description field))
    (:semantic_type field)
    (assoc :primary (= :type/PK (:semantic_type field)))))

(defn- fk-relations
  "Logical FK edges from fields that have fk_target_field_id, expressed as relation maps."
  [fields id->field id->table]
  (into []
        (comp
         (filter :fk_target_field_id)
         (keep (fn [field]
                 (when-let [target (id->field (:fk_target_field_id field))]
                   (when-let [src-table (id->table (:table_id field))]
                     (when-let [tgt-table (id->table (:table_id target))]
                       {:table        (:name src-table)
                        :column       (:name field)
                        :targetTable  (:name tgt-table)
                        :targetColumn (:name target)}))))))
        fields))

(mu/defn catalog-tables
  "Active tables with fields for `database-id`, shaped like sql-agent Table maps."
  [database-id :- ms/PositiveInt]
  (let [tables (t2/select :model/Table
                          :db_id database-id
                          :active true
                          {:order-by [[:%lower.name :asc]]})
        table-ids (mapv :id tables)
        fields (if (seq table-ids)
                 (t2/select :model/Field
                            :table_id [:in table-ids]
                            :active true
                            {:order-by [[:position :asc] [:%lower.name :asc]]})
                 [])
        id->table (into {} (map (juxt :id identity) tables))
        id->field (into {} (map (juxt :id identity) fields))
        fields-by-table (group-by :table_id fields)
        relations-by-table (->> (fk-relations fields id->field id->table)
                                (group-by :table))]
    (mapv (fn [table]
            (let [cols (mapv field->column (get fields-by-table (:id table) []))
                  rels (get relations-by-table (:name table) [])]
              (cond-> {:name    (:name table)
                       :columns cols}
                (not (str/blank? (:description table)))
                (assoc :comment (:description table))
                (seq rels)
                (assoc :relations rels))))
          tables)))

(mu/defn database-exists? :- :boolean
  [database-id :- ms/PositiveInt]
  (t2/exists? :model/Database :id database-id))
