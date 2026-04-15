// "The Dallen" Heuristic Engine
// Discard ranking: loner honors first, then edge tiles outward from center

const HONORS = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];
const SUITS = ['Man', 'Pin', 'Sou'];

/**
 * Scores every unique tile in the hand — lower score = discard sooner.
 *
 * Priority order:
 *   1. Loner honor tiles (single winds/dragons) — score 0
 *   2. Numbered tiles by edge distance: 1/9 → 2/8 → 3/7 → 4/6 → 5
 *   3. Bonuses added for pairs, triplets, and sequence connectivity (keep those)
 *   4. Paired/tripled honors ranked last (they have meld value)
 *
 * @param {string[]} hand
 * @returns {{ tile: string, score: number, count: number }[]} sorted low→high
 */
export function rankDiscards(hand) {
  const counts = {};
  for (const t of hand) counts[t] = (counts[t] || 0) + 1;

  const scored = [...new Set(hand)].map(tile => {
    const count = counts[tile];
    const isHonor = HONORS.includes(tile);
    let score;

    if (isHonor) {
      if (count === 1) score = 0;   // Loner — dump immediately
      else if (count === 2) score = 70; // Pair — worth keeping
      else score = 100;             // Triplet — definitely keep
    } else {
      const num = parseInt(tile.replace(/\D/g, ''), 10);
      const suit = tile.replace(/\d/g, '');

      // Base score: distance from 5 drives it.
      // 1,9 (dist 4) → base 0  (discard first)
      // 2,8 (dist 3) → base 10
      // 3,7 (dist 2) → base 20
      // 4,6 (dist 1) → base 30
      // 5   (dist 0) → base 40  (discard last among singles)
      const distFromCenter = Math.abs(5 - num);
      const baseScore = (4 - distFromCenter) * 10;

      // Pair / triplet bonus — these tiles have meld potential
      const groupBonus = count === 2 ? 25 : count >= 3 ? 55 : 0;

      // Sequence connectivity bonus — neighbors in hand are valuable
      let seqBonus = 0;
      if (SUITS.includes(suit)) {
        for (const d of [-2, -1, 1, 2]) {
          const n = num + d;
          if (n >= 1 && n <= 9 && counts[`${suit}${n}`]) seqBonus += 6;
        }
      }

      score = baseScore + groupBonus + seqBonus;
    }

    return { tile, score, count };
  });

  // Ascending: index 0 = best discard candidate
  scored.sort((a, b) => a.score - b.score || a.tile.localeCompare(b.tile));
  return scored;
}

/**
 * Returns the single best discard recommendation with a human-readable reason.
 *
 * @param {string[]} hand
 * @param {boolean} isOpponentTingPai
 * @param {string[]} safeTiles
 */
export function evaluateDiscard(hand, isOpponentTingPai = false, safeTiles = []) {
  if (isOpponentTingPai) {
    const safeOptions = hand.filter(t => safeTiles.includes(t));
    if (safeOptions.length > 0) {
      return {
        recommendedDiscard: safeOptions[0],
        reason: `(The Sacrifice) Discarding safe tile ${safeOptions[0]} — opponent is in Tīng Pái.`,
      };
    }
    return {
      recommendedDiscard: hand[0],
      reason: '(The Sacrifice) No confirmed safe tiles — defensive discard.',
    };
  }

  const ranked = rankDiscards(hand);
  const best = ranked[0];
  const isHonor = HONORS.includes(best.tile);
  const num = parseInt(best.tile.replace(/\D/g, ''), 10);

  let reason;
  if (isHonor && best.count === 1) {
    reason = `${best.tile} is a lone honor tile — it can't form sequences and has no pair, making it the deadest tile in your hand.`;
  } else if (!isNaN(num)) {
    const dist = Math.abs(5 - num);
    const label = dist === 4 ? 'terminal' : dist === 3 ? 'near-terminal' : dist === 2 ? 'edge tile' : 'off-center tile';
    reason = `${best.tile} is a ${label} with low connectivity and no current pair or sequence.`;
  } else {
    reason = `${best.tile} has the lowest meld potential in your hand.`;
  }

  return { recommendedDiscard: best.tile, reason, ranking: ranked };
}

// Legacy export — kept so any callers using getTileWeight don't break
export function getTileWeight(tileName) {
  if (HONORS.includes(tileName) || tileName.includes('Flower') || tileName.includes('Season')) return 0.8;
  const num = parseInt(tileName.replace(/\D/g, ''), 10);
  if (!num) return 0.8;
  if (num === 1 || num === 9) return 0.8;
  if (num === 2 || num === 8) return 1.0;
  return 1.4;
}
