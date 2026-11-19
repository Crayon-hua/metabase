(ns metabase.mcp.v2.tools.public-link
  "The v2 MCP `dashboard_public_link` tool: enable or disable a Dashboard's publicly-accessible
   link (the same `/public/dashboard/{uuid}` URL the REST `POST|DELETE /api/dashboard/:id/public_link`
   endpoints manage).

   Enabling is idempotent: a dashboard that already has a public UUID returns that link rather than
   minting a new one. Disabling is also idempotent: clearing a link that is already off succeeds.

   Permission mirrors REST: enabling requires a superuser; disabling requires the application
   `:setting` permission (superuser on OSS). Public sharing must be turned on site-wide
   (`enable-public-sharing`)."
  (:require
   [metabase.api.common :as api]
   [metabase.channel.urls :as channel.urls]
   [metabase.dashboards-rest.db :as dashboards-rest.db]
   [metabase.events.core :as events]
   [metabase.mcp.v2.common :as common]
   [metabase.mcp.v2.message :as message]
   [metabase.mcp.v2.registry :as registry]
   [metabase.mcp.v2.resolve :as v2.resolve]
   [metabase.mcp.v2.write :as v2.write]
   [metabase.metabot.scope :as metabot.scope]
   [metabase.permissions.core :as perms]
   [metabase.public-sharing.settings :as public-sharing.settings]
   [toucan2.core :as t2]))

(set! *warn-on-reflection* true)

(defn- check-public-sharing-enabled!
  "Site-wide public sharing must be on, else a teaching error naming the Admin setting."
  []
  (when-not (public-sharing.settings/enable-public-sharing)
    (common/throw-teaching-error
     (message/msg [(str "Public sharing is disabled on this Metabase. An admin must enable "
                         "\"Public sharing\" under Admin → Settings → Public sharing, then retry.")]))))

(defn- check-can-enable!
  "Same gate as `POST /api/dashboard/:id/public_link`."
  []
  (when-not api/*is-superuser?*
    (common/throw-teaching-error
     (message/msg ["Enabling a public dashboard link requires a Metabase admin (superuser)."]))))

(defn- check-can-disable!
  "Same gate as `DELETE /api/dashboard/:id/public_link`."
  []
  (try
    (perms/check-has-application-permission :setting)
    (catch clojure.lang.ExceptionInfo e
      (if (= 403 (:status-code (ex-data e)))
        (common/throw-teaching-error
         (message/msg ["Disabling a public dashboard link requires the Settings application permission (or a Metabase admin)."]))
        (throw e)))))

(defn- fetch-dashboard
  "Dashboard behind its read check, not archived."
  [id-or-eid]
  (api/check-not-archived (v2.resolve/resolve-and-read :model/Dashboard id-or-eid)))

(defn- public-url
  "Full public URL for `uuid`, or nil."
  [uuid]
  (when uuid
    (str (channel.urls/public-dashboard-prefix) uuid)))

(defn- response-row
  [dashboard uuid enabled]
  {:type        "dashboard"
   :id          (:id dashboard)
   :name        (:name dashboard)
   :enabled     enabled
   :public_uuid uuid
   :public_url  (public-url uuid)})

(defn- enable-public-link!
  "Ensure the dashboard has a public UUID; return `[uuid created?]`."
  [dashboard]
  (check-can-enable!)
  (let [dashboard-id (:id dashboard)
        existing     (dashboards-rest.db/dashboard-public-uuid dashboard-id)]
    (if existing
      [existing false]
      (let [uuid (str (random-uuid))]
        (t2/with-transaction [_conn]
          (dashboards-rest.db/update-dashboard! dashboard-id
                                                {:public_uuid       uuid
                                                 :made_public_by_id api/*current-user-id*})
          (events/publish-event! :event/dashboard-public-link-created
                                 {:object    (dashboards-rest.db/dashboard dashboard-id)
                                  :object-id dashboard-id
                                  :user-id   api/*current-user-id*}))
        [uuid true]))))

(defn- disable-public-link!
  "Clear the dashboard's public UUID when present."
  [dashboard]
  (check-can-disable!)
  (let [dashboard-id (:id dashboard)
        existing     (dashboards-rest.db/dashboard-public-uuid dashboard-id)]
    (when existing
      (t2/with-transaction [_conn]
        (dashboards-rest.db/update-dashboard! dashboard-id
                                              {:public_uuid       nil
                                               :made_public_by_id nil})
        (events/publish-event! :event/dashboard-public-link-deleted
                               {:object    (dashboards-rest.db/dashboard dashboard-id)
                                :object-id dashboard-id
                                :user-id   api/*current-user-id*})))
    nil))

(def ^:private args-schema
  [:map {:closed true}
   [:id [:or
         [:int {:min 1 :description "Numeric dashboard id."}]
         [:string {:min 1 :description "A 21-character dashboard entity_id."}]]]
   [:enabled [:boolean {:description (str "true enables (or returns) the public link; "
                                          "false removes it. Both directions are idempotent.")}]]])

(registry/deftool dashboard-public-link
  "Enable or disable a publicly-accessible link for a Metabase dashboard — anyone with the URL can view it without logging in. Pass id (numeric or 21-char entity_id) and enabled: true to create or return the existing public link, or enabled: false to remove it. Both directions are idempotent. Returns type, id, name, enabled, public_uuid, and public_url (the full /public/dashboard/{uuid} URL when enabled). Requires site-wide Public sharing to be on (Admin → Settings → Public sharing). Enabling requires a Metabase admin; disabling requires Settings permission (or admin). The dashboard must already be readable by the caller and not archived. Prefer this over asking the user to click Share in the UI after dashboard_write."
  {:name           "dashboard_public_link"
   :default-access :allowed
   :scope          metabot.scope/agent-content-write
   ;; `enabled: false` removes public access; enabling exposes the dashboard publicly.
   :annotations    {:readOnlyHint false, :destructiveHint true, :idempotentHint true}
   :args           args-schema}
  [{:keys [id enabled]} {:keys [token-scopes]}]
  (check-public-sharing-enabled!)
  (let [dashboard (fetch-dashboard id)
        uuid      (if enabled
                    (first (enable-public-link! dashboard))
                    (do (disable-public-link! dashboard) nil))]
    (common/success-content
     (v2.write/readback token-scopes [metabot.scope/agent-content-read]
                        (response-row dashboard uuid (boolean enabled))
                        [:type :enabled :public_uuid :public_url]))))
