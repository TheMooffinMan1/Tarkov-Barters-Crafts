import { useEffect, useMemo, useRef, useState } from "react";
import type { ValuatedRow } from "@compute/index.mjs";
import { formatDuration, formatRoubles, profitClass } from "../lib/format";
import { ItemStack } from "./ItemStack";

type Kind = "crafts" | "barters" | "flips";

type Props = {
  kind: Kind;
  rows: ValuatedRow[];
  search: string;
  hideUnprofitable: boolean;
  onHideQuest?: (taskId: string) => void;
};

type SortKey = "profit" | "profitPerHour" | "cost" | "duration" | "name";

const FLIP_ROW_PX = 76;
const FLIP_OVERSCAN = 10;

export function ProfitTable({ kind, rows, search, hideUnprofitable, onHideQuest }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [desc, setDesc] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [windowRange, setWindowRange] = useState({ start: 0, end: 40, height: 600 });
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    return rows.filter((row) => {
      if (hideUnprofitable && row.profit <= 0) return false;
      if (!q) return true;
      return row.search.replace(/\s+/g, "").includes(q);
    });
  }, [rows, search, hideUnprofitable]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let delta = 0;
      if (sortKey === "name") delta = a.reward.name.localeCompare(b.reward.name);
      else if (sortKey === "duration") delta = (a.duration ?? 0) - (b.duration ?? 0);
      else if (sortKey === "profitPerHour") delta = (a.profitPerHour ?? 0) - (b.profitPerHour ?? 0);
      else delta = (a[sortKey] as number) - (b[sortKey] as number);
      return desc ? -delta : delta;
    });
    return copy;
  }, [filtered, sortKey, desc]);

  const isFlip = kind === "flips";
  const virtualize = isFlip && sorted.length > 60;
  const emptyCols = kind === "crafts" ? 7 : 6;

  useEffect(() => {
    if (!openQuestId) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".quest-lock")) return;
      setOpenQuestId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openQuestId]);

  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
  }, [rows]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !virtualize) return;
    function sync() {
      const height = el.clientHeight;
      const start = Math.max(0, Math.floor(el.scrollTop / FLIP_ROW_PX) - FLIP_OVERSCAN);
      const end = Math.min(sorted.length, start + Math.ceil(height / FLIP_ROW_PX) + FLIP_OVERSCAN * 2);
      setWindowRange({ start, end, height });
    }
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [virtualize, sorted.length]);

  function header(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <th>
        <button
          type="button"
          className={`th-btn ${active ? "active" : ""}`}
          onClick={() => {
            if (active) setDesc(!desc);
            else {
              setSortKey(key);
              setDesc(key !== "name" && key !== "cost" && key !== "duration");
            }
          }}
        >
          {label}
          {active ? (desc ? " ↓" : " ↑") : ""}
        </button>
      </th>
    );
  }

  const start = virtualize ? windowRange.start : 0;
  const end = virtualize ? windowRange.end : sorted.length;
  const visible = sorted.slice(start, end);

  return (
    <>
      <div className="table-meta">
        {sorted.length} shown
        {filtered.length !== rows.length ? ` / ${rows.length} after filters` : ""}
      </div>
      <div className="table-wrap" ref={wrapRef}>
      <table>
        <thead>
          <tr>
            {header("name", isFlip ? "Item" : "Output")}
            {isFlip ? header("cost", "Buy") : <th>Inputs</th>}
            {isFlip ? <th>Sell</th> : null}
            {kind === "crafts" ? <th>Station</th> : <th>Trader</th>}
            {kind === "crafts" ? header("duration", "Time") : null}
            {kind !== "crafts" ? <th>Quest</th> : null}
            {isFlip ? null : header("cost", "Cost")}
            {header("profit", "Profit")}
            {kind === "crafts" ? header("profitPerHour", "Profit/h") : null}
          </tr>
        </thead>
        <tbody>
          {virtualize && start > 0 ? (
            <tr className="virtual-pad" aria-hidden="true">
              <td colSpan={emptyCols} style={{ height: start * FLIP_ROW_PX, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {visible.map((row) => (
            <tr key={row.id} className={isFlip ? "flip-row" : undefined}>
              <td>
                <ItemStack
                  name={row.reward.name}
                  shortName={row.reward.shortName}
                  iconLink={row.reward.iconLink}
                  count={row.reward.count}
                  price={isFlip ? null : row.reward.net}
                  source={isFlip ? undefined : row.reward.sellSource}
                  subtitle={
                    isFlip
                      ? undefined
                      : row.reward.noFlea && row.reward.sellSource !== "flea"
                        ? "Flea banned"
                        : undefined
                  }
                />
              </td>
              {isFlip ? (
                <>
                  <td>
                    <div className="item-sub">
                      <span className="item-price">{formatRoubles(row.cost)}</span>
                      <span className="item-source">
                        {row.costItems[0]?.source === "flea" ? "Flea" : `${row.traderName} LL${row.level}`}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="item-sub">
                      <span className="item-price">{formatRoubles(row.reward.net)}</span>
                      <span className="item-source">{row.reward.sellSource === "flea" ? "Flea" : "Trader"}</span>
                    </div>
                  </td>
                </>
              ) : (
                <td>
                  <div className="inputs">
                    {row.costItems.map((line) => (
                      <ItemStack
                        key={`${row.id}-${line.id}-${line.tool ? "t" : "c"}`}
                        name={line.name}
                        iconLink={line.iconLink}
                        count={line.count}
                        tool={line.tool}
                        price={line.cost > 0 ? line.cost : line.unit}
                        source={line.source}
                      />
                    ))}
                  </div>
                </td>
              )}
              <td className="nowrap">
                {kind === "crafts" ? `${row.stationName} ${row.level}` : `${row.traderName} LL${row.level}`}
              </td>
              {kind === "crafts" ? <td className="nowrap">{formatDuration(row.duration ?? 0)}</td> : null}
              {kind !== "crafts" ? (
                <td className="nowrap">
                  {row.taskUnlock ? (
                    <span className={`quest-lock ${openQuestId === row.id ? "open" : ""}`}>
                      <button
                        type="button"
                        className="quest-lock-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenQuestId((current) => (current === row.id ? null : row.id));
                        }}
                      >
                        Yes
                      </button>
                      <span className="quest-tip">{row.taskName || row.taskUnlock}</span>
                      {openQuestId === row.id ? (
                        <span className="quest-menu" role="menu">
                          <span className="quest-menu-name">{row.taskName || row.taskUnlock}</span>
                          {onHideQuest ? (
                            <button
                              type="button"
                              className="quest-menu-action"
                              onClick={() => {
                                onHideQuest(row.taskUnlock!);
                                setOpenQuestId(null);
                              }}
                            >
                              Hide quest
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </td>
              ) : null}
              {isFlip ? null : <td className="num">{formatRoubles(row.cost)}</td>}
              <td className={`num ${profitClass(row.profit)}`}>{formatRoubles(row.profit)}</td>
              {kind === "crafts" ? (
                <td className={`num ${profitClass(row.profitPerHour ?? 0)}`}>
                  {formatRoubles(row.profitPerHour ?? 0)}
                </td>
              ) : null}
            </tr>
          ))}
          {virtualize && end < sorted.length ? (
            <tr className="virtual-pad" aria-hidden="true">
              <td colSpan={emptyCols} style={{ height: (sorted.length - end) * FLIP_ROW_PX, padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={emptyCols} className="empty">
                Nothing matches the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      </div>
    </>
  );
}
