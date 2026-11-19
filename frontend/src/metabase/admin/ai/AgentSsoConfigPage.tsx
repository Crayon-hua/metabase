import { useEffect, useState } from "react";
import { t } from "ttag";

import { useToast } from "metabase/common/hooks";
import {
  getExternalAgentSettings,
  saveExternalAgentSettings,
} from "metabase/metabot/externalAgentApi";
import {
  SettingsPageWrapper,
  SettingsSection,
} from "metabase/settings-components";
import {
  Badge,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "metabase/ui";

export function AgentSsoConfigPage() {
  const [sendToast] = useToast();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [draft, setDraft] = useState({
    api_base: "",
    ui_origin: "https://agent.whaee.com",
    ui_base: "",
    agent_id: "",
    api_key_configured: false,
    enabled: false,
  });

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setError("");
      try {
        const settings = await getExternalAgentSettings();
        setDraft({
          api_base: settings.api_base ?? "",
          ui_origin: settings.ui_origin || "https://agent.whaee.com",
          ui_base: settings.ui_base ?? "",
          agent_id: settings.agent_id ?? "",
          api_key_configured: Boolean(settings.api_key_configured),
          enabled: Boolean(settings.enabled),
        });
        setApiKeyDraft("");
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : t`加载失败`);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload: Parameters<typeof saveExternalAgentSettings>[0] = {
        api_base: draft.api_base,
        ui_origin: draft.ui_origin,
        ui_base: draft.ui_base,
        agent_id: draft.agent_id,
      };
      if (apiKeyDraft) {
        payload.api_key = apiKeyDraft;
      }
      const next = await saveExternalAgentSettings(payload);
      setDraft({
        api_base: next.api_base ?? "",
        ui_origin: next.ui_origin || "https://agent.whaee.com",
        ui_base: next.ui_base ?? "",
        agent_id: next.agent_id ?? "",
        api_key_configured: Boolean(next.api_key_configured),
        enabled: Boolean(next.enabled),
      });
      setApiKeyDraft("");
      setDirty(false);
      sendToast({ message: t`Agent iframe SSO 已保存` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`保存失败`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPageWrapper title={t`Agent iframe SSO`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`与营销云一致：服务端用 X-API-Key 签发短票，右上角 Agent 侧栏打开 /chatbox#token=…，无需在 iframe 内飞书登录。API Base 形如 https://agent.whaee.com/api/v1`}
          </Text>

          <Group grow align="flex-start">
            <TextInput
              label={t`API Base`}
              placeholder="https://agent.whaee.com/api/v1"
              value={draft.api_base}
              disabled={busy}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  api_base: event.currentTarget.value,
                }));
                setDirty(true);
              }}
            />
            <TextInput
              label={t`UI Origin`}
              placeholder="https://agent.whaee.com"
              value={draft.ui_origin}
              disabled={busy}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  ui_origin: event.currentTarget.value,
                }));
                setDirty(true);
              }}
            />
          </Group>

          <Group grow align="flex-start">
            <TextInput
              label={t`UI Base（可选）`}
              placeholder="/"
              value={draft.ui_base}
              disabled={busy}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  ui_base: event.currentTarget.value,
                }));
                setDirty(true);
              }}
            />
            <TextInput
              label={t`Agent ID`}
              value={draft.agent_id}
              disabled={busy}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  agent_id: event.currentTarget.value,
                }));
                setDirty(true);
              }}
            />
          </Group>

          <PasswordInput
            label={t`平台 API Key`}
            placeholder={
              draft.api_key_configured
                ? t`已配置（留空则不修改）`
                : t`共享账号 X-API-Key`
            }
            value={apiKeyDraft}
            disabled={busy}
            onChange={(event) => {
              setApiKeyDraft(event.currentTarget.value);
              setDirty(true);
            }}
          />

          {error && <Text c="error">{error}</Text>}

          <Group>
            <Button
              variant="filled"
              disabled={!dirty || busy}
              loading={busy}
              onClick={() => void save()}
            >
              {t`保存`}
            </Button>
            {draft.enabled ? (
              <Badge color="positive">{t`侧栏可用`}</Badge>
            ) : (
              <Badge color="warning">{t`未配齐`}</Badge>
            )}
          </Group>
        </Stack>
      </SettingsSection>
    </SettingsPageWrapper>
  );
}
