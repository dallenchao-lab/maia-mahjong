import React, { useState, useEffect } from 'react'
import { 
  generateDeck, dealInitialHands, sortHand, checkWin, 
  getAvailableInteractions, calculateScore,
  rankDiscards, getBotInterruptAction, getAllAvailableChows
} from '@maia-mahjong/engine'
import { useMoneyStore } from './store/useMoneyStore'
import Tile from './components/Tile'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const BOT1 = 'player1' // Right
const BOT2 = 'player2' // Top
const BOT3 = 'player3' // Left
const USER = 'player0' // Bottom

export default function BotMatchMode({ onExit }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [deck, setDeck] = useState([])
  const { balance, winMoney, loseMoney } = useMoneyStore()
  
  const [hands, setHands] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] })
  const [exposed, setExposed] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] })
  const [flowers, setFlowers] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] })
  const [globalDiscard, setGlobalDiscard] = useState([])
  
  const [currentTurn, setCurrentTurn] = useState(0)
  const [gamePhase, setGamePhase] = useState('playing') 
  const [winState, setWinState] = useState(null)
  
  const [selectedTile, setSelectedTile] = useState(null)
  const [pendingInteraction, setPendingInteraction] = useState(null)

  const startGame = () => {
    const newDeck = generateDeck(true)
    const dealt = dealInitialHands(newDeck)
    
    setHands({
      [USER]: sortHand(dealt.hands.dealer),
      [BOT1]: sortHand(dealt.hands.player1),
      [BOT2]: sortHand(dealt.hands.player2),
      [BOT3]: sortHand(dealt.hands.player3)
    })
    setExposed({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] })
    setFlowers({ 
      [USER]: dealt.flowers.dealer, 
      [BOT1]: dealt.flowers.player1, 
      [BOT2]: dealt.flowers.player2, 
      [BOT3]: dealt.flowers.player3 
    })
    setGlobalDiscard([])
    setDeck(dealt.remainingDeck)
    setCurrentTurn(0)
    setGamePhase('playing')
    setWinState(null)
    setPendingInteraction(null)
    setSelectedTile(null)
    setIsInitialized(true)
  }

  useEffect(() => {
    startGame()
  }, [])

  // Bot Turn Loop
  useEffect(() => {
    if (!isInitialized || gamePhase !== 'playing' || pendingInteraction !== null || currentTurn === 0) return

    let isActive = true

    const runBotTurn = async () => {
      await new Promise(r => setTimeout(r, 600))
      if (!isActive) return

      const playerKey = `player${currentTurn}`
      const botHand = [...hands[playerKey]]
      let freshDeck = [...deck]

      if (freshDeck.length === 0) {
        setGamePhase('draw')
        return
      }

      let draw = freshDeck.pop()
      let newFlowers = []
      while (draw.startsWith('Flower') || draw.startsWith('Season')) {
        newFlowers.push(draw)
        if (freshDeck.length === 0) { 
           setFlowers(prev => ({ ...prev, [playerKey]: [...prev[playerKey], ...newFlowers] }))
           setGamePhase('draw'); 
           return; 
        }
        draw = freshDeck.pop()
      }
      
      if (newFlowers.length > 0) {
         setFlowers(prev => ({ ...prev, [playerKey]: [...prev[playerKey], ...newFlowers] }))
      }
      botHand.push(draw)

      if (checkWin(botHand)) {
        handleWin(currentTurn, 'zimo', botHand, exposed[playerKey])
        return
      }

      await new Promise(r => setTimeout(r, 400))
      if (!isActive) return
      
      const Ranked = rankDiscards(botHand)
      const chosenDiscard = Ranked[0].tile
      
      const newBotHand = [...botHand]
      newBotHand.splice(newBotHand.indexOf(chosenDiscard), 1)
      
      setHands(prev => ({ ...prev, [playerKey]: sortHand(newBotHand) }))
      setGlobalDiscard(prev => [...prev, chosenDiscard])
      setDeck(freshDeck)

      processDiscard(playerKey, chosenDiscard, newBotHand, freshDeck)
    }

    runBotTurn()
    return () => { isActive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gamePhase, pendingInteraction, isInitialized])

  const processDiscard = (sourcePlayerKey, discardedTile, sourceHandAfterDiscard, currentDeck) => {
    let nextTurn = (parseInt(sourcePlayerKey.replace('player', '')) + 1) % 4

    // Check User Interrupt
    if (sourcePlayerKey !== USER) {
      const isLeft = sourcePlayerKey === BOT3
      const available = getAvailableInteractions(hands[USER], discardedTile, isLeft)
      if (available.length > 0) {
        setPendingInteraction({ tile: discardedTile, sourceActor: sourcePlayerKey, actions: available, nextTurnIfPass: nextTurn })
        return
      }
    }

    // Check Bot Interrupts
    let interceptor = null
    let interceptedAction = null

    for (let i = 1; i <= 3; i++) {
       const checkTurn = (parseInt(sourcePlayerKey.replace('player', '')) + i) % 4
       if (checkTurn === 0) continue
       const botKey = `player${checkTurn}`
       const isLeftOfBot = (sourcePlayerKey === `player${(checkTurn + 3) % 4}`)
       
       const actions = getAvailableInteractions(hands[botKey], discardedTile, isLeftOfBot)
       if (actions.length > 0) {
          const decision = getBotInterruptAction(hands[botKey], discardedTile, actions)
          if (decision !== 'pass') {
             if (decision === 'hu') {
                interceptor = botKey
                interceptedAction = 'hu'
                break
             } else if (!interceptedAction) {
                interceptor = botKey
                interceptedAction = decision
             }
          }
       }
    }

    if (interceptor && interceptedAction) {
       if (interceptedAction === 'hu') {
          const winHand = [...hands[interceptor], discardedTile]
          handleWin(parseInt(interceptor.replace('player', '')), 'hupai', winHand, exposed[interceptor], sourcePlayerKey)
          return
       } else if (interceptedAction === 'pon') {
          setGlobalDiscard(prev => prev.slice(0, -1)) // Steal from center pile
          setHands(prev => {
            const h = [...prev[interceptor]]
            h.splice(h.indexOf(discardedTile), 1)
            h.splice(h.indexOf(discardedTile), 1)
            return { ...prev, [interceptor]: h }
          })
          setExposed(prev => ({
             ...prev, 
             [interceptor]: [...prev[interceptor], [discardedTile, discardedTile, discardedTile]]
          }))
          
          setCurrentTurn(parseInt(interceptor.replace('player', '')))
          return
       }
    }

    // Advance
    if (nextTurn === 0) {
       let freshDeck = [...currentDeck]
       if (freshDeck.length === 0) { setGamePhase('draw'); return; }
       
       let draw = freshDeck.pop()
       let newFlowers = []
       while (draw && (draw.startsWith('Flower') || draw.startsWith('Season'))) {
          newFlowers.push(draw)
          if (freshDeck.length === 0) { 
             setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }))
             setGamePhase('draw'); 
             return; 
          }
          draw = freshDeck.pop()
       }
       
       if (newFlowers.length > 0) {
          setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }))
       }
       
       const newUserHand = [...hands[USER], draw]
       setDeck(freshDeck)
       setHands(prev => ({...prev, [USER]: newUserHand}))
       
       if (checkWin(newUserHand)) {
          handleWin(0, 'zimo', newUserHand, exposed[USER])
          return
       }
       setCurrentTurn(0)
    } else {
       setCurrentTurn(nextTurn)
    }
  }

  const handleWin = (playerIdx, type, finalHand, finalExposed, dealInSource = null) => {
    let scoreObj = null
    const playerKey = `player${playerIdx}`
    try {
      scoreObj = calculateScore({ hand: finalHand, exposed: finalExposed, flowers: flowers[playerKey] || [], winType: type })
    } catch(e) {
      scoreObj = { total: 1, breakdown: [{ label: 'Win', points: 1 }] }
    }

    // MONEY LOGIC
    let financialImpact = 0
    let impactText = ''
    const amount = 5 + (scoreObj.total * 1) // Base $5 + $1 per Tai
    
    if (playerIdx === 0) { // USER WON!
       if (type === 'zimo') {
          // Self-draw: all 3 opponents pay
          financialImpact = amount * 3
          impactText = '+$' + financialImpact + ' (Self-Draw x3 Bots)'
       } else {
          // Discard Intercept: The discarding player pays
          financialImpact = amount
          impactText = '+$' + financialImpact + ` (Intercept from Player ${dealInSource.replace('player','')})`
       }
       winMoney(financialImpact)
    } else { // A BOT WON!
       if (type === 'zimo') {
          // Self-draw: everyone pays the winner
          financialImpact = -amount
          impactText = '-$' + amount + ` (Self-Draw tax to Player ${playerIdx})`
          loseMoney(amount)
       } else if (dealInSource === 'player0') {
          // YOU threw the intercept tile to a bot. You must pay the full base!
          financialImpact = -amount
          impactText = '-$' + amount + ` (Penalty for Dealing In to Player ${playerIdx})`
          loseMoney(amount)
       } else {
          // A bot dealt into a bot. The dealing bot pays. You pay ZERO!
          financialImpact = 0
          impactText = '$0 (Spectator)'
       }
    }
    
    setWinState({
       winner: playerIdx,
       type: type,
       score: scoreObj,
       penalty: dealInSource ? scoreObj.total : 0,
       penaltyFrom: dealInSource,
       financialImpact,
       impactText
    })
    setGamePhase('win')
  }

  const handleUserDiscard = (tileToDiscard) => {
    if (gamePhase !== 'playing' || currentTurn !== 0) return

    const newHand = [...hands[USER]]
    const index = newHand.indexOf(tileToDiscard)
    if (index > -1) {
      newHand.splice(index, 1)
      setHands(prev => ({...prev, [USER]: sortHand(newHand)}))
      setGlobalDiscard(prev => [...prev, tileToDiscard])
      setSelectedTile(null)
      processDiscard(USER, tileToDiscard, newHand, deck)
    }
  }

  const handleUserAction = (action) => {
      const tile = pendingInteraction.tile
      const sourceActor = pendingInteraction.sourceActor
      let newDeck = [...deck]
      
      if (action === 'pass') {
          setPendingInteraction(null)
          let nextTurn = pendingInteraction.nextTurnIfPass
          
          if (nextTurn === 0) {
             if (newDeck.length === 0) { setGamePhase('draw'); return; }
             
             let draw = newDeck.pop()
             let newFlowers = []
             while (draw && (draw.startsWith('Flower') || draw.startsWith('Season'))) {
                newFlowers.push(draw)
                if (newDeck.length === 0) { 
                   setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }))
                   setGamePhase('draw'); 
                   return; 
                }
                draw = newDeck.pop()
             }
             if (newFlowers.length > 0) {
                 setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }))
             }
             
             setDeck(newDeck)
             setHands(prev => ({...prev, [USER]: [...prev[USER], draw]}))
             setCurrentTurn(0)
          } else {
             setCurrentTurn(nextTurn)
          }
          return
      }

      if (action === 'hu') {
         setPendingInteraction(null)
         handleWin(0, 'hupai', [...hands[USER], tile], exposed[USER], sourceActor)
         return
      }
      
      if (action === 'pon') {
         let newHand = [...hands[USER]]
         newHand.splice(newHand.indexOf(tile), 1)
         newHand.splice(newHand.indexOf(tile), 1)
         setHands(prev => ({...prev, [USER]: newHand}))
         
         setExposed(prev => ({...prev, [USER]: [...prev[USER], [tile, tile, tile]]}))
         setGlobalDiscard(prev => prev.slice(0, -1)) // Steal from center
         
         setPendingInteraction(null)
         setCurrentTurn(0)
         return
      }

      if (action === 'chow') {
         let chows = getAllAvailableChows(hands[USER], tile)
         if (chows.length > 0) {
             let pickedChow = chows[0]
             let newHand = [...hands[USER]]
             
             let toRemove = [...pickedChow]
             toRemove.splice(toRemove.indexOf(tile), 1) 
             
             newHand.splice(newHand.indexOf(toRemove[0]), 1)
             newHand.splice(newHand.indexOf(toRemove[1]), 1)
             
             setHands(prev => ({...prev, [USER]: newHand}))
             setExposed(prev => ({...prev, [USER]: [...prev[USER], pickedChow]}))
             setGlobalDiscard(prev => prev.slice(0, -1)) 
             
             setPendingInteraction(null)
             setCurrentTurn(0)
             return
         }
      }
  }

  if (!isInitialized) return <div className="h-screen w-screen bg-felt flex items-center justify-center text-white"><Loader2 className="animate-spin w-10 h-10" /></div>

  return (
    <div className="h-screen w-screen overflow-hidden bg-felt text-white relative font-sans flex flex-col">
      {/* HEADER NAV */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <button onClick={onExit} className="pointer-events-auto px-4 py-2 bg-red-900/80 hover:bg-red-800 border border-red-500 rounded-md text-xs font-bold uppercase tracking-wider backdrop-blur-sm shadow-lg transition-colors">
          Exit Match
        </button>

        <div className="flex flex-col gap-2 pointer-events-auto">
            <div className="bg-black/60 px-4 py-2 rounded-md border border-white/20 backdrop-blur-sm font-mono text-sm shadow-xl text-right">
              Deck: {deck.length}
            </div>
            <div className={`px-4 py-2 rounded-md border backdrop-blur-sm font-mono text-sm tracking-wider shadow-xl text-right ${balance < 0 ? 'bg-red-900/80 border-red-500/50 text-red-100' : 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100'}`}>
              Bank: ${balance}
            </div>
        </div>
      </div>

      {/* WIN MODAL */}
      {gamePhase === 'win' && winState && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className={`p-8 sm:p-12 rounded-3xl shadow-2xl transform text-center flex flex-col items-center max-w-lg w-full border-4 ${winState.winner === 0 ? 'bg-red-800 border-yellow-400' : 'bg-slate-800 border-slate-600'}`}>
               <h1 className="text-5xl font-black text-yellow-300 drop-shadow-md mb-2 tracking-wider">
                 {winState.winner === 0 ? 'YOU WIN!' : `PLAYER ${winState.winner} WINS`}
               </h1>
               <h2 className="text-xl font-bold text-white mb-6">
                 {winState.type === 'zimo' ? 'Self-Drawn Victory' : 'Discard Intercept (Ron)'}
               </h2>
               
               {winState.penaltyFrom && (
                  <div className="bg-black/40 p-5 rounded-xl w-full mb-6 border border-white/10 shadow-inner">
                     <p className="text-red-400 font-bold mb-1">
                        Player {winState.penaltyFrom === 'player0' ? 'YOU' : winState.penaltyFrom.replace('player', '')} threw the losing tile!
                     </p>
                     <p className="text-white text-3xl font-black">
                        -{winState.penalty} Tai Penalty
                     </p>
                  </div>
               )}

               {/* Financial Impact */}
               <div className={`p-4 rounded-xl w-full mb-6 border-2 shadow-inner bg-black/40 ${winState.financialImpact > 0 ? 'border-emerald-500/30' : winState.financialImpact < 0 ? 'border-red-500/30' : 'border-slate-500/30'}`}>
                   <p className="text-zinc-400 font-bold mb-1 uppercase tracking-widest text-sm">Financial Impact</p>
                   <p className={`text-3xl font-black ${winState.financialImpact > 0 ? 'text-emerald-400' : winState.financialImpact < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {winState.impactText}
                   </p>
               </div>

               <button onClick={startGame} className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-full text-2xl shadow-xl transition-all">Play Again</button>
            </div>
         </div>
      )}

      {/* DRAW MODAL */}
      {gamePhase === 'draw' && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border-4 border-slate-600 p-8 sm:p-12 rounded-3xl shadow-2xl transform text-center flex flex-col items-center">
               <h1 className="text-6xl font-black text-slate-300 mb-6 tracking-wider">DRAW</h1>
               <button onClick={startGame} className="px-8 py-3 bg-slate-300 text-slate-900 font-bold rounded-full text-xl shadow-xl transition-all">Redeal</button>
            </div>
         </div>
      )}

      {/* INTERRUPT MODAL */}
      {pendingInteraction && (
         <div className="absolute inset-x-0 bottom-48 z-50 flex justify-center items-center pointer-events-none animate-in slide-in-from-bottom-5">
             <div className="bg-black/90 border border-yellow-500/80 p-6 rounded-3xl shadow-[0_0_80px_rgba(234,179,8,0.3)] flex flex-col items-center pointer-events-auto backdrop-blur-xl">
                 <div className="flex items-center gap-6 mb-6">
                     <p className="text-yellow-100 opacity-80">Player {pendingInteraction.sourceActor.replace('player','')} discarded:</p>
                     <div className="transform scale-125 rounded-lg"><Tile tileName={pendingInteraction.tile} /></div>
                 </div>
                 <div className="flex gap-4 items-center">
                    <button onClick={() => handleUserAction('pass')} className="px-6 py-2 bg-slate-700/80 hover:bg-slate-600 rounded-full text-white font-semibold transition-colors">Pass</button>
                    {pendingInteraction.actions.includes('chow') && (
                       <button onClick={() => handleUserAction('chow')} className="px-8 py-2 bg-gradient-to-r from-blue-700 to-blue-500 border border-blue-300 rounded-full text-white font-black text-lg shadow-[0_0_25px_rgba(59,130,246,0.6)]">CHOW!</button>
                    )}
                    {pendingInteraction.actions.includes('pon') && (
                       <button onClick={() => handleUserAction('pon')} className="px-8 py-2 bg-gradient-to-r from-orange-700 to-orange-500 border border-orange-300 rounded-full text-white font-black text-lg shadow-[0_0_25px_rgba(249,115,22,0.6)]">PON!</button>
                    )}
                    {pendingInteraction.actions.includes('hu') && (
                       <button onClick={() => handleUserAction('hu')} className="px-10 py-2 bg-gradient-to-r from-red-700 to-red-500 border-2 border-yellow-300 shadow-[0_0_40px_rgba(220,38,38,1)] rounded-full text-yellow-200 font-black text-xl animate-pulse">WIN!</button>
                    )}
                 </div>
             </div>
         </div>
      )}

      {/* TABLE SURFACE */}
      <div className="flex-1 relative flex items-center justify-center p-8 shadow-[inset_0_0_150px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* BOT 2 (TOP) */}
          <div className="absolute top-2 left-0 right-0 flex flex-col items-center pointer-events-none">
              <span className={`text-xs font-bold uppercase tracking-widest mb-2 ${currentTurn === 2 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-zinc-500'}`}>Player 2 (Top)</span>
              
              {(exposed[BOT2].length > 0 || flowers[BOT2].length > 0) && (
                <div className="flex flex-wrap justify-center bg-black/20 rounded shadow-inner p-1 border border-black/40 gap-1 opacity-80 scale-75 transform origin-top mb-4">
                   {flowers[BOT2].length > 0 && (
                      <div className="flex border-r-2 border-pink-600/80 pr-1 mr-1">
                         {flowers[BOT2].map((t, idx) => <div key={idx} className="-m-1"><Tile tileName={t} /></div>)}
                      </div>
                   )}
                   {exposed[BOT2].map((m, i) => (
                       <div key={`b2-m-${i}`} className="flex border-r-2 border-yellow-600/80 pr-1 mr-1">
                          {m.map((t, idx) => <Tile key={idx} tileName={t} />)}
                       </div>
                   ))}
                </div>
              )}
          </div>

          {/* BOT 3 (LEFT) */}
          <div className="absolute left-8 top-[30%] bottom-[30%] flex justify-center items-center pointer-events-none">
              <span className={`absolute -left-12 -rotate-90 text-xs font-bold uppercase tracking-widest ${currentTurn === 3 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-zinc-500'}`}>Player 3</span>
              
              {(exposed[BOT3].length > 0 || flowers[BOT3].length > 0) && (
                <div className="flex flex-col bg-black/20 rounded shadow-inner p-1 border border-black/40 gap-1 opacity-80 scale-75 origin-left absolute left-8">
                   {flowers[BOT3].length > 0 && (
                      <div className="flex flex-row justify-center border-b-2 border-pink-600/80 pb-1 mb-1">
                         {flowers[BOT3].map((t, idx) => <div key={idx} className="-mx-1"><Tile tileName={t} /></div>)}
                      </div>
                   )}
                   {exposed[BOT3].map((m, i) => (
                       <div key={`b3-m-${i}`} className="flex border-b-2 border-yellow-600/80 pb-1 mb-1">
                          {m.map((t, idx) => <div key={idx} className="-m-1"><Tile tileName={t} /></div>)}
                       </div>
                   ))}
                </div>
              )}
          </div>

          {/* BOT 1 (RIGHT) */}
          <div className="absolute right-8 top-[30%] bottom-[30%] flex justify-center items-center pointer-events-none">
              <span className={`absolute -right-12 rotate-90 text-xs font-bold uppercase tracking-widest ${currentTurn === 1 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-zinc-500'}`}>Player 1</span>
              
              {(exposed[BOT1].length > 0 || flowers[BOT1].length > 0) && (
                <div className="flex flex-col bg-black/20 rounded shadow-inner p-1 border border-black/40 gap-1 opacity-80 scale-75 origin-right absolute right-8">
                   {flowers[BOT1].length > 0 && (
                      <div className="flex flex-row justify-center border-b-2 border-pink-600/80 pb-1 mb-1">
                         {flowers[BOT1].map((t, idx) => <div key={idx} className="-mx-1"><Tile tileName={t} /></div>)}
                      </div>
                   )}
                   {exposed[BOT1].map((m, i) => (
                       <div key={`b1-m-${i}`} className="flex border-b-2 border-yellow-600/80 pb-1 mb-1">
                          {m.map((t, idx) => <div key={idx} className="-m-1"><Tile tileName={t} /></div>)}
                       </div>
                   ))}
                </div>
              )}
          </div>

          {/* CENTER TABLE & DISCARDS */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-16 mt-8">
              <div className="w-full h-full max-w-3xl max-h-72 flex flex-wrap content-center items-center justify-center opacity-90 overflow-visible">
                  {globalDiscard.map((t, idx) => (
                      <div key={idx} className={`-m-2 md:-m-3 transform scale-50 md:scale-[0.55] transition-all duration-300 ${idx === globalDiscard.length - 1 ? 'ring-[6px] ring-yellow-400 rounded opacity-100 scale-[0.6] md:scale-[0.65] z-10 shadow-[0_0_20px_rgba(234,179,8,0.8)]' : 'hover:z-20 shadow-md opacity-90'}`}>
                          <Tile tileName={t} />
                      </div>
                  ))}
                  {globalDiscard.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30 mt-6">
                          <span className="text-xl sm:text-4xl text-emerald-900 font-black tracking-[0.5em] uppercase text-center border-4 border-emerald-900/50 p-6 sm:p-12 rounded-full shadow-inner">
                             Bot<br/>Match
                          </span>
                      </div>
                  )}
              </div>
              
              {/* User Action Overlay */}
              {currentTurn === 0 && gamePhase === 'playing' && !pendingInteraction && (
                 <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-4 animate-in slide-in-from-bottom-2 fade-in pointer-events-auto">
                   {selectedTile && (
                       <button 
                         onClick={() => handleUserDiscard(selectedTile)}
                         className="px-6 sm:px-10 py-2 sm:py-3 border-2 border-red-500 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-[0_10px_20px_rgba(220,38,38,0.4)] transition-transform transform hover:scale-105 active:scale-95 text-sm sm:text-lg whitespace-nowrap"
                       >
                         Discard Selection
                       </button>
                   )}
                 </div>
              )}
          </div>
      </div>

      {/* USER HAND TRAY */}
      <div className="relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] bg-wood-light border-t-4 border-wood flex flex-col justify-end px-2 sm:px-8 py-4 overflow-x-auto">
         <div className="flex items-center gap-4 mx-auto w-max mb-2">
            <span className={`text-sm font-black tracking-widest uppercase ${currentTurn === 0 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-zinc-500'}`}>You (Bottom)</span>
         </div>
         
         <div className="flex mx-auto items-end bg-black/20 p-2 rounded-xl backdrop-blur-sm border border-black/30 shadow-inner overflow-hidden">
            {flowers[USER].length > 0 && (
               <div className="flex gap-[1px] bg-black/30 rounded p-1 sm:p-2 border-b-2 border-pink-500/80 mr-4 shadow-md">
                  {flowers[USER].map((t, i) => <Tile key={`wf-${i}`} tileName={t} />)}
               </div>
            )}

            {exposed[USER].length > 0 && exposed[USER].map((m, mIdx) => (
               <div key={`u-exp-${mIdx}`} className="flex gap-[1px] bg-black/30 rounded p-1 sm:p-2 border-b-2 border-yellow-500/80 mr-4 shadow-md">
                  {m.map((t, i) => <Tile key={`we-${mIdx}-${i}`} tileName={t} />)}
               </div>
            ))}
            
            <div className={`flex ${currentTurn === 0 && !pendingInteraction ? 'opacity-100' : 'opacity-80 transition-opacity'}`}>
               {hands[USER].map((tileName, idx) => {
                  const isNewlyDrawn = idx === hands[USER].length - 1 && hands[USER].length === (17 - (exposed[USER].length*3)); // Flowers don't count towards hand count
                  return (
                     <div key={`ut-${idx}`} className={`relative ${isNewlyDrawn ? 'ml-6' : ''}`}>
                        <Tile 
                          tileName={tileName} 
                          onClick={() => setSelectedTile(selectedTile === tileName ? null : tileName)}
                          selected={selectedTile === tileName}
                        />
                     </div>
                  )
               })}
            </div>
         </div>
      </div>

    </div>
  )
}
