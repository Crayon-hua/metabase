import { api } from "metabase/api/client";

import type {
  EmbeddingSettings,
  QueryKnowledgeBody,
  QueryKnowledgeState,
} from "./types";

function extractError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error) {
      return record.error;
    }
    if (record.data && typeof record.data === "object") {
      const data = record.data as Record<string, unknown>;
      if (typeof data.message === "string") {
        return data.message;
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败";
}

async function requestJson<T>(args: {
  method: "GET" | "PUT" | "POST";
  url: string;
  body?: unknown;
}): Promise<T> {
  try {
    return (await api.request({
      method: args.method,
      url: args.url,
      body: args.body,
      retry: args.method === "GET",
    })) as T;
  } catch (error) {
    throw new Error(extractError(error));
  }
}

export function getQueryKnowledge(databaseId: number) {
  return requestJson<QueryKnowledgeState>({
    method: "GET",
    url: `/api/query-knowledge/${databaseId}`,
  });
}

export function saveQueryKnowledge(
  databaseId: number,
  revision: number,
  knowledge: QueryKnowledgeBody,
  reindex = false,
) {
  return requestJson<QueryKnowledgeState>({
    method: "PUT",
    url: `/api/query-knowledge/${databaseId}`,
    body: { revision, knowledge, reindex },
  });
}

export function reindexQueryKnowledge(databaseId: number) {
  return requestJson<QueryKnowledgeState>({
    method: "POST",
    url: `/api/query-knowledge/${databaseId}/reindex`,
  });
}

export function getEmbeddingSettings() {
  return requestJson<EmbeddingSettings>({
    method: "GET",
    url: "/api/query-knowledge/embedding-settings",
  });
}

export function saveEmbeddingSettings(settings: {
  base_url?: string;
  model?: string;
  api_key?: string;
}) {
  return requestJson<EmbeddingSettings>({
    method: "PUT",
    url: "/api/query-knowledge/embedding-settings",
    body: settings,
  });
}
