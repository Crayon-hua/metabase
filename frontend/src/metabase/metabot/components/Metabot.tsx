import { useCallback, useEffect, useRef, useState } from "react";
import { tinykeys } from "tinykeys";
import { t } from "ttag";

import { getUser } from "metabase/current-user";
import {
  useIsFullPageMetabot,
  useMetabotAgent,
} from "metabase/metabot/hooks";
import { Sidebar } from "metabase/nav/containers/MainNavbar/MainNavbar.styled";
import { useSelector } from "metabase/redux";
import type { SuggestionModel } from "metabase/rich_text_editing/tiptap/extensions/shared/types";
import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Icon,
  Loader,
  Text,
} from "metabase/ui";

import { trackMetabotChatOpened } from "../analytics";
import {
  buildExternalAgentChatboxSrc,
  EXTERNAL_AGENT_NAME,
  type ExternalAgentConfig,
} from "../externalAgent";
import {
  getExternalAgentConfig,
  issueExternalAgentIframeToken,
} from "../externalAgentApi";
import type { MetabotAgentId } from "../state";

export interface MetabotChatConfig {
  suggestionModels: SuggestionModel[];
}

export interface MetabotConfig extends MetabotChatConfig {
  agentId: MetabotAgentId;
}

export interface MetabotProps {
  hide?: boolean;
  config?: MetabotConfig;
}

type ChatboxEvent = {
  source: "iframe-chatbox";
  v: number;
  type: string;
  chatId?: string;
};

export const MetabotAuthenticated = ({ hide, config }: MetabotProps) => {
  const agentId = config?.agentId ?? "omnibot";
  const { visible, setVisible } = useMetabotAgent(agentId);
  const isFullPageMetabot = useIsFullPageMetabot();

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const knownChatIdRef = useRef<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<ExternalAgentConfig | null>(
    null,
  );
  const [iframeSrc, setIframeSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mountChatbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cfg = agentConfig ?? (await getExternalAgentConfig());
      setAgentConfig(cfg);
      if (!cfg.enabled) {
        setIframeSrc("");
        setError(
          t`未配置 Agent iframe SSO。请在「知识配置」中填写 API Base、API Key、Agent ID。`,
        );
        return;
      }
      const { token } = await issueExternalAgentIframeToken();
      setIframeSrc(
        buildExternalAgentChatboxSrc(cfg, token, knownChatIdRef.current),
      );
    } catch (err) {
      setIframeSrc("");
      setError(err instanceof Error ? err.message : t`无法连接 Agent`);
    } finally {
      setLoading(false);
    }
  }, [agentConfig]);

  useEffect(() => {
    return tinykeys(window, {
      "$mod+e": (e) => {
        e.preventDefault();
        if (isFullPageMetabot) {
          return;
        }
        if (!visible) {
          trackMetabotChatOpened("keyboard_shortcut");
        }
        setVisible(!visible);
      },
    });
  }, [visible, setVisible, isFullPageMetabot]);

  useEffect(
    function closeViaPropChange() {
      if (hide) {
        setVisible(false);
      }
    },
    [hide, setVisible],
  );

  useEffect(() => {
    if (visible && !hide) {
      void mountChatbox();
    }
  }, [visible, hide, mountChatbox]);

  useEffect(() => {
    if (!visible || !agentConfig) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== agentConfig.ui_origin) {
        return;
      }
      if (frameRef.current && event.source !== frameRef.current.contentWindow) {
        return;
      }
      const data = event.data as ChatboxEvent | undefined;
      if (!data || data.source !== "iframe-chatbox" || data.v !== 1) {
        return;
      }
      if (data.type === "auth.expired") {
        void mountChatbox();
      }
      if (data.type === "chat.created" && data.chatId) {
        knownChatIdRef.current = data.chatId;
      }
      if (data.type === "ready") {
        setLoading(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [visible, agentConfig, mountChatbox]);

  if (!visible || hide) {
    return null;
  }

  return (
    <Sidebar isOpen={visible} side="right" width="40rem" aria-hidden={!visible}>
      <Flex
        direction="column"
        h="100%"
        bg="bg-white"
        data-testid="external-agent-sidebar"
      >
        <Flex
          align="center"
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderBottom: "1px solid var(--mb-color-border)" }}
        >
          <Text fw="bold">{EXTERNAL_AGENT_NAME}</Text>
          <ActionIcon
            onClick={() => setVisible(false)}
            aria-label={t`Close`}
            data-testid="metabot-close-chat"
          >
            <Icon c="text-primary" name="close" />
          </ActionIcon>
        </Flex>
        <Box flex="1" mih={0} pos="relative">
          {iframeSrc && (
            <Box
              component="iframe"
              ref={frameRef}
              key={iframeSrc}
              title={EXTERNAL_AGENT_NAME}
              src={iframeSrc}
              w="100%"
              h="100%"
              style={{ border: "none", display: "block" }}
              allow="clipboard-write"
              onLoad={() => {
                // Platform may not send ready; don't spin forever.
                window.setTimeout(() => setLoading(false), 800);
              }}
            />
          )}
          {(loading || error) && (
            <Flex
              pos="absolute"
              inset={0}
              align="center"
              justify="center"
              direction="column"
              gap="md"
              bg="bg-white"
              p="lg"
              style={{ opacity: iframeSrc && !error ? 0.92 : 1 }}
            >
              {error ? (
                <>
                  <Text c="error" ta="center">
                    {error}
                  </Text>
                  <Button onClick={() => void mountChatbox()}>{t`重试`}</Button>
                </>
              ) : (
                <>
                  <Loader />
                  <Text c="text-secondary">{t`正在连接 Agent…`}</Text>
                </>
              )}
            </Flex>
          )}
        </Box>
      </Flex>
    </Sidebar>
  );
};

export const Metabot = (props: MetabotProps) => {
  const currentUser = useSelector(getUser);

  // NOTE: do not render Metabot if the user is not authenticated.
  // doing so will cause a redirect for unauthenticated requests
  // which will break interactive embedding. See (metabase#58687).
  if (!currentUser) {
    return null;
  }

  return <MetabotAuthenticated {...props} />;
};
