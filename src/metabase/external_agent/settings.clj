(ns metabase.external-agent.settings
  "Whaee Agent iframe SSO settings (marketing-style chatbox + short token)."
  (:require
   [metabase.settings.core :as setting :refer [defsetting]]
   [metabase.util.i18n :refer [deferred-tru]]))

(defsetting external-agent-api-base
  (deferred-tru "Agent platform API base URL used to mint iframe tokens (e.g. https://agent.whaee.com/api/v1).")
  :encryption :no
  :visibility :settings-manager
  :default    ""
  :export?    false
  :audit      :getter)

(defsetting external-agent-ui-origin
  (deferred-tru "Agent platform UI origin for iframe src and postMessage checks (e.g. https://agent.whaee.com).")
  :encryption :no
  :visibility :authenticated
  :default    "https://agent.whaee.com"
  :export?    false
  :audit      :getter)

(defsetting external-agent-ui-base
  (deferred-tru "Optional path prefix for the Agent UI deployment (empty when served at domain root).")
  :encryption :no
  :visibility :authenticated
  :default    ""
  :export?    false
  :audit      :getter)

(defsetting external-agent-api-key
  (deferred-tru "Shared X-API-Key for a dedicated Agent platform account that can create iframe tokens.")
  :sensitive? true
  :encryption :when-encryption-key-set
  :visibility :settings-manager
  :default    ""
  :export?    false
  :audit      :no-value)

(defsetting external-agent-id
  (deferred-tru "Default Agent ID (aid) opened in the Metabase sidebar chatbox.")
  :encryption :no
  :visibility :authenticated
  :default    ""
  :export?    false
  :audit      :getter)
