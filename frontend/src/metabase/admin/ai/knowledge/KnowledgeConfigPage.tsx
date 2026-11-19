import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";

import { useListDatabasesQuery } from "metabase/api";
import { useToast } from "metabase/common/hooks";
import {
  SettingsPageWrapper,
  SettingsSection,
} from "metabase/settings-components";
import {
  Badge,
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "metabase/ui";

import {
  getExternalAgentSettings,
  saveExternalAgentSettings,
} from "metabase/metabot/externalAgentApi";
import {
  getQueryKnowledge,
  reindexQueryKnowledge,
  saveEmbeddingSettings,
} from "./api";
import { KnowledgeEditor } from "./KnowledgeEditor";
import type { EmbeddingSettings, QueryKnowledgeState } from "./types";

export function KnowledgeConfigPage() {
  const [sendToast] = useToast();
  const { data: databasesResponse, isLoading: loadingDatabases } =
    useListDatabasesQuery();
  const databases = useMemo(
    () =>
      (databasesResponse?.data ?? []).filter(
        (db) => !db.is_sample && !db.is_audit,
      ),
    [databasesResponse?.data],
  );

  const [databaseId, setDatabaseId] = useState<number | null>(null);
  const [state, setState] = useState<QueryKnowledgeState | null>(null);
  const [busy, setBusy] = useState<
    "load" | "reindex" | "embed" | "agent" | null
  >(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const [embedDraft, setEmbedDraft] = useState<EmbeddingSettings>({
    base_url: "",
    model: "",
    api_key_configured: false,
    configured: false,
  });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [embedDirty, setEmbedDirty] = useState(false);

  const [agentDraft, setAgentDraft] = useState({
    api_base: "",
    ui_origin: "https://agent.whaee.com",
    ui_base: "",
    agent_id: "",
    api_key_configured: false,
    enabled: false,
  });
  const [agentApiKeyDraft, setAgentApiKeyDraft] = useState("");
  const [agentDirty, setAgentDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getExternalAgentSettings();
        setAgentDraft({
          api_base: settings.api_base ?? "",
          ui_origin: settings.ui_origin || "https://agent.whaee.com",
          ui_base: settings.ui_base ?? "",
          agent_id: settings.agent_id ?? "",
          api_key_configured: Boolean(settings.api_key_configured),
          enabled: Boolean(settings.enabled),
        });
      } catch {
        // Superuser-only; ignore for non-admin edge cases
      }
    })();
  }, []);

  useEffect(() => {
    if (databaseId == null && databases.length > 0) {
      setDatabaseId(databases[0].id);
    }
  }, [databaseId, databases]);

  const loadKnowledge = useCallback(async (id: number) => {
    setBusy("load");
    setError("");
    try {
      const next = await getQueryKnowledge(id);
      setState(next);
      setEmbedDraft({
        base_url: next.embedding?.base_url ?? "",
        model: next.embedding?.model ?? "",
        api_key_configured: Boolean(next.embedding?.api_key_configured),
        configured: Boolean(next.embedding?.configured),
      });
      setApiKeyDraft("");
      setEmbedDirty(false);
      setDirty(false);
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : t`加载失败`);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (databaseId != null) {
      void loadKnowledge(databaseId);
    }
  }, [databaseId, loadKnowledge]);

  const selectDatabase = (value: string | null) => {
    if (dirty || embedDirty) {
      return;
    }
    const nextId = value ? Number(value) : null;
    setDatabaseId(Number.isFinite(nextId) ? nextId : null);
  };

  const saveEmbed = async () => {
    setBusy("embed");
    setError("");
    try {
      const payload: {
        base_url: string;
        model: string;
        api_key?: string;
      } = {
        base_url: embedDraft.base_url,
        model: embedDraft.model,
      };
      if (apiKeyDraft) {
        payload.api_key = apiKeyDraft;
      }
      const next = await saveEmbeddingSettings(payload);
      setEmbedDraft({
        base_url: next?.base_url ?? "",
        model: next?.model ?? "",
        api_key_configured: Boolean(next?.api_key_configured),
        configured: Boolean(next?.configured),
      });
      setApiKeyDraft("");
      setEmbedDirty(false);
      sendToast({ message: t`Embedding 设置已保存` });
      if (databaseId != null) {
        await loadKnowledge(databaseId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`保存 Embedding 失败`);
    } finally {
      setBusy(null);
    }
  };

  const reindex = async () => {
    if (databaseId == null || dirty) {
      return;
    }
    setBusy("reindex");
    setError("");
    try {
      const next = await reindexQueryKnowledge(databaseId);
      setState(next);
      if (next.reindex?.skipped) {
        sendToast({
          message: t`未配置 Embedding，已跳过重建索引`,
        });
      } else {
        sendToast({ message: t`索引已重建` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`重建索引失败`);
    } finally {
      setBusy(null);
    }
  };

  const saveAgent = async () => {
    setBusy("agent");
    setError("");
    try {
      const payload: Parameters<typeof saveExternalAgentSettings>[0] = {
        api_base: agentDraft.api_base,
        ui_origin: agentDraft.ui_origin,
        ui_base: agentDraft.ui_base,
        agent_id: agentDraft.agent_id,
      };
      if (agentApiKeyDraft) {
        payload.api_key = agentApiKeyDraft;
      }
      const next = await saveExternalAgentSettings(payload);
      setAgentDraft({
        api_base: next.api_base ?? "",
        ui_origin: next.ui_origin || "https://agent.whaee.com",
        ui_base: next.ui_base ?? "",
        agent_id: next.agent_id ?? "",
        api_key_configured: Boolean(next.api_key_configured),
        enabled: Boolean(next.enabled),
      });
      setAgentApiKeyDraft("");
      setAgentDirty(false);
      sendToast({ message: t`Agent iframe SSO 已保存` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`保存 Agent 配置失败`);
    } finally {
      setBusy(null);
    }
  };

  const locked = busy !== null || dirty || embedDirty || agentDirty;

  return (
    <SettingsPageWrapper title={t`知识配置`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`为外部 Agent 配置同义词、业务口径与逻辑关联。元数据直接使用 Metabase 已同步的数据库表字段；召回通过 Metabase MCP 的 retrieve_query_evidence 提供，不在此生成 SQL。右上角 Agent 侧栏使用与营销云相同的 chatbox + 短票嵌入，无需在 iframe 内飞书登录。`}
          </Text>

          <Stack
            gap="sm"
            p="md"
            style={{
              border: "1px solid var(--mb-color-border)",
              borderRadius: 8,
            }}
          >
            <Text fw="bold">{t`Agent iframe SSO`}</Text>
            <Text c="text-secondary" size="sm">
              {t`与营销云一致：服务端用 X-API-Key 签发短票，侧栏打开 /chatbox#token=…。API Base 形如 https://agent.whaee.com/api/v1`}
            </Text>
            <Group grow align="flex-start">
              <TextInput
                label={t`API Base`}
                placeholder="https://agent.whaee.com/api/v1"
                value={agentDraft.api_base}
                disabled={busy !== null}
                onChange={(event) => {
                  setAgentDraft((prev) => ({
                    ...prev,
                    api_base: event.currentTarget.value,
                  }));
                  setAgentDirty(true);
                }}
              />
              <TextInput
                label={t`UI Origin`}
                placeholder="https://agent.whaee.com"
                value={agentDraft.ui_origin}
                disabled={busy !== null}
                onChange={(event) => {
                  setAgentDraft((prev) => ({
                    ...prev,
                    ui_origin: event.currentTarget.value,
                  }));
                  setAgentDirty(true);
                }}
              />
            </Group>
            <Group grow align="flex-start">
              <TextInput
                label={t`UI Base（可选）`}
                placeholder="/"
                value={agentDraft.ui_base}
                disabled={busy !== null}
                onChange={(event) => {
                  setAgentDraft((prev) => ({
                    ...prev,
                    ui_base: event.currentTarget.value,
                  }));
                  setAgentDirty(true);
                }}
              />
              <TextInput
                label={t`Agent ID`}
                value={agentDraft.agent_id}
                disabled={busy !== null}
                onChange={(event) => {
                  setAgentDraft((prev) => ({
                    ...prev,
                    agent_id: event.currentTarget.value,
                  }));
                  setAgentDirty(true);
                }}
              />
            </Group>
            <PasswordInput
              label={t`平台 API Key`}
              placeholder={
                agentDraft.api_key_configured
                  ? t`已配置（留空则不修改）`
                  : t`共享账号 X-API-Key`
              }
              value={agentApiKeyDraft}
              disabled={busy !== null}
              onChange={(event) => {
                setAgentApiKeyDraft(event.currentTarget.value);
                setAgentDirty(true);
              }}
            />
            <Group>
              <Button
                variant="filled"
                disabled={!agentDirty || busy !== null}
                loading={busy === "agent"}
                onClick={() => void saveAgent()}
              >
                {t`保存 Agent SSO`}
              </Button>
              {agentDraft.enabled ? (
                <Badge color="positive">{t`侧栏可用`}</Badge>
              ) : (
                <Badge color="warning">{t`未配齐`}</Badge>
              )}
            </Group>
          </Stack>

          <Stack
            gap="sm"
            p="md"
            style={{
              border: "1px solid var(--mb-color-border)",
              borderRadius: 8,
            }}
          >
            <Text fw="bold">{t`Embedding 设置`}</Text>
            <Text c="text-secondary" size="sm">
              {t`OpenAI 兼容的 embeddings 接口。未配置时语义召回退化为关键词匹配。`}
            </Text>
            <Group grow align="flex-start">
              <TextInput
                label={t`Base URL`}
                placeholder="https://api.openai.com/v1"
                value={embedDraft.base_url}
                disabled={busy !== null || dirty}
                onChange={(event) => {
                  setEmbedDraft((prev) => ({
                    ...prev,
                    base_url: event.currentTarget.value,
                  }));
                  setEmbedDirty(true);
                }}
              />
              <TextInput
                label={t`模型`}
                placeholder="text-embedding-3-small"
                value={embedDraft.model}
                disabled={busy !== null || dirty}
                onChange={(event) => {
                  setEmbedDraft((prev) => ({
                    ...prev,
                    model: event.currentTarget.value,
                  }));
                  setEmbedDirty(true);
                }}
              />
            </Group>
            <PasswordInput
              label={t`API Key`}
              placeholder={
                embedDraft.api_key_configured
                  ? t`已配置（留空则不修改）`
                  : t`可选`
              }
              value={apiKeyDraft}
              disabled={busy !== null || dirty}
              onChange={(event) => {
                setApiKeyDraft(event.currentTarget.value);
                setEmbedDirty(true);
              }}
            />
            <Group>
              <Button
                variant="filled"
                disabled={!embedDirty || busy !== null || dirty}
                loading={busy === "embed"}
                onClick={() => void saveEmbed()}
              >
                {t`保存 Embedding`}
              </Button>
              {embedDraft.configured ? (
                <Badge color="positive">{t`已配置`}</Badge>
              ) : (
                <Badge color="warning">{t`未配置（仅关键词召回）`}</Badge>
              )}
            </Group>
          </Stack>

          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Select
              label={t`数据库`}
              w={360}
              data={databases.map((db) => ({
                value: String(db.id),
                label: db.name,
              }))}
              value={databaseId != null ? String(databaseId) : null}
              disabled={
                loadingDatabases || busy !== null || dirty || embedDirty
              }
              placeholder={t`选择数据库`}
              searchable
              onChange={(value) => selectDatabase(value)}
            />
            <Group gap="sm">
              {state && (
                <Badge color={state.index.ready ? "positive" : "warning"}>
                  {state.index.ready
                    ? `${t`索引就绪`} (${state.index.document_count})`
                    : t`索引未就绪`}
                </Badge>
              )}
              <Button
                disabled={locked || databaseId == null}
                loading={busy === "reindex"}
                onClick={() => void reindex()}
              >
                {t`重建索引`}
              </Button>
              <Button
                variant="default"
                disabled={busy !== null || databaseId == null}
                onClick={() => databaseId != null && void loadKnowledge(databaseId)}
              >
                {t`刷新`}
              </Button>
            </Group>
          </Group>

          {error && <Text c="error">{error}</Text>}

          {!databases.length && !loadingDatabases && (
            <Text c="text-secondary">
              {t`暂无可用数据库。请先在「数据库」中添加并同步。`}
            </Text>
          )}

          {state && databaseId != null && (
            <KnowledgeEditor
              key={`${databaseId}-${state.revision}`}
              databaseId={databaseId}
              revision={state.revision}
              knowledge={state.knowledge}
              tables={state.tables}
              disabled={busy !== null || embedDirty}
              onDirtyChange={setDirty}
              onSaved={setState}
            />
          )}
        </Stack>
      </SettingsSection>
    </SettingsPageWrapper>
  );
}
