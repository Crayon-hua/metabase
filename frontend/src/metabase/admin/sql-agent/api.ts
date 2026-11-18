import { getSqlAgentBaseUrl } from "./sqlAgentSettings";
import type {
  SqlAgentCatalogResponse,
  SqlAgentKnowledge,
  SqlAgentSource,
} from "./types";

function extractError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.error === "string" && record.error) {
      return record.error;
    }
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
  }
  return `HTTP ${status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getSqlAgentBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(extractError(data, response.status));
  }

  return data as T;
}

export function listSqlAgentSources() {
  return requestJson<SqlAgentSource[]>("/api/sources");
}

export function getSqlAgentCatalog(sourceId: string) {
  return requestJson<SqlAgentCatalogResponse>(
    `/api/sources/${encodeURIComponent(sourceId)}/catalog`,
  );
}

export function syncSqlAgentCatalog(sourceId: string) {
  return requestJson<SqlAgentCatalogResponse>(
    `/api/sources/${encodeURIComponent(sourceId)}/sync`,
    { method: "POST", body: "{}" },
  );
}

export function saveSqlAgentKnowledge(
  sourceId: string,
  revision: number,
  knowledge: SqlAgentKnowledge,
) {
  return requestJson<SqlAgentCatalogResponse>(
    `/api/sources/${encodeURIComponent(sourceId)}/knowledge`,
    {
      method: "PUT",
      body: JSON.stringify({ revision, knowledge }),
    },
  );
}
