(ns metabase.query-knowledge.models.query-knowledge-document
  (:require
   [methodical.core :as methodical]
   [toucan2.core :as t2]))

(methodical/defmethod t2/table-name :model/QueryKnowledgeDocument [_model] :query_knowledge_document)

(doto :model/QueryKnowledgeDocument
  (derive :metabase/model))
