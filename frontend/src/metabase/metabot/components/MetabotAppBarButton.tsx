import { t } from "ttag";

import { getUser } from "metabase/current-user";
import {
  useIsFullPageMetabot,
  useMetabotAgent,
} from "metabase/metabot/hooks";
import { useSelector } from "metabase/redux";
import { ActionIcon, type ActionIconProps, Tooltip } from "metabase/ui";
import { METAKEY } from "metabase/utils/browser";

import { trackMetabotChatOpened } from "../analytics";
import { EXTERNAL_AGENT_NAME } from "../externalAgent";

import { MetabotIcon } from "./MetabotIcon";

interface MetabotAppBarButtonProps extends ActionIconProps {
  className?: string;
}

export function MetabotAppBarButton({
  className,
  ...rest
}: MetabotAppBarButtonProps) {
  const currentUser = useSelector(getUser);
  const metabot = useMetabotAgent("omnibot");
  const isFullPageMetabot = useIsFullPageMetabot();

  if (!currentUser) {
    return null;
  }

  const handleClick = () => {
    if (!metabot.visible) {
      trackMetabotChatOpened("header");
    }

    metabot.setVisible(!metabot.visible);
  };

  const label = t`Chat with ${EXTERNAL_AGENT_NAME} (${METAKEY}+E)`;

  return (
    <Tooltip label={label}>
      <ActionIcon
        className={className}
        variant="subtle"
        c={isFullPageMetabot ? "text-disabled" : "text-primary"}
        opacity={isFullPageMetabot ? 0.5 : undefined}
        bd="1px solid var(--mb-color-border-neutral)"
        p="sm"
        h="2rem"
        w="2rem"
        aria-label={label}
        onClick={handleClick}
        {...rest}
        disabled={isFullPageMetabot}
      >
        <MetabotIcon />
      </ActionIcon>
    </Tooltip>
  );
}
