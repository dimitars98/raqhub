import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleX, Pencil, Trash2 } from "lucide-react";

// The one look for Edit / Delete / Cancel / Remove / Withdraw across the app
// (styles in app/globals.css, .action*). Grey for editing, red for removing
// or cancelling, green for turning something back on.
//
//   <EditButton onClick={…}>{t("edit")}</EditButton>
//   <DeleteButton onClick={…}>{t("delete")}</DeleteButton>
//   <CancelActionButton onClick={…}>{t("cancelBooking")}</CancelActionButton>
//   <DeleteButton iconOnly aria-label={t("remove")} onClick={…} />
//
// Closing a dialog stays a "btn-secondary" Cancel; confirming something that
// can't be undone in a dialog is "btn-danger".

export type ActionTone = "neutral" | "danger" | "positive";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ActionTone;
  icon?: ReactNode;
  /** Only the icon (give it an aria-label). */
  iconOnly?: boolean;
  /** Bigger padding, e.g. full-width buttons on phone cards. */
  large?: boolean;
};

export function ActionButton({
  tone = "neutral",
  icon,
  iconOnly = false,
  large = false,
  className = "",
  type = "button",
  children,
  ...props
}: Props) {
  const classes = [
    "action",
    `action-${tone}`,
    iconOnly ? "action-icon" : "",
    large && !iconOnly ? "action-lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={classes} {...props}>
      {icon}
      {!iconOnly && children}
    </button>
  );
}

type Preset = Omit<Props, "tone" | "icon">;
const iconSize = (iconOnly?: boolean) => (iconOnly ? 14 : 12);

/** Edit something: grey, pencil. */
export const EditButton = (props: Preset) => (
  <ActionButton tone="neutral" icon={<Pencil size={iconSize(props.iconOnly)} aria-hidden="true" />} {...props} />
);

/** Delete or remove something: red, bin. */
export const DeleteButton = (props: Preset) => (
  <ActionButton tone="danger" icon={<Trash2 size={iconSize(props.iconOnly)} aria-hidden="true" />} {...props} />
);

/** Cancel, withdraw or clear (the thing stays, but is called off): red, crossed circle. */
export const CancelActionButton = (props: Preset) => (
  <ActionButton tone="danger" icon={<CircleX size={iconSize(props.iconOnly)} aria-hidden="true" />} {...props} />
);
