(ns metabase.mcp.v2.tools.public-link-test
  "Contract tests for the `dashboard_public_link` v2 MCP tool."
  (:require
   [clojure.test :refer :all]
   [metabase.mcp.v2.message :as message]
   [metabase.mcp.v2.registry :as registry]
   [metabase.mcp.v2.test-util :as v2.tu]
   [metabase.mcp.v2.tools.public-link]
   [metabase.metabot.scope :as metabot.scope]
   [metabase.test :as mt]
   [metabase.util.json :as json]
   [toucan2.core :as t2]))

(set! *warn-on-reflection* true)

(defn- call-tool!
  ([user args] (call-tool! user v2.tu/all-scopes args))
  ([user scopes args]
   (mt/with-current-user (mt/user->id user)
     (registry/call-tool scopes nil "dashboard_public_link" args))))

(defn- tool-result
  [{:keys [result error]}]
  (when error
    (throw (ex-info (str "tool call rejected: " (message/render (:message error))) {:error error})))
  (when (:isError result)
    (throw (ex-info (str "tool call failed: " (-> result :content first :text))
                    {:result result})))
  (-> result :content first :text v2.tu/strip-data-boundary json/decode+kw))

(defn- tool-error
  [{:keys [result error]}]
  (cond
    error             (message/render (:message error))
    (:isError result) (-> result :content first :text)
    :else             (throw (ex-info "expected a tool error, got success" {:result result}))))

(deftest enable-and-disable-public-link-test
  (testing "enabled true/false creates and clears the public UUID, returning the public_url"
    (mt/with-temporary-setting-values [enable-public-sharing true
                                       site-url "http://localhost:3000"]
      (mt/with-temp [:model/Dashboard {dash-id :id} {:name "Sales overview"}]
        (let [enabled (tool-result (call-tool! :crowberto {:id dash-id :enabled true}))
              uuid    (:public_uuid enabled)]
          (is (=? {:type "dashboard" :id dash-id :name "Sales overview" :enabled true}
                  enabled))
          (is (string? uuid))
          (is (= (str "http://localhost:3000/public/dashboard/" uuid) (:public_url enabled)))
          (is (= uuid (t2/select-one-fn :public_uuid :model/Dashboard :id dash-id)))
          (is (=? {:type "dashboard" :id dash-id :enabled false :public_uuid nil :public_url nil}
                  (tool-result (call-tool! :crowberto {:id dash-id :enabled false}))))
          (is (nil? (t2/select-one-fn :public_uuid :model/Dashboard :id dash-id))))))))

(deftest enable-is-idempotent-test
  (testing "re-enabling returns the same UUID rather than minting a new one"
    (mt/with-temporary-setting-values [enable-public-sharing true
                                       site-url "http://localhost:3000"]
      (mt/with-temp [:model/Dashboard {dash-id :id} {}]
        (let [first-uuid (:public_uuid (tool-result (call-tool! :crowberto {:id dash-id :enabled true})))
              second     (tool-result (call-tool! :crowberto {:id dash-id :enabled true}))]
          (is (= first-uuid (:public_uuid second)))
          (is (= 1 (t2/count :model/Dashboard :id dash-id :public_uuid [:not= nil]))))))))

(deftest disable-is-idempotent-test
  (testing "disabling a dashboard that is not public succeeds"
    (mt/with-temporary-setting-values [enable-public-sharing true]
      (mt/with-temp [:model/Dashboard {dash-id :id} {}]
        (is (=? {:enabled false :public_uuid nil}
                (tool-result (call-tool! :crowberto {:id dash-id :enabled false}))))))))

(deftest entity-id-test
  (testing "id accepts a 21-char entity_id"
    (mt/with-temporary-setting-values [enable-public-sharing true
                                       site-url "http://localhost:3000"]
      (mt/with-temp [:model/Dashboard {dash-id :id dash-eid :entity_id} {:name "By eid"}]
        (is (=? {:id dash-id :enabled true}
                (tool-result (call-tool! :crowberto {:id dash-eid :enabled true}))))
        (is (string? (t2/select-one-fn :public_uuid :model/Dashboard :id dash-id)))))))

(deftest public-sharing-disabled-test
  (testing "a teaching error names the Admin setting when public sharing is off"
    (mt/with-temporary-setting-values [enable-public-sharing false]
      (mt/with-temp [:model/Dashboard {dash-id :id} {}]
        (is (re-find #"Public sharing is disabled"
                     (tool-error (call-tool! :crowberto {:id dash-id :enabled true}))))))))

(deftest non-admin-cannot-enable-test
  (testing "non-superusers get a teaching error on enable"
    (mt/with-temporary-setting-values [enable-public-sharing true]
      (mt/with-temp [:model/Dashboard {dash-id :id} {}]
        (is (re-find #"requires a Metabase admin"
                     (tool-error (call-tool! :rasta {:id dash-id :enabled true}))))
        (is (nil? (t2/select-one-fn :public_uuid :model/Dashboard :id dash-id)))))))

(deftest write-scope-required-test
  (testing "missing agent:content:write is refused at the registry gate"
    (mt/with-temporary-setting-values [enable-public-sharing true]
      (mt/with-temp [:model/Dashboard {dash-id :id} {}]
        (is (re-find #"^Insufficient scope to call tool: \"dashboard_public_link\"\."
                     (tool-error (call-tool! :crowberto #{metabot.scope/agent-content-read}
                                             {:id dash-id :enabled true}))))))))
