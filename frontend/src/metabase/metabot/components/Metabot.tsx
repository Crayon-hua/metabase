import { useEffect } from "react";
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
import { ActionIcon, Box, Flex, Icon, Text } from "metabase/ui";

import { trackMetabotChatOpened } from "../analytics";
import {
  EXTERNAL_AGENT_NAME,
  EXTERNAL_AGENT_URL,
} from "../externalAgent";
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

export const MetabotAuthenticated = ({ hide, config }: MetabotProps) => {
  const agentId = config?.agentId ?? "omnibot";
  const { visible, setVisible } = useMetabotAgent(agentId);
  const isFullPageMetabot = useIsFullPageMetabot();

  useEffect(() => {
    return tinykeys(window, {
      "$mod+e": (e) => {
        e.preventDefault(); // prevent FF from opening bookmark menu
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
          <Flex gap="sm" align="center">
            <ActionIcon
              component="a"
              href={EXTERNAL_AGENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t`在新窗口打开`}
              title={t`在新窗口打开（飞书登录如被屏蔽请用此入口）`}
            >
              <Icon c="text-primary" name="external" />
            </ActionIcon>
            <ActionIcon
              onClick={() => setVisible(false)}
              aria-label={t`Close`}
              data-testid="metabot-close-chat"
            >
              <Icon c="text-primary" name="close" />
            </ActionIcon>
          </Flex>
        </Flex>
        <Box flex="1" mih={0}>
          <Box
            component="iframe"
            title={EXTERNAL_AGENT_NAME}
            src={EXTERNAL_AGENT_URL}
            w="100%"
            h="100%"
            style={{ border: "none", display: "block" }}
          />
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
