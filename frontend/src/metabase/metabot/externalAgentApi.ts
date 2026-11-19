import { api } from "metabase/api/client";

import type {
  ExternalAgentConfig,
  ExternalAgentIframeToken,
  ExternalAgentSettings,
} from "./externalAgent";

function extractError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      return record.message;
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

export function getExternalAgentConfig() {
  return requestJson<ExternalAgentConfig>({
    method: "GET",
    url: "/api/external-agent/config",
  });
}

export function issueExternalAgentIframeToken() {
  return requestJson<ExternalAgentIframeToken>({
    method: "POST",
    url: "/api/external-agent/iframe-token",
  });
}

export function getExternalAgentSettings() {
  return requestJson<ExternalAgentSettings>({
    method: "GET",
    url: "/api/external-agent/settings",
  });
}

export function saveExternalAgentSettings(settings: {
  api_base?: string;
  ui_origin?: string;
  ui_base?: string;
  api_key?: string;
  agent_id?: string;
}) {
  return requestJson<ExternalAgentSettings>({
    method: "PUT",
    url: "/api/external-agent/settings",
    body: settings,
  });
}
