(ns metabase.external-agent.api
  "REST API for Metabase ↔ Whaee Agent iframe SSO (marketing-style)."
  (:require
   [metabase.api.common :as api]
   [metabase.api.macros :as api.macros]
   [metabase.external-agent.client :as ea.client]
   [metabase.external-agent.settings :as ea.settings]))

(def keep-me :keep-me)

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :get "/config"
  "Public (non-secret) Agent iframe mount config for the sidebar."
  [_route-params _query-params]
  ;; Route is behind +auth; any signed-in user can open the sidebar chatbox.
  (ea.client/public-config))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :post "/iframe-token"
  "Mint a short-lived Agent iframe token via the shared platform API key."
  [_route-params _query-params]
  (ea.client/issue-iframe-token!))
#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :get "/settings"
  "Admin view of external-agent settings (api key masked)."
  [_route-params _query-params]
  (api/check-superuser)
  (merge (ea.client/public-config)
         {:api_base          (or (ea.settings/external-agent-api-base) "")
          :api_key_configured (boolean (not-empty (ea.settings/external-agent-api-key)))}))

#_{:clj-kondo/ignore [:metabase/validate-defendpoint-has-response-schema]}
(api.macros/defendpoint :put "/settings"
  "Update external-agent SSO settings (superuser)."
  [_route-params
   _query-params
   body :- [:map {:closed true}
            [:api_base  {:optional true} [:maybe :string]]
            [:ui_origin {:optional true} [:maybe :string]]
            [:ui_base   {:optional true} [:maybe :string]]
            [:api_key   {:optional true} [:maybe :string]]
            [:agent_id  {:optional true} [:maybe :string]]]]
  (api/check-superuser)
  (when (contains? body :api_base)
    (ea.settings/external-agent-api-base! (or (:api_base body) "")))
  (when (contains? body :ui_origin)
    (ea.settings/external-agent-ui-origin! (or (:ui_origin body) "")))
  (when (contains? body :ui_base)
    (ea.settings/external-agent-ui-base! (or (:ui_base body) "")))
  (when (contains? body :agent_id)
    (ea.settings/external-agent-id! (or (:agent_id body) "")))
  (when (and (contains? body :api_key)
             (not= (:api_key body) "********")
             (some? (:api_key body)))
    (ea.settings/external-agent-api-key! (:api_key body)))
  (merge (ea.client/public-config)
         {:api_base           (or (ea.settings/external-agent-api-base) "")
          :api_key_configured (boolean (not-empty (ea.settings/external-agent-api-key)))}))
