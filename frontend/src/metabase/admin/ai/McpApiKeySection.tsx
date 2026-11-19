import { useState } from "react";
import { t } from "ttag";

import { CreateApiKeyModal } from "metabase/admin/settings/components/ApiKeys/CreateApiKeyModal";
import { CopyTextInput } from "metabase/common/components/CopyTextInput";
import { Link } from "metabase/common/components/Link";
import { SettingHeader } from "metabase/settings-components";
import { Box, Button, Group, Stack, Text } from "metabase/ui";

/**
 * Machine-client auth for /api/metabase-mcp via Metabase API keys.
 * Interactive OAuth clients continue to use the normal consent flow.
 */
export function McpApiKeySection() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Box>
      <SettingHeader
        id="mcp-api-key"
        title={t`API key for external MCP`}
        description={t`为 Agent / 脚本等无浏览器客户端生成 API Key。请求时带上 X-Api-Key: mb_…，或 Authorization: Bearer mb_…。交互式客户端仍可走 OAuth。`}
      />
      <Stack gap="md" mt="lg">
        <Group>
          <Button variant="filled" onClick={() => setCreateOpen(true)}>
            {t`Create API key`}
          </Button>
          <Button
            component={Link}
            to="/admin/settings/authentication/api-keys"
            variant="default"
          >
            {t`Manage API keys`}
          </Button>
        </Group>
        <Box>
          <Text size="sm" c="text-secondary" mb="xs">
            {t`Header example`}
          </Text>
          <CopyTextInput
            value="X-Api-Key: mb_your_key_here"
            readOnly
            c="text-primary"
          />
        </Box>
        <Text size="sm" c="text-secondary">
          {t`Key 所属权限组决定可访问的数据与 MCP 工具；请选具备所需库表权限的组。`}
        </Text>
      </Stack>
      {createOpen && (
        <CreateApiKeyModal onClose={() => setCreateOpen(false)} />
      )}
    </Box>
  );
}
