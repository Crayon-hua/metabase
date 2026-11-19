import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { t } from "ttag";

function readInputValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | null | undefined,
): string {
  const target = event?.currentTarget ?? event?.target ?? null;
  return target?.value ?? "";
}

import { useToast } from "metabase/common/hooks";
import {
  Box,
  Button,
  Group,
  MultiAutocomplete,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "metabase/ui";

import { saveQueryKnowledge } from "./api";
import type {
  QueryKnowledgeAlias,
  QueryKnowledgeBody,
  QueryKnowledgeRelation,
  QueryKnowledgeState,
  QueryKnowledgeTable,
  QueryKnowledgeTerm,
} from "./types";

type TabKey = "aliases" | "terms" | "relations";

type KnowledgeEditorProps = {
  databaseId: number;
  revision: number;
  knowledge: QueryKnowledgeBody;
  tables: QueryKnowledgeTable[];
  disabled?: boolean;
  onSaved: (state: QueryKnowledgeState) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function cloneKnowledge(knowledge: QueryKnowledgeBody): QueryKnowledgeBody {
  return {
    aliases: (knowledge.aliases ?? []).map((item) => ({
      table: item.table ?? "",
      column: item.column ?? "",
      name: item.name ?? "",
      synonyms: [...(item.synonyms ?? [])],
      description: item.description ?? "",
    })),
    terms: (knowledge.terms ?? []).map((item) => ({
      name: item.name ?? "",
      synonyms: [...(item.synonyms ?? [])],
      description: item.description ?? "",
    })),
    relations: (knowledge.relations ?? []).map((item) => ({
      table: item.table ?? "",
      column: item.column ?? "",
      targetTable: item.targetTable ?? "",
      targetColumn: item.targetColumn ?? "",
      ...(item.constraint ? { constraint: item.constraint } : {}),
    })),
  };
}

function emptyAlias(): QueryKnowledgeAlias {
  return { table: "", column: "", name: "", synonyms: [], description: "" };
}

function emptyTerm(): QueryKnowledgeTerm {
  return { name: "", synonyms: [], description: "" };
}

function emptyRelation(): QueryKnowledgeRelation {
  return { table: "", column: "", targetTable: "", targetColumn: "" };
}

export function KnowledgeEditor({
  databaseId,
  revision,
  knowledge,
  tables,
  disabled = false,
  onSaved,
  onDirtyChange,
}: KnowledgeEditorProps) {
  const [sendToast] = useToast();
  const [tab, setTab] = useState<TabKey>("aliases");
  const [draft, setDraft] = useState<QueryKnowledgeBody>(() =>
    cloneKnowledge(knowledge),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tableOptions = useMemo(
    () => tables.map((table) => ({ value: table.name, label: table.name })),
    [tables],
  );

  const columnsOf = useCallback(
    (table: string) =>
      (tables.find((item) => item.name === table)?.columns ?? []).map(
        (column) => ({ value: column.name, label: column.name }),
      ),
    [tables],
  );

  const markDirty = useCallback(
    (next: QueryKnowledgeBody) => {
      setDraft(next);
      setDirty(true);
      onDirtyChange?.(true);
    },
    [onDirtyChange],
  );

  const reset = useCallback(() => {
    setDraft(cloneKnowledge(knowledge));
    setDirty(false);
    setError("");
    onDirtyChange?.(false);
  }, [knowledge, onDirtyChange]);

  useEffect(() => {
    reset();
  }, [reset]);

  const save = async (reindex: boolean) => {
    setSaving(true);
    setError("");
    try {
      const state = await saveQueryKnowledge(
        databaseId,
        revision,
        draft,
        reindex,
      );
      onSaved(state);
      setDirty(false);
      onDirtyChange?.(false);
      sendToast({
        message: reindex ? t`已保存并重建索引` : t`知识已保存`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`保存失败`);
    } finally {
      setSaving(false);
    }
  };

  const locked = saving || disabled;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw="bold" size="lg">
          {t`查询知识`}
        </Text>
        <Group gap="sm">
          {dirty && (
            <Button disabled={locked} onClick={reset}>
              {t`丢弃更改`}
            </Button>
          )}
          <Button
            variant="default"
            disabled={!dirty || locked}
            loading={saving}
            onClick={() => void save(false)}
          >
            {t`保存`}
          </Button>
          <Button
            variant="filled"
            disabled={!dirty || locked}
            loading={saving}
            onClick={() => void save(true)}
          >
            {t`保存并重建索引`}
          </Button>
        </Group>
      </Group>

      {error && <Text c="error">{error}</Text>}
      {!tables.length && (
        <Text c="text-secondary">
          {t`当前数据库尚无可用表。请先在「数据库」中完成同步，再配置同义词与关联。`}
        </Text>
      )}

      <Tabs
        value={tab}
        onChange={(value) => setTab((value as TabKey) ?? "aliases")}
      >
        <Tabs.List>
          <Tabs.Tab value="aliases">{t`表 / 字段同义词`}</Tabs.Tab>
          <Tabs.Tab value="terms">{t`业务口径`}</Tabs.Tab>
          <Tabs.Tab value="relations">{t`逻辑关联`}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="aliases" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`字段留空表示业务名映射到整张表。描述可记录含义或状态码说明。`}
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
                      label={t`表`}
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
                      label={t`字段`}
                      data={columnsOf(item.table)}
                      value={item.column || null}
                      disabled={locked || !item.table}
                      clearable
                      searchable
                      placeholder={t`整表`}
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
                    label={t`业务名称`}
                    value={item.name}
                    disabled={locked}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        name: readInputValue(event),
                      };
                      markDirty(next);
                    }}
                  />
                  <MultiAutocomplete
                    label={t`同义词`}
                    value={item.synonyms ?? []}
                    data={item.synonyms ?? []}
                    disabled={locked}
                    placeholder={t`回车或逗号添加，支持粘贴`}
                    onChange={(value) => {
                      const synonyms = (value ?? [])
                        .map((entry) => String(entry ?? "").trim())
                        .filter(Boolean);
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        synonyms,
                      };
                      markDirty(next);
                    }}
                  />
                  <Textarea
                    label={t`描述`}
                    value={item.description}
                    disabled={locked}
                    minRows={2}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.aliases[index] = {
                        ...next.aliases[index],
                        description: readInputValue(event),
                      };
                      markDirty(next);
                    }}
                  />
                  <Button
                    w="fit-content"
                    color="negative"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.aliases.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`删除`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked || !tables.length}
              onClick={() =>
                markDirty({
                  ...draft,
                  aliases: [...draft.aliases, emptyAlias()],
                })
              }
            >
              {t`添加同义词`}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="terms" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`记录计算公式、物理字段、过滤条件与时间粒度。名称与同义词都会参与召回。`}
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
                    label={t`口径名称`}
                    value={item.name}
                    disabled={locked}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        name: readInputValue(event),
                      };
                      markDirty(next);
                    }}
                  />
                  <MultiAutocomplete
                    label={t`同义词`}
                    value={item.synonyms ?? []}
                    data={item.synonyms ?? []}
                    disabled={locked}
                    placeholder={t`回车或逗号添加，支持粘贴`}
                    onChange={(value) => {
                      const synonyms = (value ?? [])
                        .map((entry) => String(entry ?? "").trim())
                        .filter(Boolean);
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        synonyms,
                      };
                      markDirty(next);
                    }}
                  />
                  <Textarea
                    label={t`定义`}
                    value={item.description}
                    disabled={locked}
                    minRows={3}
                    onChange={(event) => {
                      const next = cloneKnowledge(draft);
                      next.terms[index] = {
                        ...next.terms[index],
                        description: readInputValue(event),
                      };
                      markDirty(next);
                    }}
                  />
                  <Button
                    w="fit-content"
                    color="negative"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.terms.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`删除`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked}
              onClick={() =>
                markDirty({ ...draft, terms: [...draft.terms, emptyTerm()] })
              }
            >
              {t`添加口径`}
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="relations" pt="md">
          <Text c="text-secondary" mb="md" size="sm">
            {t`补充未声明为外键的逻辑关联。物理外键会随元数据同步自动带入。`}
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
                      label={t`源表`}
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
                      label={t`源字段`}
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
                      label={t`目标表`}
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
                      label={t`目标字段`}
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
                    color="negative"
                    variant="subtle"
                    disabled={locked}
                    onClick={() => {
                      const next = cloneKnowledge(draft);
                      next.relations.splice(index, 1);
                      markDirty(next);
                    }}
                  >
                    {t`删除`}
                  </Button>
                </Stack>
              </Box>
            ))}
            <Button
              w="fit-content"
              disabled={locked || !tables.length}
              onClick={() =>
                markDirty({
                  ...draft,
                  relations: [...draft.relations, emptyRelation()],
                })
              }
            >
              {t`添加关联`}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
