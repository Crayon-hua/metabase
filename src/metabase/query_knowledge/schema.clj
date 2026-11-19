(ns metabase.query-knowledge.schema
  "Malli schemas for query knowledge."
  (:require
   [metabase.lib.schema.id :as lib.schema.id]
   [metabase.util.malli.registry :as mr]
   [metabase.util.malli.schema :as ms]))

(mr/def ::alias
  [:map {:closed true}
   [:table       :string]
   [:column      {:optional true} [:maybe :string]]
   [:name        :string]
   [:synonyms    {:optional true} [:maybe [:sequential :string]]]
   [:description {:optional true} [:maybe :string]]])

(mr/def ::term
  [:map {:closed true}
   [:name        :string]
   [:synonyms    {:optional true} [:maybe [:sequential :string]]]
   [:description :string]])

(mr/def ::relation
  [:map {:closed true}
   [:table        :string]
   [:column       :string]
   [:targetTable  :string]
   [:targetColumn :string]
   [:constraint   {:optional true} [:maybe :string]]])

(mr/def ::body
  [:map {:closed true}
   [:aliases   {:optional true} [:maybe [:sequential ::alias]]]
   [:terms     {:optional true} [:maybe [:sequential ::term]]]
   [:relations {:optional true} [:maybe [:sequential ::relation]]]])

(mr/def ::query-knowledge.update
  [:map {:closed true}
   [:database_id     {:optional true} [:maybe ::lib.schema.id/database]]
   [:revision        {:optional true} [:maybe ms/PositiveInt]]
   [:body            {:optional true} [:maybe ::body]]
   [:embedding_model {:optional true} [:maybe :string]]
   [:created_at      {:optional true} [:maybe ms/TemporalInstant]]
   [:updated_at      {:optional true} [:maybe ms/TemporalInstant]]])

(mr/def ::query-knowledge
  [:merge
   ::query-knowledge.update
   [:map {:closed true}
    [:id ms/PositiveInt]]])

(mr/def ::query-knowledge-document.update
  [:map {:closed true}
   [:database_id     {:optional true} [:maybe ::lib.schema.id/database]]
   [:kind            {:optional true} [:maybe :string]]
   [:position        {:optional true} [:maybe :int]]
   [:text            {:optional true} [:maybe :string]]
   [:embedding       {:optional true} [:maybe :string]]
   [:embedding_model {:optional true} [:maybe :string]]
   [:revision        {:optional true} [:maybe :int]]
   [:created_at      {:optional true} [:maybe ms/TemporalInstant]]])

(mr/def ::query-knowledge-document
  [:merge
   ::query-knowledge-document.update
   [:map {:closed true}
    [:id ms/PositiveInt]]])
