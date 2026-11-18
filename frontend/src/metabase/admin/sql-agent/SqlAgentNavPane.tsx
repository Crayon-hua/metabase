import { t } from "ttag";

import {
  AdminNavItem,
  AdminNavWrapper,
} from "metabase/admin/components/AdminNav";
import { Flex } from "metabase/ui";

export function SqlAgentNavPane() {
  return (
    <Flex direction="column" flex="0 0 auto">
      <AdminNavWrapper>
        <AdminNavItem
          icon="bolt"
          label={t`Overview`}
          path="/admin/sql-agent"
        />
        <AdminNavItem
          icon="table"
          label={t`Knowledge`}
          path="/admin/sql-agent/workbench"
        />
        <AdminNavItem
          icon="mcp"
          label={t`MCP`}
          path="/admin/sql-agent/mcp"
        />
      </AdminNavWrapper>
    </Flex>
  );
}
