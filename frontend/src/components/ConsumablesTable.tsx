import { useMemo, useState } from "react";
import type { ConsumableRow } from "@compute/index.mjs";
import { formatQty, formatRoubles } from "../lib/format";
import { ItemStack } from "./ItemStack";

type Props = {
  fuel: ConsumableRow[];
  filters: ConsumableRow[];
  search: string;
};

type SortKey = "pricePerUnit" | "totalCost" | "method";

function filterRows(rows: ConsumableRow[], search: string) {
  const q = search.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return rows;
  return rows.filter((row) => row.search.replace(/\s+/g, "").includes(q));
}

function sortRows(rows: ConsumableRow[], sortKey: SortKey, desc: boolean) {
  const copy = [...rows];
  copy.sort((a, b) => {
    let delta = 0;
    if (sortKey === "method") delta = a.methodLabel.localeCompare(b.methodLabel);
    else delta = a[sortKey] - b[sortKey];
    return desc ? -delta : delta;
  });
  return copy;
}

function Section({
  title,
  unitLabel,
  rows,
  search,
}: {
  title: string;
  unitLabel: string;
  rows: ConsumableRow[];
  search: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("pricePerUnit");
  const [desc, setDesc] = useState(false);

  const visible = useMemo(() => sortRows(filterRows(rows, search), sortKey, desc), [rows, search, sortKey, desc]);

  function toggleSort(next: SortKey) {
    if (sortKey === next) setDesc((value) => !value);
    else {
      setSortKey(next);
      setDesc(next === "pricePerUnit" ? false : true);
    }
  }

  const sortMark = (key: SortKey) => (sortKey === key ? (desc ? " ↓" : " ↑") : "");

  return (
    <section className="consumables-section">
      <h2 className="consumables-heading">{title}</h2>
      <div className="table-wrap">
        <div className="table-meta">
          {visible.length} method{visible.length === 1 ? "" : "s"}
          {visible.length !== rows.length ? ` / ${rows.length} total` : ""}
          {" · "}sorted by cheapest {unitLabel} first
        </div>
        <table>
          <thead>
            <tr>
              <th>You get</th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("method")}>
                  Method{sortMark("method")}
                </button>
              </th>
              <th>Cost / inputs</th>
              <th className="num">
                <button type="button" className="th-btn" onClick={() => toggleSort("totalCost")}>
                  Total cost{sortMark("totalCost")}
                </button>
              </th>
              <th className="num">
                <button type="button" className="th-btn" onClick={() => toggleSort("pricePerUnit")}>
                  ₽/{unitLabel}{sortMark("pricePerUnit")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row) => (
                <tr key={row.id} className={row.cheapest ? "consumable-best" : undefined}>
                  <td>
                    <ItemStack
                      name={row.itemName}
                      shortName={row.itemShortName}
                      iconLink={row.iconLink}
                      count={row.outputCount}
                      subtitle={
                        row.consumableKind === "fuel" ? (
                          <span className="item-source">{formatQty(row.resourceUnits)} fuel units</span>
                        ) : null
                      }
                    />
                  </td>
                  <td className="nowrap">
                    {row.methodLabel}
                    {row.buyLimit != null ? <span className="muted"> · limit {row.buyLimit}</span> : null}
                    {row.taskName ? <div className="muted">{row.taskName}</div> : null}
                  </td>
                  <td>
                    {row.method === "barter" ? (
                      <div className="item-list">
                        {row.costItems.map((line) => (
                          <ItemStack
                            key={`${row.id}:${line.id}:${line.tool}`}
                            name={line.name}
                            shortName={line.shortName}
                            iconLink={line.iconLink}
                            count={line.count}
                            tool={line.tool}
                            price={line.unit}
                            source={line.source}
                            asInput
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="muted">Direct purchase</span>
                    )}
                  </td>
                  <td className="num">{formatRoubles(row.totalCost)}</td>
                  <td className={`num ${row.cheapest ? "pos" : ""}`}>{formatRoubles(row.pricePerUnit)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="empty">
                  Nothing matches the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ConsumablesTable({ fuel, filters, search }: Props) {
  if (!fuel.length && !filters.length) {
    return <p className="empty">No fuel or filter prices available for this mode.</p>;
  }

  return (
    <div className="consumables">
      {fuel.length ? <Section title="Generator fuel" unitLabel="fuel unit" rows={fuel} search={search} /> : null}
      {filters.length ? <Section title="Hideout filters" unitLabel="filter" rows={filters} search={search} /> : null}
    </div>
  );
}
