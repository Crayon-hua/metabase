import { t } from "ttag";

import {
  SettingsPageWrapper,
  SettingsSection,
} from "metabase/settings-components";
import { Card, Code, Stack, Text, Title } from "metabase/ui";

import { getSqlAgentMcpUrl } from "./sqlAgentSettings";

const TOOLS = [
  "list_sources",
  "get_catalog",
  "sync_schema",
  "get_knowledge",
  "save_knowledge",
  "retrieve_evidence",
  "get_embedding_config",
];

export function SqlAgentMcpPage() {
  const mcpUrl = getSqlAgentMcpUrl();
  return (
    <SettingsPageWrapper title={t`SQL Agent MCP`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`Point external agents at this Streamable HTTP MCP endpoint. Tools return schema evidence only — the agent’s own LLM should generate SQL.`}
          </Text>

          <Card withBorder padding="lg">
            <Stack gap="sm">
              <Title order={4}>{t`Endpoint`}</Title>
              <Code block>{mcpUrl}</Code>
              <Text size="sm" c="text-secondary">
                Cursor example: Settings → MCP → streamable-http → {mcpUrl}
              </Text>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="sm">
              <Title order={4}>{t`Tools`}</Title>
              {TOOLS.map((tool) => (
                <Code key={tool}>{tool}</Code>
              ))}
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="sm">
              <Title order={4}>{t`Suggested agent flow`}</Title>
              <Text>
                1. <Code>list_sources</Code> → pick source_id
              </Text>
              <Text>
                2. <Code>retrieve_evidence</Code> with the user question
              </Text>
              <Text>
                3. Use returned tables / terms / relations to draft SQL in the
                external model
              </Text>
              <Text>
                4. Optionally run SQL via Metabase MCP <Code>execute_sql</Code>
              </Text>
            </Stack>
          </Card>
        </Stack>
      </SettingsSection>
    </SettingsPageWrapper>
  );
}
