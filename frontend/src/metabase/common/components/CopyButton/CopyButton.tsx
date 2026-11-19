import cx from "classnames";
import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "ttag";

import { copyTextToClipboard } from "metabase/common/utils/clipboard";
import Styles from "metabase/css/core/index.css";
import visuallyHidden from "metabase/css/core/visually-hidden.module.css";
import { Icon, Text, Tooltip, UnstyledButton } from "metabase/ui";

import S from "./CopyButton.module.css";

export const COPY_BUTTON_ICON = <Icon name="copy" aria-hidden />;

type CopyButtonProps = {
  value: string;
  onCopy?: () => void;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  target?: ReactNode;
};

export const CopyButton = ({
  value,
  onCopy,
  className = Styles.textBrandHover,
  style,
  "aria-label": ariaLabel,
  target,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const accessibleName = ariaLabel ?? (target ? undefined : t`Copy`);

  const handleClick = async () => {
    const ok = await copyTextToClipboard(value);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <>
      <Tooltip
        label={<Text fw={700} c="inherit">{t`Copied!`}</Text>}
        opened={copied}
      >
        <UnstyledButton
          className={cx(S.CopyButton, className)}
          data-testid="copy-button"
          aria-label={accessibleName}
          onClick={() => void handleClick()}
          style={style}
        >
          {target ?? COPY_BUTTON_ICON}
        </UnstyledButton>
      </Tooltip>
      <span role="status" className={visuallyHidden.visuallyHidden}>
        {copied ? t`Copied!` : ""}
      </span>
    </>
  );
};
