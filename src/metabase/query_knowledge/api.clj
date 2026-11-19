(ns metabase.query-knowledge.api
  "REST API for Admin「知识配置」."
  (:require
   [metabase.api.common :as api]
   [metabase.api.macros :as api.macros]
   [metabase.query-knowledge.core :as qk.core]
   [metabase.query-knowledge.settings :as qk.settings]
   [metabase.util.malli.schema :as ms]))

(defn- check-admin! []
  (api/check-superuser))

;; Static paths must be declared before /:database-id so they are not captured as ids.

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :get "/embedding-settings"
  "Embedding settings for the knowledge config page."
  [_route-params _query-params]
  (check-admin!)
  (qk.core/embedding-settings))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :put "/embedding-settings"
  "Update embedding settings (OpenAI-compatible)."
  [_route-params
   _query-params
   body :- [:map {:closed true}
            [:base_url {:optional true} [:maybe :string]]
            [:model    {:optional true} [:maybe :string]]
            [:api_key  {:optional true} [:maybe :string]]]]
  (check-admin!)
  (when (contains? body :base_url)
    (qk.settings/query-knowledge-embedding-base-url! (or (:base_url body) "")))
  (when (contains? body :model)
    (qk.settings/query-knowledge-embedding-model! (or (:model body) "")))
  (when (and (contains? body :api_key)
             (not= (:api_key body) "********")
             (some? (:api_key body)))
    (qk.settings/query-knowledge-embedding-api-key! (:api_key body)))
  (qk.core/embedding-settings))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :get "/:database-id"
  "Fetch query knowledge, tables, and index status for a database."
  [{:keys [database-id]} :- [:map [:database-id ms/PositiveInt]]]
  (check-admin!)
  (qk.core/get-knowledge database-id))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :put "/:database-id"
  "Save query knowledge (optimistic lock via revision). Optional reindex."
  [{:keys [database-id]} :- [:map [:database-id ms/PositiveInt]]
   _query-params
   body :- [:map {:closed true}
            [:revision {:optional true} [:maybe :int]]
            [:knowledge [:map {:closed true}
                         [:aliases   {:optional true} [:maybe [:sequential :map]]]
                         [:terms     {:optional true} [:maybe [:sequential :map]]]
                         [:relations {:optional true} [:maybe [:sequential :map]]]]]
            [:reindex  {:optional true} [:maybe :boolean]]]]
  (check-admin!)
  (qk.core/save-knowledge! database-id
                           (:revision body)
                           (:knowledge body)
                           {:reindex? (boolean (:reindex body))}))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :post "/:database-id/reindex"
  "Rebuild embedding documents for a database."
  [{:keys [database-id]} :- [:map [:database-id ms/PositiveInt]]]
  (check-admin!)
  (qk.core/reindex-knowledge! database-id))
