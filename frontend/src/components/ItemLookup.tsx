import { useMemo } from "react";
import type { FormEvent, ReactNode } from "react";
import { lookupItem, type ProfitBlob, type Settings } from "@compute/index.mjs";
import { formatQty, formatRoubles } from "../lib/format";
import { HoverTip } from "./HoverTip";

type SlimItem = {
  id: string;
  name: string;
  shortName: string;
  iconLink?: string;
  width?: number;
  height?: number;
  search?: string;
};

type Props = {
  blob: ProfitBlob;
  settings: Settings;
  search: string;
  onSearchChange: (value: string) => void;
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
};

const SUGGESTION_LIMIT = 8;

const QUEST_TYPE_LABEL: Record<string, string> = {
  giveItem: "Hand over",
  findItem: "Find in raid",
  plantItem: "Plant",
  sellItem: "Sell",
  useItem: "Use",
};

function normalizeQuery(search: string) {
  return search.trim().toLowerCase().replace(/\s+/g, "");
}

function SuggestionDropdown({
  suggestions,
  query,
  onSelect,
}: {
  suggestions: SlimItem[];
  query: string;
  onSelect: (itemId: string) => void;
}) {
  if (!query) return null;

  return (
    <div className="lookup-search-dropdown" role="presentation">
      {suggestions.length ? (
        <ul className="lookup-suggestions" role="listbox">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button type="button" className="lookup-suggestion" onClick={() => onSelect(item.id)}>
                {item.iconLink ? (
                  <img
                    className="lookup-suggestion-icon"
                    src={item.iconLink}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="lookup-suggestion-icon lookup-suggestion-icon--fallback" />
                )}
                <span className="lookup-suggestion-copy">
                  <span className="lookup-suggestion-name">{item.name}</span>
                  {item.shortName !== item.name ? (
                    <span className="lookup-suggestion-short">{item.shortName}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lookup-dropdown-empty">No items match that search.</p>
      )}
    </div>
  );
}

function SearchField({
  id,
  className,
  placeholder,
  value,
  onChange,
  onSubmit,
  dropdown,
  autoFocus,
}: {
  id?: string;
  className?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  dropdown: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <div className="lookup-search-anchor">
      <form onSubmit={onSubmit}>
        <input
          id={id}
          className={className || "lookup-search"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      {dropdown}
    </div>
  );
}

export function ItemLookup({ blob, settings, search, onSearchChange, selectedItemId, onSelectItem }: Props) {
  const query = normalizeQuery(search);

  const suggestions = useMemo(() => {
    if (!query) return [];
    return (Object.values(blob.items) as SlimItem[])
      .filter((item) => (item.search || "").includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, SUGGESTION_LIMIT);
  }, [blob.items, query]);

  const hasPinnedItem = Boolean(selectedItemId && blob.items[selectedItemId]);
  const detail = hasPinnedItem ? lookupItem(blob, selectedItemId, settings) : null;
  const bestTraderPrice = detail?.traderSell[0]?.priceRUB ?? 0;

  function selectItem(itemId: string) {
    onSelectItem(itemId);
    onSearchChange("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (suggestions.length >= 1) selectItem(suggestions[0].id);
  }

  function handleBack() {
    onSelectItem("");
    onSearchChange("");
  }

  const suggestionDropdown = (
    <SuggestionDropdown suggestions={suggestions} query={query} onSelect={selectItem} />
  );

  if (hasPinnedItem && detail) {
    const slotLabel =
      detail.item.width && detail.item.height
        ? `${detail.item.width}×${detail.item.height} · ${detail.slots} slot${detail.slots === 1 ? "" : "s"}`
        : `${detail.slots} slot${detail.slots === 1 ? "" : "s"}`;

    return (
      <div className="lookup-page lookup-page--detail">
        <header className="lookup-detail-bar">
          <button type="button" className="lookup-back" onClick={handleBack}>
            ← Search
          </button>
          <SearchField
            className="lookup-search"
            placeholder="Search another item…"
            value={search}
            onChange={onSearchChange}
            onSubmit={handleSubmit}
            dropdown={suggestionDropdown}
          />
        </header>

        <div className="lookup-hero">
          <div className="lookup-hero-icon">
            {detail.item.gridImageLink || detail.item.iconLink ? (
              <img
                src={detail.item.gridImageLink || detail.item.iconLink}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="item-fallback" />
            )}
          </div>
          <div className="lookup-hero-copy">
            <h2 className="lookup-hero-name">{detail.item.name}</h2>
            <p className="lookup-hero-meta">
              {detail.item.shortName !== detail.item.name ? (
                <>
                  <span>{detail.item.shortName}</span>
                  <span className="lookup-hero-dot">·</span>
                </>
              ) : null}
              <span>{slotLabel}</span>
            </p>
          </div>
        </div>

        <div className="lookup-panels">
          <section className="lookup-panel">
            <h3 className="lookup-panel-title">Sell to trader</h3>
            {detail.traderSell.length ? (
              <ul className="lookup-trader-list">
                {detail.traderSell.map((offer) => (
                  <li
                    key={`${offer.traderId}:${offer.minTraderLevel}:${offer.priceRUB}`}
                    className={[
                      "lookup-trader-row",
                      offer.priceRUB === bestTraderPrice ? "is-best" : "",
                      offer.locked ? "is-locked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="lookup-trader-main">
                      <span className="lookup-trader-name">{offer.traderName}</span>
                      <span className="lookup-trader-level">LL{offer.minTraderLevel}</span>
                      {offer.locked ? <span className="badge-locked">Locked</span> : null}
                    </div>
                    <strong className="lookup-trader-price">{formatRoubles(offer.priceRUB)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lookup-panel-empty">No trader will buy this item.</p>
            )}
          </section>

          <section className="lookup-panel">
            <h3 className="lookup-panel-title">Sell on flea</h3>
            {!detail.flea.canSell ? (
              <p className="lookup-blocked">{detail.flea.blockedReason || "Cannot be sold on flea"}</p>
            ) : (
              <>
                {detail.flea.blockedReason ? (
                  <p className="lookup-blocked">{detail.flea.blockedReason}</p>
                ) : null}
                <p className="lookup-note">Level {detail.flea.minPlayerLevel}</p>
                <div className="lookup-flea-grid">
                  <div className="lookup-flea-stat">
                    <span className="lookup-flea-label">Last low</span>
                    <strong className="lookup-flea-value">
                      {detail.flea.lastLow > 0 ? formatRoubles(detail.flea.lastLow) : "—"}
                    </strong>
                    {detail.flea.lastLow > 0 ? (
                      <span className="lookup-flea-sub">
                        {formatRoubles(Math.round(detail.flea.lastLowPerSlot))} / slot
                      </span>
                    ) : null}
                    {detail.flea.lastLow > 0 && settings.includeFleaFee ? (
                      <HoverTip
                        className="lookup-fee-tip"
                        label={<span>Net {formatRoubles(Math.round(detail.flea.netLastLow))}</span>}
                        detail={`Fee ${formatRoubles(Math.round(detail.flea.feeLastLow))} with current IC/HM settings`}
                      />
                    ) : null}
                  </div>
                  <div className="lookup-flea-stat">
                    <span className="lookup-flea-label">24h average</span>
                    <strong className="lookup-flea-value">
                      {detail.flea.avg24h > 0 ? formatRoubles(detail.flea.avg24h) : "—"}
                    </strong>
                    {detail.flea.avg24h > 0 ? (
                      <span className="lookup-flea-sub">
                        {formatRoubles(Math.round(detail.flea.avg24hPerSlot))} / slot
                      </span>
                    ) : null}
                    {detail.flea.avg24h > 0 && settings.includeFleaFee ? (
                      <HoverTip
                        className="lookup-fee-tip"
                        label={<span>Net {formatRoubles(Math.round(detail.flea.netAvg24h))}</span>}
                        detail={`Fee ${formatRoubles(Math.round(detail.flea.feeAvg24h))} with current IC/HM settings`}
                      />
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="lookup-panel">
            <h3 className="lookup-panel-title">Hideout requirements</h3>
            {detail.refs.hideout.length ? (
              <ul className="lookup-ref-list">
                {detail.refs.hideout.map((row) => (
                  <li key={`${row.stationId}:${row.level}:${row.count}:${row.foundInRaid}`}>
                    <span>
                      {row.stationName} level {row.level} ×{formatQty(row.count)}
                    </span>
                    {row.foundInRaid ? <span className="badge-fir">FIR</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lookup-panel-empty">Not required for hideout construction.</p>
            )}
          </section>

          <section className="lookup-panel">
            <h3 className="lookup-panel-title">Quest requirements</h3>
            {detail.refs.quests.length ? (
              <ul className="lookup-ref-list lookup-quest-list">
                {detail.refs.quests.map((row) => (
                  <li key={`${row.taskId}:${row.type}:${row.count}:${row.foundInRaid}`}>
                    {row.traderImageLink ? (
                      <span className="lookup-quest-trader">
                        <img src={row.traderImageLink} alt="" width={40} height={40} loading="lazy" decoding="async" />
                        {row.traderLevel ? <span className="lookup-quest-ll">LL{row.traderLevel}</span> : null}
                      </span>
                    ) : null}
                    <span className="lookup-quest-copy">
                      <span className="lookup-quest-name">{row.taskName}</span>
                      <span className="lookup-quest-detail">
                        {row.traderName ? `${row.traderName} · ` : ""}
                        {QUEST_TYPE_LABEL[row.type] || row.type} ×{formatQty(row.count)}
                      </span>
                    </span>
                    {row.foundInRaid ? <span className="badge-fir">FIR</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lookup-panel-empty">Not required for quests.</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="lookup-page lookup-page--search">
      <div className="lookup-search-stage">
        <label className="lookup-search-label" htmlFor="item-lookup-search">
          Find an item
        </label>
        <SearchField
          id="item-lookup-search"
          className="lookup-search lookup-search--hero"
          placeholder="Search by item name…"
          value={search}
          onChange={(value) => {
            onSearchChange(value);
            onSelectItem("");
          }}
          onSubmit={handleSubmit}
          dropdown={suggestionDropdown}
          autoFocus
        />
        {!query ? (
          <p className="lookup-empty">Search for trader prices, flea value, and hideout or quest requirements.</p>
        ) : null}
      </div>
    </div>
  );
}
