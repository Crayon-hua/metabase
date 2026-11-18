import { AdminSettingsLayout } from "metabase/admin/components/AdminLayout/AdminSettingsLayout";
import ErrorBoundary from "metabase/common/components/ErrorBoundary";
import { Outlet } from "metabase/router";

import { SqlAgentNavPane } from "./SqlAgentNavPane";

export const SqlAgentAdminLayout = ({
  children = <Outlet />,
}: {
  children?: React.ReactNode;
}) => (
  <AdminSettingsLayout sidebar={<SqlAgentNavPane />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </AdminSettingsLayout>
);
