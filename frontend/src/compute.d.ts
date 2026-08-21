declare module "@compute/index.mjs" {
  export const DEFAULT_SETTINGS: Settings;
  export const GAME_MODES: { id: string; label: string }[];
  export const INPUT_VALUES: { id: string; label: string }[];
  export const OUTPUT_VALUES: { id: string; label: string }[];
  export function settingsStorageKey(mode: string): string;
  export function valuate(
    blob: ProfitBlob,
    settings: Partial<Settings>,
    parts?: { crafts?: boolean; barters?: boolean; flips?: boolean },
  ): Valuated;
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
    stationFilter?: string;
    traderFilter?: string;
    traderLevelFilter?: number;
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
          levels: { level: number; requiredPlayerLevel: number }[];
        }
      >;
      intelligenceCenterId: string | null;
    };
    items: Record<string, unknown>;
    crafts: unknown[];
    barters: { traderId: string; minTraderLevel?: number; taskUnlock?: string | null }[];
    flips: { traderId: string; minTraderLevel?: number; taskUnlock?: string | null }[];
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
}
