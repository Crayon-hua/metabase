import { useCallback, useEffect, useState } from "react";
import { t } from "ttag";

import { useToast } from "metabase/common/hooks";
import {
  SettingsPageWrapper,
  SettingsSection,
} from "metabase/settings-components";
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
} from "metabase/ui";

import {
  getSqlAgentCatalog,
  listSqlAgentSources,
  syncSqlAgentCatalog,
} from "./api";
import { KnowledgeEditor } from "./KnowledgeEditor";
import type {
  SqlAgentCatalogResponse,
  SqlAgentSource,
} from "./types";

export function SqlAgentWorkbenchPage() {
  const [sendToast] = useToast();
  const [sources, setSources] = useState<SqlAgentSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [state, setState] = useState<SqlAgentCatalogResponse | null>(null);
  const [busy, setBusy] = useState<"init" | "load" | "sync" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const loadSources = useCallback(async () => {
    setBusy("init");
    setError("");
    try {
      const list = await listSqlAgentSources();
      setSources(list);
      const nextId = list[0]?.id ?? "";
      setSourceId(nextId);
      if (nextId) {
        setState(await getSqlAgentCatalog(nextId));
      } else {
        setState(null);
      }
    } catch (err) {
      setSources([]);
      setSourceId("");
      setState(null);
      setError(
        err instanceof Error
          ? err.message
          : t`Unable to reach SQL Agent sidecar`,
      );
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const selectSource = async (value: string | null) => {
    const nextId = value ?? "";
    setSourceId(nextId);
    setDirty(false);
    if (!nextId) {
      setState(null);
      return;
    }
    setBusy("load");
    setError("");
    try {
      setState(await getSqlAgentCatalog(nextId));
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : t`Failed to load catalog`);
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    if (!sourceId || dirty) {
      return;
    }
    setBusy("sync");
    setError("");
    try {
      const next = await syncSqlAgentCatalog(sourceId);
      setState(next);
      sendToast({ message: t`Schema synced` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Schema sync failed`);
    } finally {
      setBusy(null);
    }
  };

  const active = sources.find((item) => item.id === sourceId);
  const locked = busy !== null || dirty;

  return (
    <SettingsPageWrapper title={t`Knowledge`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`Configure table/field synonyms, business metrics, and logical joins used by retrieve and MCP.`}
          </Text>

          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Select
              label={t`Data source`}
              w={320}
              data={sources.map((source) => ({
                value: source.id,
                label: source.name,
              }))}
              value={sourceId || null}
              disabled={busy !== null || dirty}
              placeholder={t`Select a source`}
              onChange={(value) => void selectSource(value)}
            />
            <Group gap="sm">
              {state?.vectorEnabled && (
                <Badge color={state.vectorReady ? "success" : "warning"}>
                  {state.vectorReady
                    ? t`pgvector indexed`
                    : t`pgvector pending`}
                </Badge>
              )}
              {active && (
                <Text size="sm" c="text-secondary">
                  {active.database}
                </Text>
              )}
              <Button
                disabled={locked || !sourceId}
                loading={busy === "sync"}
                onClick={() => void sync()}
              >
                {t`Sync schema`}
              </Button>
              <Button
                variant="default"
                disabled={busy !== null}
                onClick={() => void loadSources()}
              >
                {t`Refresh`}
              </Button>
            </Group>
          </Group>

          {error && <Text c="error">{error}</Text>}

          {!sourceId && busy !== "init" && (
            <Text c="text-secondary">
              {t`No sources yet. Add one in the SQL Agent sidecar, then refresh.`}
            </Text>
          )}

          {state && sourceId && (
            <KnowledgeEditor
              key={`${sourceId}-${state.catalog.revision}`}
              sourceId={sourceId}
              catalog={state.catalog}
              disabled={busy !== null}
              onDirtyChange={setDirty}
              onSaved={setState}
            />
          )}
        </Stack>
      </SettingsSection>
    </SettingsPageWrapper>
  );
}
