(ns metabase.query-knowledge.models.query-knowledge
  (:require
   [methodical.core :as methodical]
   [metabase.models.interface :as mi]
   [toucan2.core :as t2]))

(methodical/defmethod t2/table-name :model/QueryKnowledge [_model] :query_knowledge)

(doto :model/QueryKnowledge
  (derive :metabase/model)
  (derive :hook/timestamped?))

(t2/deftransforms :model/QueryKnowledge
  {:body mi/transform-json})
