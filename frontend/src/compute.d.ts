declare module "@compute/index.mjs" {
  export const DEFAULT_SETTINGS: Settings;
  export const GAME_MODES: { id: string; label: string }[];
  export const INPUT_VALUES: { id: string; label: string }[];
  export const FUEL_VALUES: { id: string; label: string }[];
  export const OUTPUT_VALUES: { id: string; label: string }[];
  export function settingsStorageKey(mode?: string): string;
  export function valuate(
    blob: ProfitBlob,
    settings: Partial<Settings>,
    parts?: { crafts?: boolean; barters?: boolean; flips?: boolean },
  ): Valuated;
  export function valuateConsumables(
    blob: ProfitBlob,
    settings?: Partial<Settings>,
  ): ConsumablesValuated;
  export function buildProfitBlob(input: unknown): ProfitBlob;
  export function traderLevelsForPlayer(
    traders: ProfitBlob["meta"]["traders"],
    playerLevel: number,
  ): Record<string, number>;
  export function loyaltyForPlayerLevel(
    trader: ProfitBlob["meta"]["traders"][string],
    playerLevel: number,
  ): number;
  export function fleaUnlocked(flea: ProfitBlob["meta"]["flea"], playerLevel: number): boolean;
  export function canUseFlea(item: unknown, blob: ProfitBlob, settings?: Partial<Settings>): boolean;
  export function fleaMarketFee(
    basePrice: number,
    sellPrice: number,
    options?: Record<string, number>,
  ): number;

  export interface Settings {
    inputValue: string;
    outputValue: string;
    useFleaAvg: boolean;
    includeFleaFee: boolean;
    countToolsAsCost: boolean;
    includeFuelCost: boolean;
    fuelValue: string;
    solarPower: boolean;
    addBitcoinProfit: boolean;
    bitcoinGpus: number;
    hideUnprofitable: boolean;
    hideUnpurchasable: boolean;
    hiddenQuestIds: string[];
    haveQuestItems: boolean;
    filterToProgress: boolean;
    playerLevel: number;
    stationLevels: Record<string, number>;
    traderLevels: Record<string, number>;
    schema?: number;
    craftingSkill: number;
    hideoutManagement: number;
    intelligenceCenter: number;
    dualCraft: boolean;
    gameEdition: string;
    flipDirection: "traderToFlea" | "fleaToTrader";
    bestTwoCraftsPerStation: boolean;
    stationFilter?: string;
    traderFilter?: string;
    traderLevelFilter?: number;
  }

  export function lookupItem(blob: ProfitBlob, itemId: string, settings?: Partial<Settings>): ItemLookupResult | null;
  export function resolveItemId(blob: ProfitBlob, slugOrId: string): string;

  export interface SlimItem {
    id: string;
    name: string;
    shortName: string;
    slug?: string;
    iconLink?: string;
    gridImageLink?: string;
    lastLowPrice: number;
    avg24hPrice: number;
    width: number;
    height: number;
    noFlea: boolean;
    usesDurability: boolean;
    minLevelForFlea: number;
    consumable: string | null;
    resourceUnits: number;
    buyFromTrader: TraderOffer[];
    sellToTrader: TraderOffer[];
    search: string;
  }

  export interface TraderOffer {
    traderId: string;
    priceRUB: number;
    minTraderLevel: number;
    taskUnlock: string | null;
    buyLimit: number | null;
  }

  export interface HideoutRef {
    stationId: string;
    stationName: string;
    stationImageLink?: string | null;
    level: number;
    count: number;
    foundInRaid: boolean;
  }

  export interface QuestRef {
    taskId: string;
    taskName: string;
    traderId?: string | null;
    traderName: string | null;
    traderLevel?: number;
    traderImageLink?: string | null;
    type: string;
    count: number;
    foundInRaid: boolean;
    categoryName?: string;
  }

  export interface ItemLookupResult {
    item: SlimItem;
    slots: number;
    flea: {
      canSell: boolean;
      blockedReason: string | null;
      minPlayerLevel: number;
      lastLow: number;
      avg24h: number;
      lastLowPerSlot: number;
      avg24hPerSlot: number;
      feeLastLow: number;
      feeAvg24h: number;
      netLastLow: number;
      netAvg24h: number;
    };
    traderSell: Array<TraderOffer & { traderName: string; traderImageLink?: string | null; locked: boolean }>;
    refs: {
      hideout: HideoutRef[];
      quests: QuestRef[];
    };
  }

  export interface ProfitBlob {
    lastUpdated: string;
    meta: {
      gameMode?: string;
      flea: {
        enabled: boolean;
        minPlayerLevel: number;
        sellOfferFeeRate: number;
        sellRequirementFeeRate: number;
        name: string;
      };
      stations: Record<string, { id: string; name: string; normalizedName: string; maxLevel: number }>;
      traders: Record<
        string,
        {
          id: string;
          name: string;
          normalizedName: string;
          imageLink?: string | null;
          levels: { level: number; requiredPlayerLevel: number }[];
        }
      >;
      intelligenceCenterId: string | null;
    };
    items: Record<string, SlimItem>;
    crafts: unknown[];
    barters: { traderId: string; minTraderLevel?: number; taskUnlock?: string | null }[];
    flips: { traderId: string; minTraderLevel?: number; taskUnlock?: string | null }[];
    itemRefs?: Record<string, { hideout: HideoutRef[]; quests: QuestRef[] }>;
    itemSlugs?: Record<string, string>;
    unlockTasks: {
      id: string;
      name: string;
      traderId?: string | null;
      traderName?: string | null;
      minPlayerLevel?: number;
      traderLevel?: number;
    }[];
  }

  export interface CostLine {
    id: string;
    count: number;
    tool: boolean;
    fuel?: boolean;
    name: string;
    shortName: string;
    iconLink?: string;
    unit: number;
    source: string;
    cost: number;
  }

  export interface ValuatedRow {
    id: string;
    kind: string;
    stationId?: string;
    stationName?: string;
    traderId?: string;
    traderName?: string;
    level: number;
    taskUnlock?: string | null;
    taskName?: string | null;
    duration?: number;
    buyLimit?: number | null;
    costItems: CostLine[];
    cost: number;
    reward: {
      id: string;
      count: number;
      name: string;
      shortName: string;
      iconLink?: string;
      noFlea: boolean;
      sellTo: string;
      sellSource?: string;
      gross: number;
      fee: number;
      net: number;
    };
    profit: number;
    profitPerHour?: number;
    search: string;
  }

  export interface Valuated {
    crafts: ValuatedRow[];
    barters: ValuatedRow[];
    flips: ValuatedRow[];
  }

  export interface ConsumableRow {
    id: string;
    consumableKind: "fuel" | "waterFilter" | "airFilter";
    method: "flea" | "trader" | "barter";
    methodLabel: string;
    itemId: string;
    itemName: string;
    itemShortName: string;
    iconLink?: string;
    resourceUnits: number;
    outputCount: number;
    totalCost: number;
    pricePerUnit: number;
    costItems: CostLine[];
    traderId?: string;
    traderName?: string;
    level: number;
    taskUnlock?: string | null;
    taskName?: string | null;
    buyLimit?: number | null;
    search: string;
    cheapest?: boolean;
  }

  export interface ConsumablesValuated {
    fuel: ConsumableRow[];
    filters: ConsumableRow[];
  }
}
