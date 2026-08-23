import { useMemo } from "react";
import type { FormEvent } from "react";
import { lookupItem, type ProfitBlob, type Settings } from "@compute/index.mjs";
import { formatQty, formatRoubles } from "../lib/format";
import { ItemStack } from "./ItemStack";
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

  const displayItemId = hasPinnedItem
    ? selectedItemId
    : query && suggestions.length === 1
      ? suggestions[0].id
      : "";

  const isDetailView = Boolean(displayItemId);
  const awaitingPick = Boolean(!hasPinnedItem && query && suggestions.length > 1);
  const showDetailDropdown = Boolean(hasPinnedItem && query);
  const detail = displayItemId ? lookupItem(blob, displayItemId, settings) : null;
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

  if (isDetailView && detail) {
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
          <form className="lookup-detail-search" onSubmit={handleSubmit}>
            <input
              className="lookup-search"
              placeholder="Search another item…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {showDetailDropdown ? (
              <div className="lookup-search-dropdown">
                {suggestions.length ? (
                  <ul className="lookup-suggestions" role="listbox">
                    {suggestions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="lookup-suggestion"
                          onClick={() => selectItem(item.id)}
                        >
                          <ItemStack name={item.name} shortName={item.shortName} iconLink={item.iconLink} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lookup-dropdown-empty">No items match that search.</p>
                )}
              </div>
            ) : null}
          </form>
        </header>

        <div className="lookup-hero">
          <div className="lookup-hero-icon">
            {detail.item.iconLink ? (
              <img src={detail.item.iconLink} alt="" width={96} height={96} loading="lazy" decoding="async" />
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
                <p className="lookup-note">Requires PMC level {detail.flea.minPlayerLevel}</p>
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
              <ul className="lookup-ref-list">
                {detail.refs.quests.map((row) => (
                  <li key={`${row.taskId}:${row.type}:${row.count}:${row.foundInRaid}`}>
                    <span>
                      {row.taskName}
                      {row.traderName ? ` (${row.traderName})` : ""} — {QUEST_TYPE_LABEL[row.type] || row.type} ×
                      {formatQty(row.count)}
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
      <form className="lookup-search-stage" onSubmit={handleSubmit}>
        <label className="lookup-search-label" htmlFor="item-lookup-search">
          Find an item
        </label>
        <input
          id="item-lookup-search"
          className="lookup-search lookup-search--hero"
          placeholder="Search by item name…"
          value={search}
          onChange={(event) => {
            onSearchChange(event.target.value);
            onSelectItem("");
          }}
          autoFocus
        />
        {awaitingPick ? (
          <ul className="lookup-suggestions" role="listbox">
            {suggestions.map((item) => (
              <li key={item.id}>
                <button type="button" className="lookup-suggestion" onClick={() => selectItem(item.id)}>
                  <ItemStack name={item.name} shortName={item.shortName} iconLink={item.iconLink} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!query ? (
          <p className="lookup-empty">Search for trader prices, flea value, and hideout or quest requirements.</p>
        ) : !suggestions.length ? (
          <p className="lookup-empty">No items match that search.</p>
        ) : awaitingPick ? (
          <p className="lookup-hint">{suggestions.length} matches — pick one or press Enter for the first.</p>
        ) : null}
      </form>
    </div>
  );
}
