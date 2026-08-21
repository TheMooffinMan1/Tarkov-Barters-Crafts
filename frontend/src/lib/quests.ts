import type { ProfitBlob, Settings } from "@compute/index.mjs";

type Task = ProfitBlob["unlockTasks"][number];

export function taskLoyalty(task: Task, blob: ProfitBlob) {
  if (task.traderLevel) return task.traderLevel;
  let min = Infinity;
  for (const row of blob.barters) {
    if (row.taskUnlock === task.id) min = Math.min(min, row.minTraderLevel || 1);
  }
  for (const row of blob.flips) {
    if (row.taskUnlock === task.id) min = Math.min(min, row.minTraderLevel || 1);
  }
  return Number.isFinite(min) ? min : 1;
}

/** Hide quests above unlocked trader LL; optionally turn on newly unlocked bands. */
export function syncHiddenQuestsForTraderLevels(
  settings: Pick<Settings, "hiddenQuestIds" | "traderLevels">,
  blob: ProfitBlob,
  options: { previousTraderLevels?: Record<string, number>; enableNewlyUnlocked?: boolean } = {},
): string[] {
  const hidden = new Set(settings.hiddenQuestIds || []);
  const prev = options.previousTraderLevels;
  for (const task of blob.unlockTasks || []) {
    const traderId = task.traderId || "";
    const need = taskLoyalty(task, blob);
    const have = Number(settings.traderLevels[traderId]) || 0;
    if (have < need) {
      hidden.add(task.id);
      continue;
    }
    if (!options.enableNewlyUnlocked || !prev) continue;
    const was = Number(prev[traderId]) || 0;
    if (was < need && have >= need) hidden.delete(task.id);
  }
  return [...hidden];
}

export function withQuestLlSync(
  settings: Settings,
  blob: ProfitBlob,
  options?: { previousTraderLevels?: Record<string, number>; enableNewlyUnlocked?: boolean },
): Settings {
  return {
    ...settings,
    hiddenQuestIds: syncHiddenQuestsForTraderLevels(settings, blob, options),
  };
}
