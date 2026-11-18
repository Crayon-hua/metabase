import { useEffect, useState } from "react";
import { t } from "ttag";

import { useToast } from "metabase/common/hooks";
import {
  SettingsPageWrapper,
  SettingsSection,
} from "metabase/settings-components";
import {
  Button,
  Card,
  Code,
  Stack,
  Text,
  TextInput,
  Title,
} from "metabase/ui";

import { listSqlAgentSources } from "./api";
import {
  getSqlAgentBaseUrl,
  getSqlAgentMcpUrl,
  setSqlAgentBaseUrl,
} from "./sqlAgentSettings";
import type { SqlAgentSource } from "./types";

export function SqlAgentOverviewPage() {
  const [sendToast] = useToast();
  const [baseUrl, setBaseUrl] = useState(getSqlAgentBaseUrl());
  const [sources, setSources] = useState<SqlAgentSource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setSources(await listSqlAgentSources());
    } catch (err) {
      setSources([]);
      setError(
        err instanceof Error
          ? err.message
          : t`Unable to reach SQL Agent sidecar`,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <SettingsPageWrapper title={t`SQL Agent`}>
      <SettingsSection>
        <Stack gap="lg">
          <Text c="text-secondary">
            {t`SQL Agent keeps schema knowledge and hybrid retrieval (keyword + embedding). External agents generate SQL themselves via MCP; Metabase does not call a chat model here.`}
          </Text>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>{t`Sidecar endpoint`}</Title>
              <TextInput
                label={t`API base URL`}
                description={t`Go service that stores knowledge and runs retrieve_evidence`}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.currentTarget.value)}
              />
              <Button
                w="fit-content"
                onClick={() => {
                  setSqlAgentBaseUrl(baseUrl);
                  sendToast({ message: t`Saved SQL Agent URL` });
                  void refresh();
                }}
              >
                {t`Save`}
              </Button>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="sm">
              <Title order={4}>{t`Connection status`}</Title>
              <Text>
                MCP: <Code>{getSqlAgentMcpUrl()}</Code>
              </Text>
              {error ? (
                <Text c="error">{error}</Text>
              ) : (
                <Text>
                  {loading
                    ? t`Checking…`
                    : t`${sources.length} source(s) available`}
                </Text>
              )}
              {!loading && sources.length > 0 && (
                <Stack gap="xs">
                  {sources.map((source) => (
                    <Text key={source.id}>
                      {source.name} <Code>{source.id}</Code>
                    </Text>
                  ))}
                </Stack>
              )}
              <Button
                w="fit-content"
                variant="default"
                onClick={() => void refresh()}
              >
                {t`Refresh`}
              </Button>
            </Stack>
          </Card>
        </Stack>
      </SettingsSection>
    </SettingsPageWrapper>
  );
}
