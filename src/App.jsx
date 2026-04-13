import { useState, useEffect } from 'react'
import { generateDeck, dealInitialHands, sortHand, checkWin } from './game/gameState'
import { askMockCoach } from './ai/mockAiService'
import Tile from './components/Tile'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Game Loop states
  const [remainingDeck, setRemainingDeck] = useState([])
  const [opponents, setOpponents] = useState({ player1: [], player2: [], player3: [] })
  const [discardPile, setDiscardPile] = useState([])
  
  // Player state
  const [playerHand, setPlayerHand] = useState([])
  const [playerFlowers, setPlayerFlowers] = useState([])
  const [selectedTile, setSelectedTile] = useState(null)
  
  const [currentTurn, setCurrentTurn] = useState('user') // 'user' | 'bots'
  const [gamePhase, setGamePhase] = useState('playing') // 'playing' | 'win' | 'draw'
  
  // AI State
  const [isCoachOpen, setIsCoachOpen] = useState(true)
  const [coachMessages, setCoachMessages] = useState([
    { id: 1, role: 'ai', text: 'I am ready to analyze your hand when prompted.' }
  ])
  const [isThinking, setIsThinking] = useState(false)

  // Initialize Game
  useEffect(() => {
    startNewGame();
  }, [])

  const startNewGame = () => {
    const deck = generateDeck(true);
    const { hands, flowers, remainingDeck: newRemaining } = dealInitialHands(deck);
    
    setRemainingDeck(newRemaining);
    setOpponents({
      player1: hands.player1,
      player2: hands.player2,
      player3: hands.player3
    });
    
    setPlayerHand(hands.dealer);
    setPlayerFlowers(flowers.dealer || []);
    setDiscardPile([]);
    setCurrentTurn('user');
    setGamePhase('playing');
    setSelectedTile(null);
    setCoachMessages([
      { id: 1, role: 'ai', text: 'New game started! I am ready to analyze your hand.' }
    ]);
    
    if (checkWin(hands.dealer)) {
        setGamePhase('win');
    }
    
    setIsInitialized(true);
  }

  // Handle Bots Turn Loop
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    
    if (currentTurn === 'bots') {
        const processBotsTurn = async () => {
            // 600ms delay for visual feedback that opponents are playing
            await new Promise(r => setTimeout(r, 600));

            let freshDeck = [...remainingDeck];
            let freshOpponents = {...opponents};
            let freshDiscard = [...discardPile];
            let freshPlayersDeck = [...playerHand];
            let freshPlayerFlowers = [...playerFlowers];

            // 1) Sequentially, Player 1, 2, and 3 draw and discard
            for (let bot of ['player1', 'player2', 'player3']) {
                if (freshDeck.length === 0) {
                    setGamePhase('draw');
                    return;
                }
                
                let hasFlower = true;
                while (hasFlower && freshDeck.length > 0) {
                    let draw = freshDeck.pop();
                    if (draw.startsWith('Flower') || draw.startsWith('Season')) {
                        // bots auto-discard/replace their flowers silently
                        hasFlower = true; 
                    } else {
                        freshOpponents[bot].push(draw);
                        hasFlower = false;
                    }
                }

                if (freshOpponents[bot].length > 0) {
                    // Bot discards a random tile from hand
                    const rIndex = Math.floor(Math.random() * freshOpponents[bot].length);
                    const disc = freshOpponents[bot].splice(rIndex, 1)[0];
                    freshDiscard.push(disc);
                }
            }
            
            // 2) Pass turn back. User draws their mandatory start-of-turn tile!
            if (freshDeck.length === 0) {
                setGamePhase('draw');
            } else {
               let hasFlower = true;
               while (hasFlower && freshDeck.length > 0) {
                  let draw = freshDeck.pop();
                  // Extract user flowers visually
                  if (draw.startsWith('Flower') || draw.startsWith('Season')) {
                     freshPlayerFlowers.push(draw);
                  } else {
                     freshPlayersDeck.push(draw);
                     hasFlower = false;
                  }
               }
               
               // Resort hand after drawing
               freshPlayersDeck = sortHand(freshPlayersDeck);
               setPlayerHand(freshPlayersDeck);
               setPlayerFlowers(freshPlayerFlowers);

               // Mathatically check if the new 17-tile hand is a winner
               if (checkWin(freshPlayersDeck)) {
                   setGamePhase('win');
               }
            }

            // Sync state
            setRemainingDeck(freshDeck);
            setOpponents(freshOpponents);
            setDiscardPile(freshDiscard);
            setCurrentTurn('user');
        };

        processBotsTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gamePhase]);

  const handleTileClick = (tileName) => {
    setSelectedTile(selectedTile === tileName ? null : tileName);
  }

  const handleAskCoach = async () => {
    if (isThinking) return;
    
    setCoachMessages(prev => [...prev, { id: Date.now(), role: 'user', text: 'What should I do?' }]);
    setIsThinking(true);

    try {
      const response = await askMockCoach(playerHand, false);
      setCoachMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: response }]);
    } catch (error) {
      setCoachMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: 'Sorry, my advanced heuristic engine encountered a glitch! ' + error.message }]);
    } finally {
      setIsThinking(false);
    }
  }

  const handleDiscard = (tileToDiscard) => {
    if (gamePhase !== 'playing' || currentTurn !== 'user') return;
    if (!tileToDiscard) return; // Must have a tile
    
    // Splice tile, push to global discard, and advance turn!
    const newHand = [...playerHand];
    const index = newHand.indexOf(tileToDiscard);
    if (index > -1) {
      newHand.splice(index, 1);
      setPlayerHand(sortHand(newHand));
      setDiscardPile(prev => [...prev, tileToDiscard]);
      setSelectedTile(null);
      setCurrentTurn('bots');
    }
  }

  if (!isInitialized) return <div className="h-screen w-screen bg-felt flex items-center justify-center text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-[1fr_auto_auto] md:grid-rows-[1fr_auto] h-screen w-screen overflow-hidden bg-felt text-white relative">
      
      {/* GAME OVERLAYS */}
      {gamePhase === 'win' && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-red-700 border-4 border-yellow-400 p-8 sm:p-12 rounded-3xl shadow-[0_0_100px_rgba(255,0,0,0.8)] transform text-center flex flex-col items-center">
               <h1 className="text-5xl sm:text-7xl font-black text-yellow-300 drop-shadow-lg mb-2 tracking-wider">HU!</h1>
               <h2 className="text-2xl sm:text-3xl font-bold text-yellow-100 mb-6 drop-shadow-md">YOU WIN!</h2>
               <div className="flex bg-black/40 p-3 sm:p-5 rounded-2xl shadow-inner mb-8 transform scale-90 sm:scale-100 max-w-[90vw] overflow-x-auto">
                  {playerHand.map((t, i) => <Tile key={`win-${i}`} tileName={t} />)}
               </div>
               <button onClick={startNewGame} className="px-8 py-3 bg-gradient-to-b from-yellow-300 to-yellow-500 text-red-950 font-bold rounded-full text-xl shadow-xl hover:scale-105 active:scale-95 transition-all outline-none border-2 border-yellow-200">Play Again</button>
            </div>
         </div>
      )}
      
      {gamePhase === 'draw' && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border-4 border-slate-600 p-8 sm:p-12 rounded-3xl shadow-2xl transform text-center flex flex-col items-center">
               <h1 className="text-4xl sm:text-6xl font-black text-slate-300 drop-shadow-lg mb-6 tracking-wider">DRAW</h1>
               <p className="text-slate-400 mb-8 max-w-xs leading-relaxed">The wall has been completely depleted. No player formed 5 Melds and a Pair.</p>
               <button onClick={startNewGame} className="px-8 py-3 bg-slate-300 text-slate-900 font-bold rounded-full text-xl shadow-xl hover:scale-105 active:scale-95 transition-all">Redeal</button>
            </div>
         </div>
      )}

      {/* 1. TABLE CENTER */}
      <div className="col-start-1 row-start-1 md:col-start-1 md:col-span-2 md:row-start-1 relative z-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex flex-col min-h-0">
         
         {/* Top HUD */}
         <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <button onClick={startNewGame} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-800 border border-green-600 rounded text-xs sm:text-base shadow-sm hover:bg-green-700 transition w-max">Rearrange & Redeal</button>
            <div className="px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-mono bg-black/30 rounded border border-white/10 text-white/70 w-max shadow-inner">
               Wall: {remainingDeck.length} Tiles
            </div>
         </div>
         
         {/* Discard / Center Felt */}
         <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 overflow-hidden w-full h-full p-4 sm:p-12">
            <div className={`absolute inset-0 p-8 flex flex-wrap content-start items-start justify-center gap-1 sm:gap-2 overflow-y-auto ${discardPile.length === 0 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}>
               {discardPile.map((t, idx) => (
                  <div key={`discard-${idx}`} className="w-6 h-9 sm:w-10 sm:h-14 opacity-80 transform shadow-sm rounded flex items-center justify-center bg-[#FCFCFC] border border-gray-300/50">
                      <img src={`/tiles/${t}.svg?v=6`} className="w-full h-full object-contain p-[2px]" draggable={false} alt={t}/>
                  </div>
               ))}
            </div>
            
            {discardPile.length === 0 && (
                <div className="w-48 h-48 sm:w-64 sm:h-64 border-4 border-green-800 rounded-lg flex items-center justify-center bg-green-900/40 transform scale-75 md:scale-100">
                    <span className="text-xl sm:text-3xl text-green-700 font-bold opacity-30 tracking-widest uppercase text-center leading-loose">Maia<br/>Mahjong</span>
                </div>
            )}
            
            {/* Center Logo/Bots Display (Hidden slightly if discards pile up) */}
            {discardPile.length < 15 && (
               <div className={`absolute top-1/4 right-1/4 transform rotate-12 flex -space-x-4 sm:-space-x-10 shadow-xl scale-50 sm:scale-100 max-w-[50%] transition-opacity duration-1000 ${discardPile.length > 5 ? 'opacity-10' : 'opacity-100'}`}>
                  <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-1"></div>
                  <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-2"></div>
                  <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-3"></div>
                  <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform flex items-center justify-center" style={{ backgroundColor: '#FCFCFC' }}>
                     <img src="/tiles/Back.svg" className="opacity-90 w-full h-full object-cover p-1" draggable={false} alt="Deck" />
                  </div>
               </div>
            )}
            
            {/* User Action: Discard Overlay */}
            {selectedTile && currentTurn === 'user' && gamePhase === 'playing' && (
               <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom-2 fade-in">
                 <button 
                   onClick={() => handleDiscard(selectedTile)}
                   className="px-6 sm:px-10 py-2 sm:py-3 border-2 border-red-500 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-[0_10px_20px_rgba(220,38,38,0.4)] transition-transform transform hover:scale-105 active:scale-95 text-sm sm:text-lg whitespace-nowrap"
                 >
                   Discard Selection
                 </button>
               </div>
            )}
         </div>
      </div>

      {/* 2. PLAYER TRAY (Middle in portrait, Bottom in desktop) */}
      <div 
         className="col-start-1 row-start-2 md:col-start-1 md:col-span-3 md:row-start-2 relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] bg-wood-light border-t-[2px] sm:border-t-[6px] border-wood flex flex-col justify-end px-1 sm:px-6 py-2 overflow-x-auto"
         style={{ 
           scrollbarWidth: 'none',
           backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z\' fill=\'%233e2723\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' 
         }}
      >
         {/* Bonus Rack for Extracted Flowers */}
         {playerFlowers.length > 0 && (
           <div className="flex bg-black/10 p-1 sm:p-2 rounded-lg backdrop-blur-sm shadow-inner w-max mx-auto mb-2 transform scale-75 sm:scale-90 opacity-90 transition-all duration-500">
             {playerFlowers.map((flower, i) => (
                <Tile key={`flower-${flower}-${i}`} tileName={flower} />
             ))}
           </div>
         )}
         
         <div className={`flex p-1 sm:p-2 rounded-lg backdrop-blur-sm border-b-[4px] w-max shrink-0 shadow-lg mx-auto transition-colors duration-500 ${currentTurn === 'user' ? 'bg-emerald-900/30 border-emerald-900/50' : 'bg-black/20 border-black/30'}`}>
           {playerHand.map((tile, i) => (
             <Tile 
               key={`${tile}-${i}`} 
               tileName={tile} 
               selected={selectedTile === tile}
               onClick={handleTileClick}
             />
           ))}
         </div>
         
         {currentTurn === 'user' && gamePhase === 'playing' ? (
             <div className="absolute top-2 left-6 text-emerald-100 text-xs sm:text-sm font-bold bg-emerald-700/80 px-3 py-1 rounded-full shadow animate-pulse hidden sm:block">
                 Your Turn
             </div>
         ) : null}
      </div>

      {/* 3. AI COACH PANEL (Bottom in portrait, Right in desktop) */}
      <div className={`col-start-1 row-start-3 md:col-start-3 md:col-span-1 md:row-start-1 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] md:shadow-2xl bg-zinc-950 border-t border-white/10 md:border-t-0 md:border-l flex flex-col transition-all duration-300 overflow-hidden ${isCoachOpen ? 'h-[40vh] md:h-full' : 'h-14 sm:h-16 md:h-auto md:max-h-16'}`}>
        <div 
           className="p-3 sm:p-5 border-b border-white/10 bg-zinc-900/50 backdrop-blur flex justify-between items-center cursor-pointer select-none shrink-0"
           onClick={() => setIsCoachOpen(!isCoachOpen)}
        >
          <div>
            <h2 className="font-semibold flex items-center gap-2 sm:gap-3 text-sm sm:text-lg text-white/90">
               <div className="relative flex h-2 w-2 sm:h-3 sm:w-3">
                 <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentTurn === 'user' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 ${currentTurn === 'user' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
               </div>
               Antigravity Coach
            </h2>
            <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 ml-4 sm:ml-6">v1.0 Dallen Heuristics Engine</p>
          </div>
          <div className="p-2 sm:p-1 hover:bg-white/10 rounded-full transition-colors">
             {isCoachOpen ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-white/50" /> : <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-white/50" />}
          </div>
        </div>
        
        <div className={`flex flex-col flex-1 overflow-hidden transition-opacity duration-300 ${isCoachOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Chat Feed */}
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex flex-col gap-3 sm:gap-4 min-h-[50px]" style={{ scrollbarWidth: 'none' }}>
             {coachMessages.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[90%] sm:max-w-[85%] p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md
                    ${msg.role === 'user' 
                      ? 'bg-emerald-600/90 text-emerald-50 rounded-tr-sm' 
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-tl-sm'}
                  `}>
                    {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white bg-zinc-950/40 px-1 rounded">{part}</strong> : part)}
                  </div>
               </div>
             ))}
             {isThinking && (
               <div className="flex justify-start">
                 <div className="bg-zinc-800 p-2 sm:p-4 rounded-2xl rounded-tl-sm shadow-md flex items-center gap-2">
                   <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500 animate-spin" />
                   <span className="text-zinc-400 text-xs sm:text-sm italic">Analyzing matrix...</span>
                 </div>
               </div>
             )}
          </div>
          
          {/* Input Area */}
          <div className="p-2 sm:p-4 border-t border-white/10 bg-zinc-900/30 shrink-0">
             <button 
                onClick={handleAskCoach}
                disabled={isThinking || playerHand.length === 0}
                className="w-full group relative overflow-hidden bg-white text-zinc-900 font-medium py-2 sm:py-3 px-4 rounded-lg sm:rounded-xl transition-all hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-[0.98] text-xs sm:text-base flex items-center justify-center gap-2"
             >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2 font-semibold tracking-wide">
                   <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                   Ask Coach for Discard Move
                </div>
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
