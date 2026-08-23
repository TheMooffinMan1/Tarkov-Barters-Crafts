import { useEffect, useMemo } from "react";
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
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
};

const RESULT_LIMIT = 100;

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

export function ItemLookup({ blob, settings, search, selectedItemId, onSelectItem }: Props) {
  const query = normalizeQuery(search);

  const results = useMemo(() => {
    const items = Object.values(blob.items) as SlimItem[];
    if (!query) return items.sort((a, b) => a.name.localeCompare(b.name)).slice(0, RESULT_LIMIT);
    return items
      .filter((item) => (item.search || "").includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, RESULT_LIMIT);
  }, [blob.items, query]);

  useEffect(() => {
    if (!results.length) {
      if (selectedItemId) onSelectItem("");
      return;
    }
    if (!selectedItemId || !results.some((item) => item.id === selectedItemId)) {
      onSelectItem(results[0].id);
    }
  }, [results, selectedItemId, onSelectItem]);

  const detail = selectedItemId ? lookupItem(blob, selectedItemId, settings) : null;
  const bestTraderPrice = detail?.traderSell[0]?.priceRUB ?? 0;

  return (
    <div className="lookup-layout">
      <div className="lookup-results">
        <div className="table-meta">
          {query
            ? `${results.length}${results.length >= RESULT_LIMIT ? "+" : ""} matches`
            : `${Object.keys(blob.items).length} items`}
        </div>
        <div className="lookup-results-list">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lookup-row ${selectedItemId === item.id ? "active" : ""}`}
              onClick={() => onSelectItem(item.id)}
            >
              <ItemStack name={item.name} shortName={item.shortName} iconLink={item.iconLink} />
            </button>
          ))}
          {!results.length ? <p className="muted lookup-empty">No items match your search.</p> : null}
        </div>
      </div>

      <div className="lookup-detail">
        {!detail ? (
          <p className="muted lookup-empty">Search for an item to see prices and requirements.</p>
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
                        <tr key={`${offer.traderId}:${offer.minTraderLevel}:${offer.priceRUB}`} className={offer.priceRUB === bestTraderPrice ? "lookup-best" : offer.locked ? "lookup-locked" : ""}>
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
