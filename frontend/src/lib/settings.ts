import {
  DEFAULT_SETTINGS,
  GAME_MODES,
  settingsStorageKey,
  type Settings,
} from "@compute/index.mjs";

export type Tab = "crafts" | "barters" | "flips" | "items";

export type UiState = {
  mode: string;
  tab: Tab;
  search: string;
  selectedItemId: string;
  stationChip: string;
  traderChip: string;
  traderLevelChip: number;
};

const UI_KEY = "tbc:ui";
const LEGACY_MODE_KEYS = GAME_MODES.map((mode) => `tbc:${mode.id}:settings`);

const DEFAULT_UI: UiState = {
  mode: "regular",
  tab: "crafts",
  search: "",
  selectedItemId: "",
  stationChip: "",
  traderChip: "",
  traderLevelChip: 0,
};

function normalizeSettings(parsed: Partial<Settings>): Settings {
  const staleLl = (parsed.schema ?? 0) < 2;
  let inputValue = parsed.inputValue ?? DEFAULT_SETTINGS.inputValue;
  let useFleaAvg = parsed.useFleaAvg ?? DEFAULT_SETTINGS.useFleaAvg;
  if (inputValue === "fleaAvg") {
    useFleaAvg = parsed.useFleaAvg ?? true;
    inputValue = "flea";
  } else if (inputValue === "fleaLow") {
    inputValue = "flea";
  }
  const legacySubtract = (parsed as { subtractBitcoinProfit?: boolean }).subtractBitcoinProfit;
  const addBitcoinProfit = parsed.addBitcoinProfit ?? legacySubtract ?? DEFAULT_SETTINGS.addBitcoinProfit;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    inputValue,
    useFleaAvg,
    addBitcoinProfit,
    filterToProgress: false,
    hiddenQuestIds: staleLl ? [] : (parsed.hiddenQuestIds ?? []),
    stationLevels: parsed.stationLevels ?? {},
    traderLevels: staleLl ? {} : (parsed.traderLevels ?? {}),
    schema: 2,
  };
}

function emptySettings(): Settings {
  return { ...DEFAULT_SETTINGS, hiddenQuestIds: [], stationLevels: {}, traderLevels: {} };
}

function readRawSettings(): string | null {
  const shared = localStorage.getItem(settingsStorageKey());
  if (shared) return shared;
  for (const key of LEGACY_MODE_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy) return legacy;
  }
  return null;
}

export function loadSettings(_mode?: string): Settings {
  try {
    const raw = readRawSettings();
    if (!raw) return emptySettings();
    return normalizeSettings(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return emptySettings();
  }
}

export function saveSettings(_mode: string | Settings, maybeSettings?: Settings) {
  const settings = typeof _mode === "string" ? maybeSettings! : _mode;
  const json = JSON.stringify(settings);
  localStorage.setItem(settingsStorageKey(), json);
  for (const key of LEGACY_MODE_KEYS) localStorage.removeItem(key);
}

export function loadUiState(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { ...DEFAULT_UI };
    const parsed = JSON.parse(raw) as Partial<UiState>;
    const mode = GAME_MODES.some((entry) => entry.id === parsed.mode) ? parsed.mode! : DEFAULT_UI.mode;
    const tab =
      parsed.tab === "barters" || parsed.tab === "flips" || parsed.tab === "crafts" || parsed.tab === "items"
        ? parsed.tab
        : DEFAULT_UI.tab;
    return {
      mode,
      tab,
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedItemId: typeof parsed.selectedItemId === "string" ? parsed.selectedItemId : "",
      stationChip: typeof parsed.stationChip === "string" ? parsed.stationChip : "",
      traderChip: typeof parsed.traderChip === "string" ? parsed.traderChip : "",
      traderLevelChip: Number(parsed.traderLevelChip) || 0,
    };
  } catch {
    return { ...DEFAULT_UI };
  }
}

export function saveUiState(ui: UiState) {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}
