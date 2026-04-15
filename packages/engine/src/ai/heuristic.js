// "The Dallen" Heuristic Engine
// Discard ranking: tenpai first, then loner honors, then edge tiles outward from center

import { checkWin } from '../game/gameState.js';

const HONORS = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];
const SUITS = ['Man', 'Pin', 'Sou'];

const SUIT_LABELS = { Man: 'Characters', Pin: 'Balls', Sou: 'Stripes' };
const HONOR_LABELS = {
  Ton: 'East', Nan: 'South', Shaa: 'West', Pei: 'North',
  Haku: 'White Dragon', Hatsu: 'Green Dragon', Chun: 'Red Dragon',
};

// Every tile type that could complete a waiting hand
const ALL_TILE_TYPES = [
  'Man1','Man2','Man3','Man4','Man5','Man6','Man7','Man8','Man9',
  'Pin1','Pin2','Pin3','Pin4','Pin5','Pin6','Pin7','Pin8','Pin9',
  'Sou1','Sou2','Sou3','Sou4','Sou5','Sou6','Sou7','Sou8','Sou9',
  'Ton','Nan','Shaa','Pei','Haku','Hatsu','Chun',
];

/**
 * Converts an internal tile code to a human-readable name.
 * e.g. "Sou9" → "9 Stripes", "Hatsu" → "Green Dragon", "Flower2" → "Flower 2"
 */
export function formatTile(tile) {
  if (HONOR_LABELS[tile]) return HONOR_LABELS[tile];
  for (const [suit, label] of Object.entries(SUIT_LABELS)) {
    if (tile.startsWith(suit)) {
      const num = tile.slice(suit.length);
      return `${num} ${label}`;
    }
  }
  if (tile.startsWith('Flower')) return `Flower ${tile.slice(6)}`;
  if (tile.startsWith('Season')) return `Season ${tile.slice(6)}`;
  return tile;
}

/** Formats an array of tiles as a readable list. */
export function formatHand(tiles) {
  return tiles.map(formatTile).join(', ');
}

/** Returns true if the given hand is one tile away from winning. */
function isTenpai(hand) {
  return ALL_TILE_TYPES.some(t => checkWin([...hand, t]));
}

/** Returns a copy of hand with one instance of tile removed. */
function withoutTile(hand, tile) {
  const h = [...hand];
  const idx = h.indexOf(tile);
  if (idx > -1) h.splice(idx, 1);
  return h;
}

/** How many distinct tile types would complete this tenpai hand. */
function countOuts(hand) {
  return ALL_TILE_TYPES.filter(t => checkWin([...hand, t])).length;
}

/**
 * Scores every unique tile in the hand — lower score = discard sooner.
 *
 * Priority order:
 *   0. Tenpai discard — discarding this tile puts you one from winning (score: -100 minus outs)
 *   1. Loner honor tiles (single winds/dragons) — score 0
 *   2. Numbered tiles by edge distance: 1/9 → 2/8 → 3/7 → 4/6 → 5
 *   3. Bonuses for pairs, triplets, complete sequences (keep those)
 *
 * @param {string[]} hand
 * @returns {{ tile: string, score: number, count: number, tenpai: boolean }[]} sorted low→high
 */
export function rankDiscards(hand) {
  const counts = {};
  for (const t of hand) counts[t] = (counts[t] || 0) + 1;

  // Pre-compute which discards lead to tenpai
  const tenpaiMap = {};
  for (const tile of new Set(hand)) {
    const remaining = withoutTile(hand, tile);
    if (isTenpai(remaining)) {
      tenpaiMap[tile] = countOuts(remaining);
    }
  }

  const scored = [...new Set(hand)].map(tile => {
    const count = counts[tile];
    const isHonor = HONORS.includes(tile);
    let score;
    const tenpai = tile in tenpaiMap;

    if (tenpai) {
      // Tenpai discard — score it below everything else.
      // Among tenpai candidates, prefer the one with the most outs (most waits).
      score = -100 - tenpaiMap[tile];
    } else if (isHonor) {
      if (count === 1) score = 0;       // Loner — dump immediately
      else if (count === 2) score = 70; // Pair — worth keeping
      else score = 100;                 // Triplet — definitely keep
    } else {
      const num = parseInt(tile.replace(/\D/g, ''), 10);
      const suit = tile.replace(/\d/g, '');

      // Base score: distance from 5.
      // 1,9 (dist 4) → base 0  (discard first among non-tenpai)
      // 2,8 (dist 3) → base 10
      // 3,7 (dist 2) → base 20
      // 4,6 (dist 1) → base 30
      // 5   (dist 0) → base 40
      const distFromCenter = Math.abs(5 - num);
      const baseScore = (4 - distFromCenter) * 10;

      // Pair / triplet bonus
      const groupBonus = count === 2 ? 25 : count >= 3 ? 55 : 0;

      // Sequence scoring
      let seqBonus = 0;
      if (SUITS.includes(suit)) {
        const windows = [
          [num - 2, num - 1, num],
          [num - 1, num,     num + 1],
          [num,     num + 1, num + 2],
        ];
        const inCompleteSeq = windows.some(([a, b, c]) =>
          a >= 1 && c <= 9 &&
          counts[`${suit}${a}`] >= 1 &&
          counts[`${suit}${b}`] >= 1 &&
          counts[`${suit}${c}`] >= 1
        );

        if (inCompleteSeq) {
          seqBonus = 50; // Part of a finished run — protect it
        } else {
          for (const d of [-2, -1, 1, 2]) {
            const n = num + d;
            if (n >= 1 && n <= 9 && counts[`${suit}${n}`]) seqBonus += 6;
          }
        }
      }

      score = baseScore + groupBonus + seqBonus;
    }

    return { tile, score, count, tenpai };
  });

  // Ascending: index 0 = best discard candidate
  scored.sort((a, b) => a.score - b.score || a.tile.localeCompare(b.tile));
  return scored;
}

/**
 * Returns the single best discard recommendation with a human-readable reason.
 */
export function evaluateDiscard(hand, isOpponentTingPai = false, safeTiles = []) {
  if (isOpponentTingPai) {
    const safeOptions = hand.filter(t => safeTiles.includes(t));
    if (safeOptions.length > 0) {
      return {
        recommendedDiscard: safeOptions[0],
        reason: `(The Sacrifice) Discarding ${formatTile(safeOptions[0])} — opponent is one tile from winning.`,
      };
    }
    return {
      recommendedDiscard: hand[0],
      reason: '(The Sacrifice) No confirmed safe tiles — defensive discard.',
    };
  }

  const ranked = rankDiscards(hand);
  const best = ranked[0];
  const name = formatTile(best.tile);

  let reason;
  if (best.tenpai) {
    const outs = -(best.score + 100); // recover countOuts value
    reason = `Discarding ${name} puts you in a waiting hand (${outs} winning tile${outs !== 1 ? 's' : ''} available).`;
  } else if (HONORS.includes(best.tile) && best.count === 1) {
    reason = `${name} is a lone honor tile — it can't form sequences and has no pair, making it the deadest tile in your hand.`;
  } else {
    const num = parseInt(best.tile.replace(/\D/g, ''), 10);
    const dist = Math.abs(5 - num);
    const label = dist === 4 ? 'terminal' : dist === 3 ? 'near-terminal' : dist === 2 ? 'edge tile' : 'off-center tile';
    reason = `${name} is a ${label} with low connectivity and no current pair or sequence.`;
  }

  return { recommendedDiscard: best.tile, reason, ranking: ranked };
}

// Legacy export
export function getTileWeight(tileName) {
  if (HONORS.includes(tileName) || tileName.includes('Flower') || tileName.includes('Season')) return 0.8;
  const num = parseInt(tileName.replace(/\D/g, ''), 10);
  if (!num) return 0.8;
  if (num === 1 || num === 9) return 0.8;
  if (num === 2 || num === 8) return 1.0;
  return 1.4;
}
