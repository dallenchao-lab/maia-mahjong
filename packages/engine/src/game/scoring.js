// Taiwanese Mahjong Scoring Engine — IGS / House Rules
// Reference: mahjong.wikidot.com, Taiwanese Scoring (IGS column)
//
// Each condition adds tai (台) to the total.
// Special limit hands (Heaven/Earth Win) return immediately.

const DRAGONS = ['Haku', 'Hatsu', 'Chun']
const WINDS   = ['Ton', 'Nan', 'Shaa', 'Pei']

const DRAGON_LABELS = { Haku: 'White Dragon', Hatsu: 'Green Dragon', Chun: 'Red Dragon' }
const WIND_LABELS   = { Ton: 'East', Nan: 'South', Shaa: 'West', Pei: 'North' }

function tileCount(tiles) {
  const c = {}
  for (const t of tiles) c[t] = (c[t] || 0) + 1
  return c
}

function getSuit(tile) {
  if (tile.startsWith('Man')) return 'Man'
  if (tile.startsWith('Pin')) return 'Pin'
  if (tile.startsWith('Sou')) return 'Sou'
  return null
}

function isHonor(tile) {
  return DRAGONS.includes(tile) || WINDS.includes(tile)
}

/** Returns true if the exposed meld is a pung or kong of the given tile. */
function exposedPungOf(exposed, tile) {
  return exposed.some(m => m[0] === tile && m.every(t => t === tile) && m.length >= 3)
}

/**
 * Returns true if the concealed hand tiles can be decomposed into all chows + exactly one pair.
 * Honors cannot form chows so any honor in the hand causes immediate failure.
 */
function canFormAllChows(counts, pairUsed = false) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0)
  if (entries.length === 0) return pairUsed

  entries.sort(([a], [b]) => a.localeCompare(b))
  const [[first, firstCount]] = entries

  const suit = getSuit(first)
  if (!suit) return false // honor tile — cannot form a chow

  const num = parseInt(first.replace(suit, ''))

  // Try as pair (only one pair allowed)
  if (!pairUsed && firstCount >= 2) {
    const next = { ...counts, [first]: firstCount - 2 }
    if (next[first] === 0) delete next[first]
    if (canFormAllChows(next, true)) return true
  }

  // Try as the low tile of a chow
  const mid = `${suit}${num + 1}`
  const end = `${suit}${num + 2}`
  if ((counts[mid] ?? 0) > 0 && (counts[end] ?? 0) > 0) {
    const next = { ...counts }
    next[first]--; if (next[first] === 0) delete next[first]
    next[mid]--;   if (next[mid]   === 0) delete next[mid]
    next[end]--;   if (next[end]   === 0) delete next[end]
    if (canFormAllChows(next, pairUsed)) return true
  }

  return false
}

/** Returns true if the hand is a Ping Hu (all-chow) hand — no honors, no pungs/kongs. */
function isPingHu(hand, exposed) {
  if (exposed.some(m => m[0] === m[1])) return false     // exposed pung/kong
  if (exposed.some(m => isHonor(m[0]))) return false     // exposed honor meld
  if (hand.some(isHonor)) return false                   // honor in concealed hand
  return canFormAllChows(tileCount(hand))
}

/** Returns true if the hand is Niku Niku — exactly 7 pairs + 1 triplet, fully concealed. */
function isNikuNiku(hand, exposed) {
  if (exposed.length > 0) return false
  const counts = Object.values(tileCount(hand))
  const pairs = counts.filter(c => c === 2).length
  const trips = counts.filter(c => c === 3).length
  return trips === 1 && pairs === 7 && counts.every(c => c === 2 || c === 3)
}

/**
 * Calculates the score (tai) for a winning hand using Taiwanese IGS rules.
 *
 * @param {object}      params
 * @param {string[]}    params.hand         Concealed tiles in hand at win
 * @param {string[][]}  params.exposed       Exposed melds [[tile,tile,tile], ...]
 * @param {string[]}    params.flowers       Collected flower/season tiles
 * @param {'zimo'|'hupai'} params.winType   How the win was achieved
 * @param {string|null} params.seatWind      Player's seat wind tile name ('Ton'|'Nan'|'Shaa'|'Pei')
 * @param {string|null} params.roundWind     Current round wind tile name
 * @param {boolean}     params.isKongDraw    Won by self-draw after a kong
 * @param {boolean}     params.isKongSteal   Won by stealing an opponent's added kong
 * @param {boolean}     params.isLastTile    Won on the very last tile of the game
 * @param {boolean}     params.isHeavenWin   Dealer wins on their very first draw (天胡)
 * @param {boolean}     params.isEarthWin    Non-dealer wins on their very first draw (地胡)
 * @returns {{ total: number, breakdown: { label: string, points: number }[] }}
 */
export function calculateScore({
  hand,
  exposed,
  flowers,
  winType,
  seatWind    = null,
  roundWind   = null,
  isKongDraw  = false,
  isKongSteal = false,
  isLastTile  = false,
  isHeavenWin = false,
  isEarthWin  = false,
}) {
  const breakdown = []
  const push = (label, points) => breakdown.push({ label, points })

  // ── LIMIT HANDS (return immediately) ────────────────────────────────────
  if (isHeavenWin) {
    push('Heaven Win (天胡) — Dealer wins on first draw', 24)
    return { total: 24, breakdown }
  }
  if (isEarthWin) {
    push('Earth Win (地胡) — First-draw self-draw win', 16)
    return { total: 16, breakdown }
  }

  // ── NIKU NIKU (ニクニク) — 7 pairs + 1 triplet ───────────────────────────
  if (isNikuNiku(hand, exposed)) {
    push('Niku Niku (ニクニク) — 7 pairs + 1 triplet', 20)
  }

  // ── SUIT COMPOSITION ─────────────────────────────────────────────────────
  const allTiles  = [...hand, ...exposed.flat()]
  const suits     = new Set(allTiles.filter(t => getSuit(t) !== null).map(getSuit))
  const hasHonors = allTiles.some(isHonor)
  const allHonors = allTiles.every(isHonor)

  if (allHonors) {
    push('All Honors (字一色)', 8)
  } else if (suits.size === 1 && !hasHonors) {
    push('Pure One Suit (清一色)', 8)
  } else if (suits.size === 1 && hasHonors) {
    push('Mixed One Suit (混一色)', 4)
  }

  // ── DRAGON SETS ───────────────────────────────────────────────────────────
  const handCounts  = tileCount(hand)
  // Count exposed pungs/kongs AND concealed triplets (≥3 in hand)
  const hasPung = (tile) => exposedPungOf(exposed, tile) || (handCounts[tile] ?? 0) >= 3
  const dragonPungs = DRAGONS.filter(hasPung)

  if (dragonPungs.length === 3) {
    push('Big Three Dragons (大三元)', 8)
  } else if (dragonPungs.length === 2) {
    const missingDragon = DRAGONS.find(d => !dragonPungs.includes(d))
    if (missingDragon && handCounts[missingDragon] >= 2) {
      push('Small Three Dragons (小三元)', 4)
    } else {
      for (const d of dragonPungs) push(`${DRAGON_LABELS[d]} Set`, 1)
    }
  } else {
    for (const d of dragonPungs) push(`${DRAGON_LABELS[d]} Set`, 1)
  }

  // ── WIND SETS ─────────────────────────────────────────────────────────────
  const windPungs = WINDS.filter(hasPung)

  if (windPungs.length === 4) {
    push('Big Four Winds (大四喜)', 16)
  } else if (windPungs.length === 3) {
    const missingWind = WINDS.find(w => !windPungs.includes(w))
    if (missingWind && handCounts[missingWind] >= 2) {
      push('Small Four Winds (小四喜)', 8)
    } else {
      for (const w of windPungs) push(`${WIND_LABELS[w]} Wind Set`, 1)
    }
  } else {
    for (const w of windPungs) push(`${WIND_LABELS[w]} Wind Set`, 1)
  }

  // ── ALL PUNGS (碰碰胡) ───────────────────────────────────────────────────
  // All exposed melds must be pungs/kongs AND no single tiles in concealed portion.
  const exposedAllPungs = exposed.length > 0 && exposed.every(m => m.length >= 3)
  const handNoSingles   = Object.values(handCounts).every(c => c >= 2)
  if (exposedAllPungs && handNoSingles) {
    push('All Pungs (碰碰胡)', 4)
  }

  // ── PING HU (平胡) ────────────────────────────────────────────────────────
  // Little: all chows + at least one flower (5 tai)
  // Big:    all chows + no flowers (5 tai)
  if (isPingHu(hand, exposed)) {
    const hasFlowers = flowers.length > 0
    push(hasFlowers ? 'Little Ping Hu (小平胡) — All chows, with flower' : 'Big Ping Hu (大平胡) — All chows, no flowers', 5)
  }

  // ── FLOWERS ───────────────────────────────────────────────────────────────
  const flowerTiles = flowers.filter(f => f.startsWith('Flower'))
  const seasonTiles = flowers.filter(f => f.startsWith('Season'))

  if (flowers.length >= 8) {
    push('Eight Immortals (八仙過海) — All 8 flowers', 8)
  } else {
    // 1 tai per flower/season tile
    for (const f of flowerTiles) push(`Flower tile (${f})`, 1)
    for (const s of seasonTiles) push(`Season tile (${s})`, 1)
  }

  // ── CONCEALED HAND + SELF-DRAW ───────────────────────────────────────────
  // If both apply, the combo is worth 3 tai (not 1+1).
  const isConcealed = exposed.length === 0
  if (isConcealed && winType === 'zimo') {
    push('Concealed Self-Draw (門清自摸)', 3)
  } else {
    if (isConcealed)          push('Clear Door (門清)', 1)
    if (winType === 'zimo')   push('Self-Drawn (自摸)', 1)
  }

  // ── KONGS ─────────────────────────────────────────────────────────────────
  for (const meld of exposed) {
    if (meld.length === 4) push(`Kong — ${DRAGON_LABELS[meld[0]] ?? WIND_LABELS[meld[0]] ?? meld[0]}`, 1)
  }

  // ── SPECIAL WIN CONDITIONS ────────────────────────────────────────────────
  if (isKongDraw)  push('Kong Self-Draw (槓上自摸)', 2)
  if (isKongSteal) push('Kong Steal (搶槓)', 1)

  if (isLastTile) {
    push(winType === 'zimo'
      ? 'Sea Last (海底撈月) — Final wall tile'
      : 'River Last (河底撈魚) — Final discard',
      1)
  }

  const total = breakdown.reduce((sum, item) => sum + item.points, 0)
  return { total, breakdown }
}
