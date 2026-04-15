/**
 * Real AI Coach service — calls /api/coach which proxies to Claude.
 * Falls back to the heuristic engine if the API is unreachable.
 */
import { evaluateDiscard, formatTile } from './heuristic.js'

async function callCoach(payload) {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Coach API returned ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.response
}

/**
 * Ask the coach for a discard recommendation.
 * @param {string[]} hand
 * @param {string[][]} exposed
 * @param {string[]} flowers
 * @param {string[]} discardPile
 * @param {number} remainingCount
 */
export async function askCoach(hand, exposed = [], flowers = [], discardPile = [], remainingCount = 0) {
  try {
    return await callCoach({ mode: 'discard', hand, exposed, flowers, discardPile, remainingCount })
  } catch (err) {
    console.warn('AI coach unavailable, falling back to heuristic:', err.message)
    const analysis = evaluateDiscard(hand, false)
    return `*(Offline — heuristic fallback)*\n\nDiscard **${formatTile(analysis.recommendedDiscard)}**. ${analysis.reason}`
  }
}

/**
 * Ask the coach whether to claim an interrupt action (Pon/Chow/Kong/Hu).
 * @param {string[]} hand
 * @param {string[][]} exposed
 * @param {string} discardedTile
 * @param {string[]} availableActions
 * @param {number} sourcePlayer
 */
export async function askCoachInterrupt(hand, exposed = [], discardedTile, availableActions, sourcePlayer) {
  try {
    return await callCoach({ mode: 'interrupt', hand, exposed, discardedTile, availableActions, sourcePlayer })
  } catch (err) {
    console.warn('AI coach unavailable for interrupt:', err.message)
    const tile = formatTile(discardedTile)
    if (availableActions.includes('hu')) return `**Win!** — ${tile} completes your hand. Declare victory immediately.`
    if (availableActions.includes('pon')) return `*(Offline)* Consider **Pon** on ${tile} if it completes a triplet that advances your hand.`
    return `*(Offline)* No strong recommendation — **Pass** if unsure.`
  }
}
