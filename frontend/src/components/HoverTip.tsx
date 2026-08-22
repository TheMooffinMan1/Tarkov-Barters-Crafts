import type { ReactNode } from "react";

type HoverTipProps = {
  label: ReactNode;
  detail: string;
  className?: string;
};

export function HoverTip({ label, detail, className }: HoverTipProps) {
  return (
    <span className={["hover-tip", className].filter(Boolean).join(" ")}>
      {label}
      <span className="hover-tip-popup" role="tooltip">
        {detail}
      </span>
    </span>
  );
}
