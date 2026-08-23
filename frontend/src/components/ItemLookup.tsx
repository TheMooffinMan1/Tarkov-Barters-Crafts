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

  const activeItemId =
    selectedItemId && (blob.items[selectedItemId] || suggestions.some((item) => item.id === selectedItemId))
      ? selectedItemId
      : suggestions.length === 1
        ? suggestions[0].id
        : "";

  const detail = activeItemId ? lookupItem(blob, activeItemId, settings) : null;
  const bestTraderPrice = detail?.traderSell[0]?.priceRUB ?? 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (suggestions.length === 1) onSelectItem(suggestions[0].id);
    else if (suggestions.length > 1 && !selectedItemId) onSelectItem(suggestions[0].id);
  }

  return (
    <div className="lookup-page">
      <form className="lookup-search-wrap" onSubmit={handleSubmit}>
        <input
          className="search lookup-search"
          placeholder="Search by item name…"
          value={search}
          onChange={(event) => {
            onSearchChange(event.target.value);
            onSelectItem("");
          }}
          autoFocus
        />
        {query && suggestions.length > 1 ? (
          <ul className="lookup-suggestions" role="listbox">
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`lookup-suggestion ${selectedItemId === item.id ? "active" : ""}`}
                  onClick={() => onSelectItem(item.id)}
                >
                  <ItemStack name={item.name} shortName={item.shortName} iconLink={item.iconLink} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {query && !suggestions.length ? <p className="muted lookup-hint">No items match that search.</p> : null}
        {query && suggestions.length > 1 && !selectedItemId ? (
          <p className="muted lookup-hint">{suggestions.length} matches — pick one above or press Enter for the first.</p>
        ) : null}
      </form>

      <div className="lookup-detail">
        {!query ? (
          <p className="muted lookup-empty">Search for an item to see trader prices, flea value, and hideout or quest requirements.</p>
        ) : !detail ? (
          <p className="muted lookup-empty">Select a matching item to view details.</p>
        ) : (
          <>
            <section className="lookup-section">
              <ItemStack
                name={detail.item.name}
                shortName={detail.item.shortName}
                iconLink={detail.item.iconLink}
                subtitle={
                  <span className="lookup-grid">
                    {detail.item.width && detail.item.height
                      ? `${detail.item.width}×${detail.item.height} (${detail.slots} slot${detail.slots === 1 ? "" : "s"})`
                      : `${detail.slots} slot${detail.slots === 1 ? "" : "s"}`}
                  </span>
                }
              />
            </section>

            <section className="lookup-section">
              <h2 className="lookup-heading">Sell to trader</h2>
              {detail.traderSell.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Trader</th>
                        <th>Level</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.traderSell.map((offer) => (
                        <tr
                          key={`${offer.traderId}:${offer.minTraderLevel}:${offer.priceRUB}`}
                          className={
                            offer.priceRUB === bestTraderPrice ? "lookup-best" : offer.locked ? "lookup-locked" : ""
                          }
                        >
                          <td>
                            {offer.traderName}
                            {offer.locked ? <span className="badge-locked">Locked</span> : null}
                          </td>
                          <td>LL{offer.minTraderLevel}</td>
                          <td>{formatRoubles(offer.priceRUB)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No trader will buy this item.</p>
              )}
            </section>

            <section className="lookup-section">
              <h2 className="lookup-heading">Sell on flea</h2>
              {!detail.flea.canSell ? (
                <p className="lookup-blocked">{detail.flea.blockedReason || "Cannot be sold on flea"}</p>
              ) : (
                <>
                  {detail.flea.blockedReason ? (
                    <p className="lookup-blocked">{detail.flea.blockedReason}</p>
                  ) : null}
                  <p className="lookup-note">Requires PMC level {detail.flea.minPlayerLevel}</p>
                  <div className="lookup-price-grid">
                    <div className="lookup-price-card">
                      <span className="lookup-price-label">Last low</span>
                      <strong>{detail.flea.lastLow > 0 ? formatRoubles(detail.flea.lastLow) : "—"}</strong>
                      {detail.flea.lastLow > 0 ? (
                        <span className="lookup-price-sub">
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
                    <div className="lookup-price-card">
                      <span className="lookup-price-label">24h average</span>
                      <strong>{detail.flea.avg24h > 0 ? formatRoubles(detail.flea.avg24h) : "—"}</strong>
                      {detail.flea.avg24h > 0 ? (
                        <span className="lookup-price-sub">
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

            <section className="lookup-section">
              <h2 className="lookup-heading">Hideout requirements</h2>
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
                <p className="muted">Not required for hideout construction.</p>
              )}
            </section>

            <section className="lookup-section">
              <h2 className="lookup-heading">Quest requirements</h2>
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
                <p className="muted">Not required for quests.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
