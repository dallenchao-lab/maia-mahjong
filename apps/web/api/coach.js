import Anthropic from '@anthropic-ai/sdk'
import { evaluateDiscard, formatTile, formatHand } from '../../../packages/engine/src/ai/heuristic.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(tile) { return formatTile(tile) }
function fmtList(tiles) { return formatHand(tiles) }
function fmtMelds(melds) {
  return melds.length ? melds.map(m => m.map(fmt).join('-')).join(' | ') : 'none'
}

function buildSystemPrompt() {
  return `You are Maia, an expert Taiwanese 16-tile Mahjong coach embedded in the player's game. You are concise, sharp, and strategic.

Tile naming used in this game:
- Suits: "1 Balls" through "9 Balls" (circles/dots), "1 Stripes" through "9 Stripes" (bamboo), "1 Characters" through "9 Characters"
- Winds: East, South, West, North
- Dragons: White Dragon, Green Dragon, Red Dragon
- Flowers: Flower 1–4, Season 1–4 (bonus tiles, auto-drawn)

Mahjong concepts you know:
- Pon: claim a discard to form a triplet (exposed)
- Chow: claim the left neighbor's discard to complete a sequence (exposed)
- Kong: four-of-a-kind meld (draw a replacement tile)
- Hu (胡): winning hand = 5 melds + 1 pair (or special hands)
- One tile from winning = ready hand

Always lead with the specific action in bold (e.g. **Discard 9 Stripes** or **Pon**). Follow with 1-2 sentences explaining the concrete reason using the tile names above. Never give generic advice like "if it helps your hand" — always reference specific tiles and the meld or strategy they enable.`
}

function buildDiscardPrompt(hand, exposed, flowers, discardPile, remainingCount) {
  const heuristic = evaluateDiscard(hand, false)
  return `My hand: ${fmtList(hand)}
Exposed melds: ${fmtMelds(exposed)}
Flowers/Seasons collected: ${flowers.length ? fmtList(flowers) : 'none'}
Recent discards: ${discardPile.slice(-8).length ? fmtList(discardPile.slice(-8)) : 'none'}
Tiles remaining in wall: ${remainingCount}
Heuristic suggestion: ${fmt(heuristic.recommendedDiscard)} — ${heuristic.reason}

What should I discard and why?`
}

function buildInterruptPrompt(hand, exposed, discardedTile, availableActions, sourcePlayer) {
  return `Player ${sourcePlayer} just discarded: ${fmt(discardedTile)}
My hand: ${fmtList(hand)}
Exposed melds: ${fmtMelds(exposed)}
Options available: ${availableActions.join(', ')}

Give me a direct, educational recommendation. Start with the action I should take (e.g. "Pon", "Pass", "Chow") in bold, then explain in 1-2 sentences exactly why — what meld it completes, how it moves me toward winning, or why passing is smarter. Be specific about my tiles, not generic.`
}

// Shared request handler — used by both Vite dev middleware and Vercel function
export async function coachHandler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  // Parse body — handle both Vite (raw Node req) and Vercel (already parsed)
  let body
  if (req.body) {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } else {
    body = await new Promise((resolve, reject) => {
      let data = ''
      req.on('data', chunk => (data += chunk))
      req.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
      req.on('error', reject)
    })
  }

  const { mode, hand, exposed = [], flowers = [], discardPile = [], remainingCount = 0, discardedTile, availableActions = [], sourcePlayer } = body

  if (!hand || !hand.length) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'hand is required' }))
    return
  }

  try {
    const userPrompt = mode === 'interrupt'
      ? buildInterruptPrompt(hand, exposed, discardedTile, availableActions, sourcePlayer)
      : buildDiscardPrompt(hand, exposed, flowers, discardPile, remainingCount)

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userPrompt }]
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ response: message.content[0].text }))
  } catch (err) {
    console.error('Coach API error:', err)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

// Vercel serverless export
export default async function handler(req, res) {
  return coachHandler(req, res)
}
