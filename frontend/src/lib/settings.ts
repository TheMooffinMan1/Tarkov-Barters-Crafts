import {
  DEFAULT_SETTINGS,
  settingsStorageKey,
  type Settings,
} from "@compute/index.mjs";

export function loadSettings(mode: string): Settings {
  try {
    const raw = localStorage.getItem(settingsStorageKey(mode));
    if (!raw) return { ...DEFAULT_SETTINGS, hiddenQuestIds: [], stationLevels: {}, traderLevels: {} };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const staleLl = (parsed.schema ?? 0) < 2;
    let inputValue = parsed.inputValue ?? DEFAULT_SETTINGS.inputValue;
    let useFleaAvg = parsed.useFleaAvg ?? DEFAULT_SETTINGS.useFleaAvg;
    if (inputValue === "fleaAvg") {
      useFleaAvg = parsed.useFleaAvg ?? true;
      inputValue = "flea";
    } else if (inputValue === "fleaLow") {
      inputValue = "flea";
    }
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      inputValue,
      useFleaAvg,
      hiddenQuestIds: staleLl ? [] : (parsed.hiddenQuestIds ?? []),
      stationLevels: parsed.stationLevels ?? {},
      traderLevels: staleLl ? {} : (parsed.traderLevels ?? {}),
      schema: 2,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, hiddenQuestIds: [], stationLevels: {}, traderLevels: {} };
  }
}

export function saveSettings(mode: string, settings: Settings) {
  localStorage.setItem(settingsStorageKey(mode), JSON.stringify(settings));
}
