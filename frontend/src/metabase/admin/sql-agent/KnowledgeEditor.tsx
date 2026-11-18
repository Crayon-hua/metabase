import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";

import { useToast } from "metabase/common/hooks";
import {
  Box,
  Button,
  Group,
  Select,
  Stack,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "metabase/ui";

import { saveSqlAgentKnowledge } from "./api";
import type {
  SqlAgentAlias,
  SqlAgentCatalog,
  SqlAgentCatalogResponse,
  SqlAgentKnowledge,
  SqlAgentRelation,
  SqlAgentTerm,
} from "./types";

type TabKey = "aliases" | "terms" | "relations";

type KnowledgeEditorProps = {
  sourceId: string;
  catalog: SqlAgentCatalog;
  disabled?: boolean;
  onSaved: (state: SqlAgentCatalogResponse) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function cloneKnowledge(knowledge: SqlAgentKnowledge): SqlAgentKnowledge {
  return {
    aliases: knowledge.aliases.map((item) => ({
      ...item,
      column: item.column ?? "",
      synonyms: [...(item.synonyms ?? [])],
    })),
    terms: knowledge.terms.map((item) => ({
      ...item,
      synonyms: [...(item.synonyms ?? [])],
    })),
    relations: knowledge.relations.map((item) => ({ ...item })),
  };
}

function emptyAlias(): SqlAgentAlias {
  return { table: "", column: "", name: "", synonyms: [], description: "" };
}

function emptyTerm(): SqlAgentTerm {
  return { name: "", synonyms: [], description: "" };
}

function emptyRelation(): SqlAgentRelation {
  return { table: "", column: "", targetTable: "", targetColumn: "" };
}

export function KnowledgeEditor({
  sourceId,
  catalog,
  disabled = false,
  onSaved,
  onDirtyChange,
}: KnowledgeEditorProps) {
  const [sendToast] = useToast();
  const [tab, setTab] = useState<TabKey>("aliases");
  const [draft, setDraft] = useState<SqlAgentKnowledge>(() =>
    cloneKnowledge(catalog.knowledge),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tableOptions = useMemo(
    () => catalog.tables.map((table) => ({ value: table.name, label: table.name })),
    [catalog.tables],
  );

  const columnsOf = useCallback(
    (table: string) =>
      (catalog.tables.find((item) => item.name === table)?.columns ?? []).map(
        (column) => ({ value: column.name, label: column.name }),
      ),
    [catalog.tables],
  );

  const markDirty = useCallback(
    (next: SqlAgentKnowledge) => {
      setDraft(next);
      setDirty(true);
      onDirtyChange?.(true);
    },
    [onDirtyChange],
  );

  const reset = useCallback(() => {
    setDraft(cloneKnowledge(catalog.knowledge));
    setDirty(false);
    setError("");
    onDirtyChange?.(false);
  }, [catalog.knowledge, onDirtyChange]);

  useEffect(() => {
    reset();
  }, [reset]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const state = await saveSqlAgentKnowledge(
        sourceId,
        catalog.revision,
        draft,
      );
      onSaved(state);
      setDirty(false);
      onDirtyChange?.(false);
      sendToast({ message: t`Knowledge saved` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Save failed`);
    } finally {
      setSaving(false);
    }
  };

  const locked = saving || disabled;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw="bold" size="lg">
          {t`Query knowledge`}
        </Text>
        <Group gap="sm">
          {dirty && (
            <Button disabled={locked} onClick={reset}>
              {t`Discard`}
            </Button>
          )}
          <Button
            variant="filled"
            disabled={!dirty || locked}
            loading={saving}
            onClick={() => void save()}
          >
            {t`Save`}
          </Button>
        </Group>
      </Group>

      {error && <Text c="error">{error}</Text>}
      {!catalog.tables.length && (
        <Text c="text-secondary">
          {t`Sync schema first, then configure synonyms and relations.`}
        </Text>
      )}

      <Tabs value={tab} onChange={(value) => setTab((value as TabKey) ?? "aliases")}>
        <Tabs.List>
          <Tabs.Tab value="aliases">{t`Table / field synonyms`}</Tabs.Tab>
          <Tabs.Tab value="terms">{t`Business metrics`}</Tabs.Tab>
          <Tabs.Tab value="relations">{t`Logical joins`}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="aliases" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`Leave field empty to map the business name to the whole table. Description can capture meaning or status codes.`}
          </Text>
          <Stack gap="lg">
            {draft.aliases.map((item, index) => (
              <Box
                key={`alias-${index}`}
                p="md"
                style={{
                  border: "1px solid var(--mb-color-border)",
                  borderRadius: 8,
                }}
              >
                <Stack gap="sm">
                  <Group grow align="flex-start">
                    <Select
                      label={t`Table`}
                      data={tableOptions}
                      value={item.table || null}
                      disabled={locked}
                      searchable
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.aliases[index] = {
                          ...next.aliases[index],
                          table: value ?? "",
                          column: "",
                        };
                        markDirty(next);
                      }}
                    />
                    <Select
                      label={t`Column`}
                      data={columnsOf(item.table)}
                      value={item.column || null}
                      disabled={locked || !item.table}
                      clearable
                      searchable
                      placeholder={t`Whole table`}
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.aliases[index] = {
                          ...next.aliases[index],
                          column: value ?? "",
                        };
                        markDirty(next);
                      }}
                    />
                  </Group>
                  <TextInput
                    label={t`Business name`}
                    value={item.name}
                    disabled={locked}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        name: event.currentTarget.value,
                      };
                      markDirty(next);
                    }}
                  />
                  <TagsInput
                    label={t`Synonyms`}
                    value={item.synonyms}
                    disabled={locked}
                    placeholder={t`Press Enter to add`}
                    onChange={(value) => {
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        synonyms: value,
                      };
                      markDirty(next);
                    }}
                  />
                  <Textarea
                    label={t`Description`}
                    value={item.description}
                    disabled={locked}
                    minRows={2}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        description: event.currentTarget.value,
                      };
                      markDirty(next);
                    }}
                  />
                  <Button
                    w="fit-content"
                    color="error"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.aliases.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`Remove`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked || !catalog.tables.length}
              onClick={() => markDirty({ ...draft, aliases: [...draft.aliases, emptyAlias()] })}
            >
              {t`Add synonym`}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="terms" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`Document formulas, physical fields, filters, and time grain. Names and synonyms both participate in retrieval.`}
          </Text>
          <Stack gap="lg">
            {draft.terms.map((item, index) => (
              <Box
                key={`term-${index}`}
                p="md"
                style={{
                  border: "1px solid var(--mb-color-border)",
                  borderRadius: 8,
                }}
              >
                <Stack gap="sm">
                  <TextInput
                    label={t`Term name`}
                    value={item.name}
                    disabled={locked}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        name: event.currentTarget.value,
                      };
                      markDirty(next);
                    }}
                  />
                  <TagsInput
                    label={t`Synonyms`}
                    value={item.synonyms}
                    disabled={locked}
                    placeholder={t`Press Enter to add`}
                    onChange={(value) => {
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        synonyms: value,
                      };
                      markDirty(next);
                    }}
                  />
                  <Textarea
                    label={t`Definition`}
                    value={item.description}
                    disabled={locked}
                    minRows={3}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        description: event.currentTarget.value,
                      };
                      markDirty(next);
                    }}
                  />
                  <Button
                    w="fit-content"
                    color="error"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.terms.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`Remove`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked}
              onClick={() => markDirty({ ...draft, terms: [...draft.terms, emptyTerm()] })}
            >
              {t`Add metric`}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="relations" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`Add logical joins not declared as foreign keys. Physical FKs are imported on schema sync.`}
          </Text>
          <Stack gap="lg">
            {draft.relations.map((item, index) => (
              <Box
                key={`relation-${index}`}
                p="md"
                style={{
                  border: "1px solid var(--mb-color-border)",
                  borderRadius: 8,
                }}
              >
                <Stack gap="sm">
                  <Group grow align="flex-start">
                    <Select
                      label={t`Source table`}
                      data={tableOptions}
                      value={item.table || null}
                      disabled={locked}
                      searchable
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.relations[index] = {
                          ...next.relations[index],
                          table: value ?? "",
                          column: "",
                        };
                        markDirty(next);
                      }}
                    />
                    <Select
                      label={t`Source column`}
                      data={columnsOf(item.table)}
                      value={item.column || null}
                      disabled={locked || !item.table}
                      searchable
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.relations[index] = {
                          ...next.relations[index],
                          column: value ?? "",
                        };
                        markDirty(next);
                      }}
                    />
                  </Group>
                  <Group grow align="flex-start">
                    <Select
                      label={t`Target table`}
                      data={tableOptions}
                      value={item.targetTable || null}
                      disabled={locked}
                      searchable
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.relations[index] = {
                          ...next.relations[index],
                          targetTable: value ?? "",
                          targetColumn: "",
                        };
                        markDirty(next);
                      }}
                    />
                    <Select
                      label={t`Target column`}
                      data={columnsOf(item.targetTable)}
                      value={item.targetColumn || null}
                      disabled={locked || !item.targetTable}
                      searchable
                      onChange={(value) => {
                        const next = cloneKnowledge(draft);
                        next.relations[index] = {
                          ...next.relations[index],
                          targetColumn: value ?? "",
                        };
                        markDirty(next);
                      }}
                    />
                  </Group>
                  <Button
                    w="fit-content"
                    color="error"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.relations.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`Remove`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked || !catalog.tables.length}
              onClick={() =>
                markDirty({
                  ...draft,
                  relations: [...draft.relations, emptyRelation()],
                })
              }
            >
              {t`Add relation`}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
