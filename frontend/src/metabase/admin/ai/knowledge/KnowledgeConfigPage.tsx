import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { t } from "ttag";

function readInputValue(
  event: ChangeEvent<HTMLInputElement> | null | undefined,
): string {
  const target = event?.currentTarget ?? event?.target ?? null;
  return target?.value ?? "";
}

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
  Icon,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "metabase/ui";

import {
  getQueryKnowledge,
  reindexQueryKnowledge,
  saveEmbeddingSettings,
} from "./api";
import { KnowledgeEditor } from "./KnowledgeEditor";
import type { EmbeddingSettings, QueryKnowledgeState } from "./types";

function indexNotReadyMessage(
  reason: string | null | undefined,
  documentCount: number,
  tableCount: number,
): string {
  switch (reason) {
    case "embedding-not-configured":
      return t`未配置 Embedding（需填写 Base URL 与模型）`;
    case "no-synced-tables":
      return t`数据库尚未同步出表，请先在「数据库」中完成 Sync`;
    case "no-documents":
      return tableCount > 0
        ? t`尚未生成向量文档（表 ${tableCount} 张）。请点击「重建索引」`
        : t`尚未生成向量文档，请先同步表后再重建索引`;
    case "embedding-model-mismatch":
      return t`Embedding 配置已变更，与现有索引不一致，请重新「重建索引」`;
    default:
      return documentCount > 0
        ? t`索引未就绪（文档 ${documentCount}）`
        : t`索引未就绪`;
  }
}

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
  const [busy, setBusy] = useState<"load" | "reindex" | "embed" | null>(null);
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
      } else if ((next.index?.document_count ?? 0) <= 0) {
        sendToast({
          message: indexNotReadyMessage(
            next.index?.not_ready_reason,
            next.index?.document_count ?? 0,
            next.index?.table_count ?? 0,
          ),
        });
      } else {
        sendToast({
          message: `${t`索引已重建`} (${next.index.document_count})`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`重建索引失败`);
    } finally {
      setBusy(null);
    }
  };

  const locked = busy !== null || dirty || embedDirty;

  return (
    <SettingsPageWrapper title={t`知识配置`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`为外部 Agent 配置同义词、业务口径与逻辑关联。元数据直接使用 Metabase 已同步的数据库表字段；召回通过 Metabase MCP 的 retrieve_query_evidence 提供，不在此生成 SQL。`}
          </Text>

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
                    base_url: readInputValue(event),
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
                    model: readInputValue(event),
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
                setApiKeyDraft(readInputValue(event));
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
            <Group gap="sm" align="center">
              {state &&
                (state.index.ready ? (
                  <Badge color="positive">
                    {`${t`索引就绪`} (${state.index.document_count})`}
                  </Badge>
                ) : (
                  <Group gap={6} align="center">
                    <Badge color="warning">
                      {`${t`索引未就绪`} (${state.index.document_count})`}
                    </Badge>
                    <Tooltip
                      label={
                        <Text c="inherit" maw="22rem">
                          {indexNotReadyMessage(
                            state.index.not_ready_reason,
                            state.index.document_count,
                            state.index.table_count ?? 0,
                          )}
                        </Text>
                      }
                      multiline
                      maw={360}
                    >
                      <Icon
                        name="info"
                        size={16}
                        c="text-secondary"
                        style={{ cursor: "help" }}
                        aria-label={t`索引未就绪原因`}
                      />
                    </Tooltip>
                  </Group>
                ))}
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
                onClick={() =>
                  databaseId != null && void loadKnowledge(databaseId)
                }
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
