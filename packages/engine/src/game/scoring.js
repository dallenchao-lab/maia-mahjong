// Taiwanese Mahjong Scoring Engine
// Each condition below is worth 1 point unless noted

const DRAGONS = ['Haku', 'Hatsu', 'Chun'];
const DRAGON_LABELS = { Haku: 'White Dragon', Hatsu: 'Green Dragon', Chun: 'Red Dragon' };

/**
 * Calculates the score for a winning hand.
 *
 * @param {object} params
 * @param {string[]}   params.hand        - Concealed tiles in hand at win
 * @param {string[][]} params.exposed      - Exposed melds [[tile,tile,tile], ...]
 * @param {string[]}   params.flowers      - Collected flower/season tiles
 * @param {'zimo'|'hupai'} params.winType  - How the win was achieved
 * @returns {{ total: number, breakdown: { label: string, points: number }[] }}
 */
export function calculateScore({ hand, exposed, flowers, winType }) {
  const breakdown = []

  // 1. Dragon sets — each exposed Pon or Kong of a dragon tile = 1 pt
  for (const meld of exposed) {
    const tile = meld[0]
    if (DRAGONS.includes(tile) && meld.every(t => t === tile)) {
      breakdown.push({ label: `${DRAGON_LABELS[tile]} set`, points: 1 })
    }
  }

  // 2. Flower sets — 1 pt per complete group of 4
  const flowerCount  = flowers.filter(f => f.startsWith('Flower')).length
  const seasonCount  = flowers.filter(f => f.startsWith('Season')).length
  if (flowerCount === 4) breakdown.push({ label: 'Complete Flower set', points: 1 })
  if (seasonCount === 4) breakdown.push({ label: 'Complete Season set', points: 1 })

  // 3. Clear Door (Min Ching / 門清) — no exposed melds = 1 pt
  if (exposed.length === 0) {
    breakdown.push({ label: 'Clear Door (Mén Qīng)', points: 1 })
  }

  // 4. Self-Draw (Zì Mō) = 1 pt
  if (winType === 'zimo') {
    breakdown.push({ label: 'Self-Drawn (Zì Mō)', points: 1 })
  }

  // 5. Each Kong = 1 pt
  for (const meld of exposed) {
    if (meld.length === 4) {
      breakdown.push({ label: `Kong — ${meld[0]}`, points: 1 })
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.points, 0)
  return { total, breakdown }
}
