import Anthropic from '@anthropic-ai/sdk'
import { evaluateDiscard } from '../../../packages/engine/src/ai/heuristic.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt() {
  return `You are Maia, an expert Taiwanese 16-tile Mahjong coach embedded in the player's game. You are concise, sharp, and strategic.

Tile naming convention:
- Suits: Man1–Man9 (Characters), Pin1–Pin9 (Dots), Sou1–Sou9 (Bamboo)
- Honors: Ton/Nan/Shaa/Pei (Winds), Haku/Hatsu/Chun (Dragons)
- Flowers: Flower1–4, Season1–4 (scored as bonuses, auto-drawn)

Mahjong concepts you know:
- Pon: claim a discard to form a triplet (exposed)
- Chow: claim the left neighbor's discard to complete a sequence (exposed)
- Kong: four-of-a-kind meld (draw a replacement tile)
- Hu (胡): winning hand = 5 melds + 1 pair (or special hands)
- Tenpai / Tīng Pái: one tile away from winning

Keep responses under 3 sentences. Be direct — lead with the recommendation, then the reasoning.`
}

function buildDiscardPrompt(hand, exposed, flowers, discardPile, remainingCount) {
  const heuristic = evaluateDiscard(hand, false)
  return `My hand: ${hand.join(', ')}
Exposed melds: ${exposed.length ? exposed.map(m => m.join('-')).join(' | ') : 'none'}
Flowers/Seasons collected: ${flowers.length ? flowers.join(', ') : 'none'}
Recent discards: ${discardPile.slice(-8).join(', ') || 'none'}
Tiles remaining in wall: ${remainingCount}
Heuristic suggestion: ${heuristic.recommendedDiscard} (${heuristic.reason})

What should I discard and why?`
}

function buildInterruptPrompt(hand, exposed, discardedTile, availableActions, sourcePlayer) {
  return `Player ${sourcePlayer} just discarded: ${discardedTile}
My hand: ${hand.join(', ')}
Exposed melds: ${exposed.length ? exposed.map(m => m.join('-')).join(' | ') : 'none'}
Options available to me: ${availableActions.join(', ')}

Should I claim this tile, and which action should I take?`
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
