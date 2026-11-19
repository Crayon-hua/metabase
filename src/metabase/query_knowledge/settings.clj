(ns metabase.query-knowledge.settings
  "Embedding settings for query-knowledge semantic retrieval (OpenAI-compatible embeddings only)."
  (:require
   [metabase.settings.core :as setting :refer [defsetting]]
   [metabase.util.i18n :refer [deferred-tru]]))

(defsetting query-knowledge-embedding-base-url
  (deferred-tru "OpenAI-compatible embeddings API base URL (e.g. https://api.openai.com/v1).")
  :encryption :when-encryption-key-set
  :visibility :settings-manager
  :default    ""
  :export?    false
  :audit      :getter)

(defsetting query-knowledge-embedding-model
  (deferred-tru "Embedding model name used to index and retrieve query knowledge.")
  :encryption :no
  :visibility :settings-manager
  :default    ""
  :export?    false
  :audit      :getter)

(defsetting query-knowledge-embedding-api-key
  (deferred-tru "API key for the embeddings endpoint used by query knowledge retrieval.")
  :sensitive? true
  :encryption :when-encryption-key-set
  :visibility :settings-manager
  :default    ""
  :export?    false
  :audit      :no-value)
