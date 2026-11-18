const STORAGE_KEY = "metabase.sql-agent.sidecar-base-url";

export function getSqlAgentBaseUrl() {
  return (
    localStorage.getItem(STORAGE_KEY)?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
}

export function setSqlAgentBaseUrl(url: string) {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ""));
}

export function getSqlAgentMcpUrl() {
  return `${getSqlAgentBaseUrl()}/mcp`;
}
