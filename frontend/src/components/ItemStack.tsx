import { formatRoubles } from "../lib/format";

type Props = {
  name: string;
  shortName?: string;
  iconLink?: string;
  count?: number;
  subtitle?: string;
  tool?: boolean;
  price?: number | null;
  source?: string;
  /** When true, 0 / no-source prices show "Cannot be bought" instead of 0 ₽. */
  asInput?: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  flea: "Flea",
  trader: "Trader",
  craft: "Crafted",
  barter: "Bartered",
  none: "No price",
};

export function ItemStack({ name, shortName, iconLink, count = 1, subtitle, tool, price, source, asInput }: Props) {
  const unbuyable = Boolean(asInput && (source === "none" || price === 0));
  const sourceLabel = !unbuyable && source && source !== "none" ? SOURCE_LABEL[source] || source : "";
  return (
    <div className={`item-stack ${tool ? "is-tool" : ""}`}>
      {iconLink ? (
        <span className="item-icon">
          <img
            src={iconLink}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        </span>
      ) : (
        <span className="item-icon item-fallback" />
      )}
      <div className="item-copy">
        <div className="item-name">
          {count > 1 ? <span className="qty">×{count}</span> : null}
          {name}
          {tool ? <ToolIcon /> : null}
        </div>
        {price != null || sourceLabel || subtitle || unbuyable ? (
          <div className="item-sub">
            {unbuyable ? (
              <span className="item-unbuyable">Cannot be bought</span>
            ) : (
              <>
                {price != null ? <span className="item-price">{formatRoubles(price)}</span> : null}
                {sourceLabel ? <span className="item-source">{sourceLabel}</span> : null}
              </>
            )}
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolIcon() {
  return (
    <svg className="tool-icon" viewBox="0 0 24 24" width="15" height="15" aria-label="Returned tool" role="img">
      <title>Returned tool</title>
      <path
        fill="currentColor"
        d="M22.7 19.4 13.6 10.3a6 6 0 0 0-8.1-7.9l3.8 3.8-2.8 2.8-3.8-3.8A6 6 0 0 0 10.3 13.6l9.1 9.1c.6.6 1.5.6 2.1 0l1.2-1.2c.6-.6.6-1.5 0-2.1Z"
      />
    </svg>
  );
}
