import { useState, type MouseEvent } from "react";
import { t } from "ttag";

import { copyTextToClipboard } from "metabase/common/utils/clipboard";
import { ActionIcon, Icon, Tooltip } from "metabase/ui";

type CopyableElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * The record form of a Mantine field's `classNames`. `CopyText*` fields merge
 * their own module classes into the caller's, which the function form (the
 * other half of Mantine's union) cannot express.
 */
export type CopyTextFieldClassNames<Props extends { classNames?: unknown }> =
  Exclude<Props["classNames"], (...args: never[]) => unknown>;

export type CopyTextFieldOptions<E extends CopyableElement> = {
  value: string;
  readOnly?: boolean;
  onClick?: (event: MouseEvent<E>) => void;
  onCopied?: () => void;
};

const DEFAULT_READ_ONLY = true;

function CopyFieldButton({
  value,
  onCopied,
}: {
  value: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(value);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    onCopied?.();
  };

  return (
    <Tooltip label={t`Copied!`} opened={copied}>
      <ActionIcon
        variant="subtle"
        aria-label={t`Copy`}
        data-testid="copy-button"
        onClick={() => void handleCopy()}
      >
        <Icon name="copy" />
      </ActionIcon>
    </Tooltip>
  );
}

export function getCopyTextFieldProps<E extends CopyableElement>({
  value,
  readOnly,
  onClick,
  onCopied,
}: CopyTextFieldOptions<E>) {
  const isReadOnly = readOnly ?? DEFAULT_READ_ONLY;

  return {
    readOnly: isReadOnly,
    onClick: (event: MouseEvent<E>) => {
      if (isReadOnly) {
        event.currentTarget.setSelectionRange(
          0,
          event.currentTarget.value.length,
        );
      }
      onClick?.(event);
    },
    rightSectionPointerEvents: "all" as const,
    rightSection: value ? (
      <CopyFieldButton value={value} onCopied={onCopied} />
    ) : undefined,
  };
}
