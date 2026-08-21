import { startTransition, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  GAME_MODES,
  valuate,
  loyaltyForPlayerLevel,
  type ProfitBlob,
  type Settings,
} from "@compute/index.mjs";
import { loadBlob } from "./lib/api";
import { loadSettings, saveSettings } from "./lib/settings";
import { formatUpdated } from "./lib/format";
import { ModeToggle } from "./components/ModeToggle";
import { SettingsPanel } from "./components/SettingsPanel";
import { ProfitTable } from "./components/ProfitTable";

type Tab = "crafts" | "barters" | "flips";

function hydrate(settings: Settings, blob: ProfitBlob): Settings {
  const stationLevels = { ...settings.stationLevels };
  for (const station of Object.values(blob.meta.stations)) {
    if (stationLevels[station.id] == null) stationLevels[station.id] = station.maxLevel;
  }
  const traderLevels = { ...settings.traderLevels };
  for (const trader of Object.values(blob.meta.traders)) {
    if (traderLevels[trader.id] == null) {
      traderLevels[trader.id] = loyaltyForPlayerLevel(trader, settings.playerLevel);
    }
  }
  return {
    ...settings,
    stationLevels,
    traderLevels,
    dualCraft: settings.craftingSkill >= 51 ? settings.dualCraft : false,
  };
}

export function App() {
  const [mode, setMode] = useState("regular");
  const [tab, setTab] = useState<Tab>("crafts");
  const [search, setSearch] = useState("");
  const [stationChip, setStationChip] = useState("");
  const [traderChip, setTraderChip] = useState("");
  const [traderLevelChip, setTraderLevelChip] = useState(0);
  const [blob, setBlob] = useState<ProfitBlob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(() => loadSettings("regular"));
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    setSettings(loadSettings(mode));
    setStationChip("");
    setTraderChip("");
    setTraderLevelChip(0);
    setLoading(true);
    setError(null);
    loadBlob(mode)
      .then((data) => {
        setBlob(data);
        setSettings((current) => hydrate(current, data));
      })
      .catch((err: Error) => {
        setBlob(null);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    saveSettings(mode, settings);
  }, [mode, settings]);

  function resetToDefaults() {
    setSearch("");
    setStationChip("");
    setTraderChip("");
    setTraderLevelChip(0);
    setResetNonce((n) => n + 1);
    const fresh = {
      ...DEFAULT_SETTINGS,
      hiddenQuestIds: [] as string[],
      stationLevels: {} as Record<string, number>,
      traderLevels: {} as Record<string, number>,
    };
    setSettings(blob ? hydrate(fresh, blob) : fresh);
  }

  function hideQuest(taskId: string) {
    setSettings((current) => {
      if (current.hiddenQuestIds.includes(taskId)) return current;
      return { ...current, hiddenQuestIds: [...current.hiddenQuestIds, taskId] };
    });
  }

  const recipes = useMemo(() => {
    if (!blob) return { crafts: [] as ReturnType<typeof valuate>["crafts"], barters: [] as ReturnType<typeof valuate>["barters"] };
    const { crafts, barters } = valuate(
      blob,
      {
        ...settings,
        stationFilter: stationChip || undefined,
        traderFilter: traderChip || undefined,
        traderLevelFilter: traderLevelChip || undefined,
      },
      { crafts: true, barters: true, flips: false },
    );
    return { crafts, barters };
  }, [
    blob,
    stationChip,
    traderChip,
    traderLevelChip,
    settings.inputValue,
    settings.outputValue,
    settings.useFleaAvg,
    settings.includeFleaFee,
    settings.countToolsAsCost,
    settings.hideUnpurchasable,
    settings.haveQuestItems,
    settings.filterToProgress,
    settings.playerLevel,
    settings.craftingSkill,
    settings.hideoutManagement,
    settings.intelligenceCenter,
    settings.dualCraft,
    settings.gameEdition,
    settings.hiddenQuestIds,
    settings.stationLevels,
    settings.traderLevels,
  ]);

  const flips = useMemo(() => {
    if (!blob) return [];
    return valuate(
      blob,
      {
        ...settings,
        traderFilter: traderChip || undefined,
        traderLevelFilter: traderLevelChip || undefined,
      },
      { crafts: false, barters: false, flips: true },
    ).flips;
  }, [blob, settings, traderChip, traderLevelChip]);

  const valued = { crafts: recipes.crafts, barters: recipes.barters, flips };

  const updated = blob ? formatUpdated(blob.lastUpdated) : null;
  const stations = blob ? Object.values(blob.meta.stations).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const sellTraderIds = useMemo(() => {
    const ids = new Set<string>();
    if (!blob) return ids;
    for (const item of Object.values(blob.items)) {
      for (const offer of (item as { sellToTrader?: { traderId: string }[] }).sellToTrader || []) {
        ids.add(offer.traderId);
      }
    }
    return ids;
  }, [blob]);
  const traders = blob
    ? Object.values(blob.meta.traders)
        .filter((trader) => {
          if (tab === "flips" && settings.flipDirection === "fleaToTrader") return sellTraderIds.has(trader.id);
          return (
            blob.barters.some((row) => row.traderId === trader.id) ||
            blob.flips.some((row) => row.traderId === trader.id)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Escape from Tarkov</p>
          <h1>Crafts, barters &amp; flips</h1>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <div className="status-row">
        {loading ? <span className="muted">Loading {GAME_MODES.find((m) => m.id === mode)?.label} prices…</span> : null}
        {error ? (
          <span className="neg">
            {error} Run <code>npm run blob</code> for local data, or point <code>VITE_BLOB_BASE</code> at the worker.
          </span>
        ) : null}
        {updated ? (
          <span className={updated.stale ? "stale" : "muted"}>
            Prices {updated.stale ? "may be stale — " : "updated "}
            {updated.label}
          </span>
        ) : null}
      </div>

      <div className="layout">
        {blob ? (
          <SettingsPanel blob={blob} settings={settings} onChange={setSettings} onReset={resetToDefaults} />
        ) : (
          <aside className="settings" />
        )}

        <main>
          <div className="toolbar">
            <div className="segmented">
              {(
                [
                  ["crafts", `Crafts (${valued.crafts.length})`],
                  ["barters", `Barters (${valued.barters.length})`],
                  ["flips", `Flips (${valued.flips.length})`],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            <input
              className="search"
              placeholder="Search item, station, trader…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {tab === "crafts" || tab === "barters" ? (
              <label className="check toolbar-check">
                <input
                  type="checkbox"
                  checked={settings.hideUnpurchasable}
                  onChange={(e) => setSettings({ ...settings, hideUnpurchasable: e.target.checked })}
                />
                Hide if an input cannot be bought (Excludes returned tools)
              </label>
            ) : null}
            {tab === "flips" ? (
              <div className="segmented">
                <button
                  type="button"
                  className={settings.flipDirection !== "fleaToTrader" ? "active" : ""}
                  onClick={() =>
                    startTransition(() => setSettings({ ...settings, flipDirection: "traderToFlea" }))
                  }
                >
                  Trader buy → Flea sell
                </button>
                <button
                  type="button"
                  className={settings.flipDirection === "fleaToTrader" ? "active" : ""}
                  onClick={() =>
                    startTransition(() => setSettings({ ...settings, flipDirection: "fleaToTrader" }))
                  }
                >
                  Flea buy → Trader sell
                </button>
              </div>
            ) : null}
          </div>

          {tab === "crafts" ? (
            <div className="chips">
              <button type="button" className={!stationChip ? "active" : ""} onClick={() => setStationChip("")}>
                All stations
              </button>
              {stations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className={stationChip === station.id ? "active" : ""}
                  onClick={() => setStationChip(station.id)}
                >
                  {station.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="chips">
              <button type="button" className={!traderChip ? "active" : ""} onClick={() => setTraderChip("")}>
                All traders
              </button>
              {traders.map((trader) => (
                <button
                  key={trader.id}
                  type="button"
                  className={traderChip === trader.id ? "active" : ""}
                  onClick={() => setTraderChip(trader.id)}
                >
                  {trader.name}
                </button>
              ))}
              <button type="button" className={!traderLevelChip ? "active" : ""} onClick={() => setTraderLevelChip(0)}>
                All LL
              </button>
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={traderLevelChip === level ? "active" : ""}
                  onClick={() => setTraderLevelChip(level)}
                >
                  LL{level}
                </button>
              ))}
            </div>
          )}

          {tab === "crafts" ? (
            <ProfitTable
              key={`crafts-${resetNonce}`}
              kind="crafts"
              rows={valued.crafts}
              search={search}
              hideUnprofitable={settings.hideUnprofitable}
              onHideQuest={hideQuest}
            />
          ) : null}
          {tab === "barters" ? (
            <ProfitTable
              key={`barters-${resetNonce}`}
              kind="barters"
              rows={valued.barters}
              search={search}
              hideUnprofitable={settings.hideUnprofitable}
              onHideQuest={hideQuest}
            />
          ) : null}
          {tab === "flips" ? (
            <ProfitTable
              key={`flips-${resetNonce}`}
              kind="flips"
              rows={valued.flips}
              search={search}
              hideUnprofitable={settings.hideUnprofitable}
              onHideQuest={hideQuest}
            />
          ) : null}
        </main>
      </div>

      <footer>
        Price data from{" "}
        <a href="https://tarkov.dev" target="_blank" rel="noreferrer">
          tarkov.dev
        </a>
        . Not affiliated with Battlestate Games. Settings stay in this browser — no accounts.
      </footer>
    </div>
  );
}
