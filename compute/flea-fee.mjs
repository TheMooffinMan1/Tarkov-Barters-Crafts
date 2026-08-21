/**
 * Flea listing fee. Matches tarkov.dev's flea-market-fee.mjs
 * (wiki Trading#Flea_Market), including Intel Center 3 × Hideout Management.
 */
export function fleaMarketFee(basePrice, sellPrice, options = {}) {
  const count = options.count ?? 1;
  const intelligenceCenter = options.intelligenceCenter ?? 0;
  const hideoutManagement = options.hideoutManagement ?? 0;
  const Ti = options.Ti ?? 0.03;
  const Tr = options.Tr ?? 0.03;
  const V0 = Number(basePrice) || 0;
  const VR = Number(sellPrice) || 0;
  if (V0 <= 0 || VR <= 0) return 0;

  let P0 = Math.log10(V0 / VR);
  let PR = Math.log10(VR / V0);
  if (VR < V0) P0 = Math.pow(P0, 1.08);
  if (VR >= V0) PR = Math.pow(PR, 1.08);

  let IC = 1;
  if (intelligenceCenter >= 3) {
    IC = 1 - (0.01 * hideoutManagement + 1) * 0.3;
  }

  return Math.ceil(V0 * Ti * Math.pow(4, P0) * count + VR * Tr * Math.pow(4, PR) * count) * IC;
}
