import type { ProfitBlob, Settings } from "@compute/index.mjs";
import { INPUT_VALUES, OUTPUT_VALUES, traderLevelsForPlayer, loyaltyForPlayerLevel } from "@compute/index.mjs";
import { taskLoyalty, withQuestLlSync } from "../lib/quests";

type Props = {
  blob: ProfitBlob;
  settings: Settings;
  onChange: (next: Settings) => void;
  onReset: () => void;
};

function toggleId(list: string[], id: string, on: boolean) {
  if (on) return list.includes(id) ? list : [...list, id];
  return list.filter((x) => x !== id);
}

function applyIds(list: string[], ids: string[], hide: boolean) {
  const next = new Set(list);
  for (const id of ids) {
    if (hide) next.add(id);
    else next.delete(id);
  }
  return [...next];
}

type Task = ProfitBlob["unlockTasks"][number];

function groupQuests(blob: ProfitBlob) {
  const buckets = new Map<string, { traderId: string; traderName: string; tasks: Task[] }>();
  for (const task of blob.unlockTasks) {
    const traderId = task.traderId || "other";
    const traderName = task.traderName || blob.meta.traders[traderId]?.name || "Other";
    if (!buckets.has(traderId)) buckets.set(traderId, { traderId, traderName, tasks: [] });
    buckets.get(traderId)!.tasks.push(task);
  }
  const groups = [...buckets.values()].sort((a, b) => a.traderName.localeCompare(b.traderName));
  return groups.map((group) => {
    const byLevel = new Map<number, Task[]>();
    for (const task of group.tasks) {
      const level = taskLoyalty(task, blob);
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(task);
    }
    for (const list of byLevel.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return {
      ...group,
      levels: [...byLevel.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([traderLevel, tasks]) => ({ traderLevel, tasks })),
    };
  });
}

export function SettingsPanel({ blob, settings, onChange, onReset }: Props) {
  const stations = Object.values(blob.meta.stations).sort((a, b) => a.name.localeCompare(b.name));
  const traders = Object.values(blob.meta.traders)
    .filter(
      (trader) =>
        blob.barters.some((row) => row.traderId === trader.id) ||
        blob.flips.some((row) => row.traderId === trader.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial });
  const questGroups = groupQuests(blob);

  function setPlayerLevel(playerLevel: number) {
    const previousTraderLevels = settings.traderLevels;
    const traderLevels = traderLevelsForPlayer(blob.meta.traders, playerLevel);
    onChange(
      withQuestLlSync(
        { ...settings, playerLevel, traderLevels },
        blob,
        { previousTraderLevels, enableNewlyUnlocked: true },
      ),
    );
  }

  function setTraderLevel(traderId: string, level: number) {
    const previousTraderLevels = settings.traderLevels;
    const traderLevels = { ...settings.traderLevels, [traderId]: level };
    onChange(
      withQuestLlSync(
        { ...settings, traderLevels },
        blob,
        { previousTraderLevels, enableNewlyUnlocked: true },
      ),
    );
  }

  function setCraftingSkill(craftingSkill: number) {
    const crossedElite = settings.craftingSkill < 51 && craftingSkill >= 51;
    patch({
      craftingSkill,
      dualCraft: craftingSkill >= 51 ? (crossedElite ? true : settings.dualCraft) : false,
    });
  }

  return (
    <aside className="settings">
      <button type="button" className="reset-btn" onClick={onReset}>
        Reset to defaults
      </button>
      <section>
        <h2>Valuation</h2>
        <label>
          Inputs
          <select
            value={settings.inputValue === "fleaLow" || settings.inputValue === "fleaAvg" ? "flea" : settings.inputValue}
            onChange={(e) => patch({ inputValue: e.target.value })}
          >
            {INPUT_VALUES.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Outputs
          <select value={settings.outputValue} onChange={(e) => patch({ outputValue: e.target.value })}>
            {OUTPUT_VALUES.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.useFleaAvg)}
            onChange={(e) => patch({ useFleaAvg: e.target.checked })}
          />
          Use 24h average for flea
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.includeFleaFee}
            onChange={(e) => patch({ includeFleaFee: e.target.checked })}
          />
          Subtract flea listing fee
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.countToolsAsCost}
            onChange={(e) => patch({ countToolsAsCost: e.target.checked })}
          />
          Count returned tools as cost
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.hideUnprofitable}
            onChange={(e) => patch({ hideUnprofitable: e.target.checked })}
          />
          Hide unprofitable rows
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.hideUnpurchasable}
            onChange={(e) => patch({ hideUnpurchasable: e.target.checked })}
          />
          Hide crafts and barters that consume items you cannot buy
        </label>
      </section>

      <section>
        <h2>Level</h2>
        <label>
          Player level ({settings.playerLevel})
          <input
            type="range"
            min={1}
            max={79}
            value={settings.playerLevel}
            onChange={(e) => setPlayerLevel(Number(e.target.value))}
          />
        </label>
        {traders.map((trader) => (
          <label key={trader.id}>
            {trader.name} LL{settings.traderLevels[trader.id] ?? loyaltyForPlayerLevel(trader, settings.playerLevel)}
            <input
              type="range"
              min={0}
              max={4}
              value={settings.traderLevels[trader.id] ?? loyaltyForPlayerLevel(trader, settings.playerLevel)}
              onChange={(e) => setTraderLevel(trader.id, Number(e.target.value))}
            />
          </label>
        ))}
      </section>

      <section>
        <h2>Skills &amp; fees</h2>
        <label>
          Crafting skill ({settings.craftingSkill})
          <input
            type="range"
            min={0}
            max={51}
            value={settings.craftingSkill}
            onChange={(e) => setCraftingSkill(Number(e.target.value))}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.dualCraft && settings.craftingSkill >= 51}
            onChange={(e) => patch({ dualCraft: e.target.checked })}
            disabled={settings.craftingSkill < 51}
          />
          Elite dual-craft (auto at 51; halves time)
        </label>
        <label>
          Hideout Management ({settings.hideoutManagement})
          <input
            type="range"
            min={0}
            max={51}
            value={settings.hideoutManagement}
            onChange={(e) => patch({ hideoutManagement: Number(e.target.value) })}
          />
        </label>
        <label>
          Intelligence Center
          <select
            value={settings.intelligenceCenter}
            onChange={(e) => patch({ intelligenceCenter: Number(e.target.value) })}
          >
            <option value={0}>None</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3 (−30% flea fee)</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Progress</h2>
        <p className="hint">Everything is visible until you hide it here.</p>
        <label>
          Game edition
          <select value={settings.gameEdition} onChange={(e) => patch({ gameEdition: e.target.value })}>
            <option value="">Show all</option>
            <option value="standard">Hide edition-locked crafts</option>
            <option value="edge_of_darkness">Edge of Darkness</option>
            <option value="eod_tue_edition">Unheard / EoD</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.haveQuestItems}
            onChange={(e) => patch({ haveQuestItems: e.target.checked })}
          />
          I have required quest items
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.filterToProgress}
            onChange={(e) => {
              const on = e.target.checked;
              if (!on) {
                patch({ filterToProgress: false });
                return;
              }
              const previousTraderLevels = settings.traderLevels;
              const traderLevels = traderLevelsForPlayer(blob.meta.traders, settings.playerLevel);
              onChange(
                withQuestLlSync(
                  { ...settings, filterToProgress: true, traderLevels },
                  blob,
                  { previousTraderLevels, enableNewlyUnlocked: true },
                ),
              );
            }}
          />
          Only show what my level / hideout / traders can access
        </label>
        {settings.filterToProgress
          ? stations.map((station) => (
              <label key={station.id}>
                {station.name} ({settings.stationLevels[station.id] ?? station.maxLevel})
                <input
                  type="range"
                  min={0}
                  max={station.maxLevel}
                  value={settings.stationLevels[station.id] ?? station.maxLevel}
                  onChange={(e) =>
                    patch({
                      stationLevels: { ...settings.stationLevels, [station.id]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))
          : null}
      </section>

      <section>
        <h2>Quest-locked recipes</h2>
        <p className="hint">Checked = on. Quests above your unlocked trader LL start off.</p>
        {questGroups.length === 0 ? <p className="muted">No quest-gated recipes in this dump.</p> : null}
        {questGroups.map((group) => (
          <div key={group.traderId} className="quest-group">
            <strong className="quest-trader">{group.traderName}</strong>
            {group.levels.map((band) => {
              const bandIds = band.tasks.map((t) => t.id);
              const onCount = bandIds.filter((id) => !settings.hiddenQuestIds.includes(id)).length;
              const allOn = onCount === bandIds.length && bandIds.length > 0;
              const someOn = onCount > 0 && onCount < bandIds.length;
              return (
                <details key={band.traderLevel} className="fold quest-band">
                  <summary>
                    <label
                      className="check quest-ll-check"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = someOn;
                        }}
                        onChange={(e) =>
                          patch({ hiddenQuestIds: applyIds(settings.hiddenQuestIds, bandIds, !e.target.checked) })
                        }
                      />
                      LL{band.traderLevel}
                    </label>
                    <span className="muted">
                      {onCount}/{bandIds.length} on
                    </span>
                  </summary>
                  {band.tasks.map((task) => (
                    <label key={task.id} className="check">
                      <input
                        type="checkbox"
                        checked={!settings.hiddenQuestIds.includes(task.id)}
                        onChange={(e) =>
                          patch({ hiddenQuestIds: toggleId(settings.hiddenQuestIds, task.id, !e.target.checked) })
                        }
                      />
                      {task.name}
                    </label>
                  ))}
                </details>
              );
            })}
          </div>
        ))}
      </section>
    </aside>
  );
}
