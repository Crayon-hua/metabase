/** External Whaee Agent (marketing-style chatbox iframe SSO). */

export const EXTERNAL_AGENT_NAME = "Whaee Agent";

export type ExternalAgentConfig = {
  enabled: boolean;
  ui_origin: string;
  ui_base: string;
  agent_id: string;
};

export type ExternalAgentIframeToken = {
  token: string;
  expires_in: number;
};

export type ExternalAgentSettings = ExternalAgentConfig & {
  api_base: string;
  api_key_configured: boolean;
};

/** Build chatbox URL; short token only in hash (same as marketing ResearchChatFrame). */
export function buildExternalAgentChatboxSrc(
  config: ExternalAgentConfig,
  token: string,
  chatId?: string | null,
) {
  const origin = config.ui_origin.replace(/\/$/, "");
  const base = config.ui_base || "";
  const path = chatId
    ? `/chatbox/${encodeURIComponent(chatId)}`
    : "/chatbox";
  const query = new URLSearchParams();
  if (!chatId && config.agent_id) {
    query.set("aid", config.agent_id);
  }
  const qs = query.toString();
  return `${origin}${base}${path}${qs ? `?${qs}` : ""}#token=${encodeURIComponent(token)}`;
}
