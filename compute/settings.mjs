export const GAME_MODES = [
  { id: "regular", label: "PvP" },
  { id: "pve", label: "PvE" },
  { id: "pvp-season", label: "Seasonal" },
];

export const INPUT_VALUES = [
  { id: "flea", label: "Flea" },
  { id: "trader", label: "Trader" },
  { id: "craft", label: "Craft" },
  { id: "barter", label: "Barter" },
  { id: "cheapest", label: "Cheapest of flea / trader" },
  { id: "lowest", label: "Lowest anywhere" },
];

export const FUEL_VALUES = [
  { id: "flea", label: "Flea" },
  { id: "trader", label: "Trader" },
  { id: "barter", label: "Barter" },
  { id: "cheapest", label: "Cheapest of flea / trader" },
  { id: "lowest", label: "Lowest anywhere" },
];

export const OUTPUT_VALUES = [
  { id: "flea", label: "Flea" },
  { id: "trader", label: "Best trader sell" },
  { id: "best", label: "Better of flea / trader" },
];

export const DEFAULT_SETTINGS = {
  inputValue: "cheapest",
  outputValue: "best",
  useFleaAvg: false,
  includeFleaFee: true,
  countToolsAsCost: false,
  includeFuelCost: false,
  fuelValue: "cheapest",
  solarPower: false,
  subtractBitcoinProfit: false,
  bitcoinGpus: 10,
  hideUnprofitable: true,
  hideUnpurchasable: true,
  hiddenQuestIds: [],
  haveQuestItems: true,
  filterToProgress: false,
  playerLevel: 15,
  stationLevels: {},
  traderLevels: {},
  schema: 2,
  craftingSkill: 0,
  hideoutManagement: 0,
  intelligenceCenter: 0,
  dualCraft: false,
  gameEdition: "",
  flipDirection: "traderToFlea",
  bestTwoCraftsPerStation: false,
};

export function settingsStorageKey(_mode) {
  return "tbc:settings";
}
