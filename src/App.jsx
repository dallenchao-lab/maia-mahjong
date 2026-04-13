import { useState, useEffect } from 'react'
import { generateDeck, dealInitialHands, sortHand, checkWin, getAvailableInteractions, getAllAvailableChows, getAvailableSelfKongs } from './game/gameState'
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
  const [playerExposed, setPlayerExposed] = useState([]) // Stores arrays of melds, e.g. [['Pin3', 'Pin3', 'Pin3']]
  const [selectedTile, setSelectedTile] = useState(null)
  
  const [currentTurn, setCurrentTurn] = useState(0) // 0: User, 1: Player1, 2: Player2, 3: Player3
  const [gamePhase, setGamePhase] = useState('playing') // 'playing' | 'win' | 'draw'
  const [pendingInteraction, setPendingInteraction] = useState(null) // { tile, sourceActor, actions: [] }
  
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
    
    const sortedDealer = sortHand(hands.dealer.slice(0, 16));
    if (hands.dealer[16]) {
        sortedDealer.push(hands.dealer[16]);
    }
    
    setPlayerHand(sortedDealer);
    setPlayerFlowers(flowers.dealer || []);
    setPlayerExposed([]);
    setDiscardPile([]);
    setCurrentTurn(0);
    setGamePhase('playing');
    setPendingInteraction(null);
    setSelectedTile(null);
    setCoachMessages([
      { id: 1, role: 'ai', text: 'New game started! I am ready to analyze your hand.' }
    ]);
    
    if (checkWin(hands.dealer)) {
        setGamePhase('win');
    }
    
    setIsInitialized(true);
  }

  // De-coupled User Draw Phase
  const executeUserDraw = (deckBase) => {
      let freshDeck = [...deckBase];
      let freshPlayersDeck = sortHand([...playerHand]);
      let freshPlayerFlowers = [...playerFlowers];

      if (freshDeck.length === 0) {
          setGamePhase('draw');
          setRemainingDeck(freshDeck);
          return;
      }
      
      let drawnTile = null;
      let hasFlower = true;
      while (hasFlower && freshDeck.length > 0) {
         let draw = freshDeck.pop();
         if (draw.startsWith('Flower') || draw.startsWith('Season')) {
            freshPlayerFlowers.push(draw);
         } else {
            drawnTile = draw;
            hasFlower = false;
         }
      }
      
      if (drawnTile) freshPlayersDeck.push(drawnTile);
      
      setPlayerHand(freshPlayersDeck);
      setPlayerFlowers(freshPlayerFlowers);
      setRemainingDeck(freshDeck);
      setCurrentTurn(0);
      
      if (checkWin(freshPlayersDeck)) {
          setGamePhase('win');
      }
  }

  // Granular Bots Turn Loop
  useEffect(() => {
    if (gamePhase !== 'playing' || currentTurn === 0 || pendingInteraction) return;
    
    const processBot = async () => {
        // Delay for visual feedback
        await new Promise(r => setTimeout(r, 600));

        let freshDeck = [...remainingDeck];
        let freshOpponents = {...opponents};
        let freshDiscard = [...discardPile];
        const botName = `player${currentTurn}`;

        if (freshDeck.length === 0) {
            setGamePhase('draw');
            return;
        }
        
        // Bot Draw Strategy
        let hasFlower = true;
        while (hasFlower && freshDeck.length > 0) {
            let draw = freshDeck.pop();
            if (draw.startsWith('Flower') || draw.startsWith('Season')) {
                hasFlower = true; 
            } else {
                freshOpponents[botName].push(draw);
                hasFlower = false;
            }
        }

        // Bot Discards Randomly
        if (freshOpponents[botName].length > 0) {
            const rIndex = Math.floor(Math.random() * freshOpponents[botName].length);
            const disc = freshOpponents[botName].splice(rIndex, 1)[0];
            freshDiscard.push(disc);
            
            // Check Interruptions (Hu, Pon, Chow)
            const isLeftOfUser = (currentTurn === 3);
            const available = getAvailableInteractions(playerHand, disc, isLeftOfUser);
            
            if (available.length > 0) {
                 setRemainingDeck(freshDeck);
                 setOpponents(freshOpponents);
                 setDiscardPile(freshDiscard);
                 setPendingInteraction({ tile: disc, sourceActor: currentTurn, actions: available });
                 return; // HALT LOOP AWAITING USER
            }
        }
        
        // No interruption, advance turn natively
        setRemainingDeck(freshDeck);
        setOpponents(freshOpponents);
        setDiscardPile(freshDiscard);
        
        const nextTurn = (currentTurn + 1) % 4;
        if (nextTurn === 0) {
             executeUserDraw(freshDeck);
        } else {
             setCurrentTurn(nextTurn);
        }
    };

    processBot();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gamePhase, pendingInteraction]);

  const executeChow = (seq) => {
      let targetTile = pendingInteraction.tile;
      let newHand = [...playerHand];
      for (let neededTile of seq) {
          if (neededTile !== targetTile) {
              let idx = newHand.indexOf(neededTile);
              if (idx > -1) newHand.splice(idx, 1);
          }
      }
      
      let newDiscard = [...discardPile];
      newDiscard.pop(); // exfiltrate
      setDiscardPile(newDiscard);
      
      setPlayerExposed(prev => [...prev, seq]);
      setPlayerHand(sortHand(newHand));
      setPendingInteraction(null);
      setCurrentTurn(0);
  }

  // Handle Pon/Chow Dialog Buttons
  const handleInteractionResponse = (action) => {
      if (!pendingInteraction) return;
      
      const targetTile = pendingInteraction.tile;
      const nextTurnObj = (pendingInteraction.sourceActor + 1) % 4;
      
      if (action === 'pass') {
          setPendingInteraction(null);
          if (nextTurnObj === 0) executeUserDraw(remainingDeck);
          else setCurrentTurn(nextTurnObj);
          
      } else if (action === 'pon') {
          let newHand = [...playerHand];
          let extracted = [];
          for (let i = newHand.length - 1; i >= 0; i--) {
              if (newHand[i] === targetTile && extracted.length < 2) {
                  extracted.push(newHand.splice(i, 1)[0]);
              }
          }
          extracted.push(targetTile);
          
          let newDiscard = [...discardPile];
          newDiscard.pop(); // Exfiltrate from active board
          
          setDiscardPile(newDiscard);
          setPlayerExposed(prev => [...prev, extracted]);
          setPlayerHand(sortHand(newHand));
          setPendingInteraction(null);
          setCurrentTurn(0); // Jump turn queue permanently!
          
      } else if (action === 'kong') {
          let newHand = [...playerHand];
          let extracted = [];
          for (let i = newHand.length - 1; i >= 0; i--) {
              if (newHand[i] === targetTile && extracted.length < 3) {
                  extracted.push(newHand.splice(i, 1)[0]);
              }
          }
          extracted.push(targetTile);
          
          let newDiscard = [...discardPile];
          newDiscard.pop(); // Take from active discard
          
          setDiscardPile(newDiscard);
          setPlayerExposed(prev => [...prev, extracted]);
          
          // MANDATORY KONG REPLACEMENT DRAW FROM EXTRA WALL
          let freshDeck = [...remainingDeck];
          let freshPlayerFlowers = [...playerFlowers];
          
          if (freshDeck.length === 0) {
              setGamePhase('draw');
              setRemainingDeck(freshDeck);
              setPendingInteraction(null);
              return;
          }
          
          let drawnTile = null;
          let hasFlower = true;
          while (hasFlower && freshDeck.length > 0) {
             let draw = freshDeck.pop();
             if (draw.startsWith('Flower') || draw.startsWith('Season')) {
                freshPlayerFlowers.push(draw);
             } else {
                drawnTile = draw;
                hasFlower = false;
             }
          }
          
          if (drawnTile) newHand.push(drawnTile);
          
          setPlayerHand(sortHand(newHand));
          setPlayerFlowers(freshPlayerFlowers);
          setRemainingDeck(freshDeck);
          setPendingInteraction(null);
          setCurrentTurn(0);
          
          if (checkWin(newHand)) {
              setGamePhase('win');
          }
          
      } else if (action === 'chow') {
          const chows = getAllAvailableChows(playerHand, targetTile);
          if (chows.length === 1) {
              executeChow(chows[0]);
          } else if (chows.length > 1) {
              setPendingInteraction({ ...pendingInteraction, selectingChow: chows });
              return;
          }
          
      } else if (action === 'hu') {
          let newHand = sortHand([...playerHand, targetTile]);
          let newDiscard = [...discardPile];
          newDiscard.pop();
          setDiscardPile(newDiscard);
          setPlayerHand(newHand);
          setGamePhase('win');
          setPendingInteraction(null);
      }
  }

  const handleSelfKong = (kongObj) => {
      let newHand = [...playerHand];
      let newExposed = [...playerExposed];
      
      if (kongObj.type === 'concealed') {
          let extracted = [];
          for (let i = newHand.length - 1; i >= 0; i--) {
              if (newHand[i] === kongObj.tile && extracted.length < 4) {
                  extracted.push(newHand.splice(i, 1)[0]);
              }
          }
          newExposed.push(extracted);
      } else if (kongObj.type === 'promoted') {
          let idx = newHand.indexOf(kongObj.tile);
          if (idx > -1) newHand.splice(idx, 1);
          
          for (let i = 0; i < newExposed.length; i++) {
              if (newExposed[i].length === 3 && newExposed[i][0] === kongObj.tile && newExposed[i][1] === kongObj.tile) {
                  newExposed[i] = [...newExposed[i], kongObj.tile];
                  break;
              }
          }
      }
      
      setPlayerExposed(newExposed);
      
      let freshDeck = [...remainingDeck];
      let freshPlayerFlowers = [...playerFlowers];
      
      if (freshDeck.length === 0) {
          setGamePhase('draw');
          setRemainingDeck(freshDeck);
          return;
      }
      
      let drawnTile = null;
      let hasFlower = true;
      while (hasFlower && freshDeck.length > 0) {
         let draw = freshDeck.pop();
         if (draw.startsWith('Flower') || draw.startsWith('Season')) {
            freshPlayerFlowers.push(draw);
         } else {
            drawnTile = draw;
            hasFlower = false;
         }
      }
      
      if (drawnTile) newHand.push(drawnTile);
      
      setPlayerHand(sortHand(newHand));
      setPlayerFlowers(freshPlayerFlowers);
      setRemainingDeck(freshDeck);
      
      if (checkWin(newHand)) {
          setGamePhase('win');
      }
  }

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
    if (gamePhase !== 'playing' || currentTurn !== 0) return;
    if (!tileToDiscard) return; // Must have a tile
    
    // Determine target slice
    const newHand = [...playerHand];
    const index = newHand.indexOf(tileToDiscard);
    if (index > -1) {
      newHand.splice(index, 1);
      setPlayerHand(sortHand(newHand));
      setDiscardPile(prev => [...prev, tileToDiscard]);
      setSelectedTile(null);
      setCurrentTurn(1); // Auto launch next player
    }
  }

  if (!isInitialized) return <div className="h-screen w-screen bg-felt flex items-center justify-center text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;

  // Render Check: Has user received exactly enough tiles to constitute a playable decision?
  // Native draws give +1. Pon/Chow gives 0 (requires discard). Both resolve out to (17 - Exposed*3) bounds
  const targetHandLength = 17 - (playerExposed.length * 3);
  const isNewlyDrawn = (idx) => idx === playerHand.length - 1 && playerHand.length === targetHandLength;

  const selfKongs = (currentTurn === 0 && gamePhase === 'playing' && !pendingInteraction) ? getAvailableSelfKongs(playerHand, playerExposed) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-[1fr_auto_auto] md:grid-rows-[1fr_auto] h-screen w-screen overflow-hidden bg-felt text-white relative">
      
      {/* GAME OVERLAYS */}
      {gamePhase === 'win' && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-red-700 border-4 border-yellow-400 p-8 sm:p-12 rounded-3xl shadow-[0_0_150px_rgba(255,0,0,1)] transform text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
               <h1 className="text-5xl sm:text-7xl font-black text-yellow-300 drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)] mb-2 tracking-wider">HU!</h1>
               <h2 className="text-2xl sm:text-3xl font-bold text-yellow-100 mb-6 drop-shadow-md border-b border-yellow-400/30 pb-4">VICTORY</h2>
               
               <div className="flex bg-black/40 p-3 sm:p-5 rounded-2xl shadow-[inset_0_10px_30px_rgba(0,0,0,0.5)] mb-8 transform scale-90 sm:scale-100 max-w-[90vw] overflow-x-auto gap-4 items-center">
                  {/* Winning hand renders exposed melds cleanly separately */}
                  {playerExposed.map((meld, mIdx) => (
                     <div key={`win-exp-${mIdx}`} className="flex pl-2 border-l border-yellow-600/50">
                        {meld.map((t, i) => <Tile key={`we-${mIdx}-${i}`} tileName={t} />)}
                     </div>
                  ))}
                  <div className="flex pl-2 border-l border-green-600/50">
                     {playerHand.map((t, i) => <Tile key={`win-${i}`} tileName={t} />)}
                  </div>
               </div>
               
               <button onClick={startNewGame} className="px-10 py-4 bg-gradient-to-b from-yellow-300 to-yellow-600 text-red-950 font-black rounded-full text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all outline-none border-2 border-yellow-200">Play Again</button>
            </div>
         </div>
      )}
      
      {gamePhase === 'draw' && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border-4 border-slate-600 p-8 sm:p-12 rounded-3xl shadow-2xl transform text-center flex flex-col items-center animate-in fade-in zoom-in">
               <h1 className="text-4xl sm:text-6xl font-black text-slate-300 drop-shadow-lg mb-6 tracking-wider">DRAW</h1>
               <p className="text-slate-400 mb-8 max-w-xs leading-relaxed">The wall has been completely depleted. No player formed 5 Melds and a Pair.</p>
               <button onClick={startNewGame} className="px-8 py-3 bg-slate-300 text-slate-900 font-bold rounded-full text-xl shadow-xl hover:scale-105 active:scale-95 transition-all">Redeal</button>
            </div>
         </div>
      )}

      {/* INTERRUPT MODAL */}
      {pendingInteraction && (
         <div className="absolute inset-x-0 bottom-32 md:bottom-1/3 z-50 flex justify-center items-center pointer-events-none animate-in slide-in-from-bottom-5">
             <div className="bg-black/80 border border-yellow-500/80 p-4 sm:p-8 rounded-3xl shadow-[0_0_80px_rgba(234,179,8,0.3)] flex flex-col items-center pointer-events-auto backdrop-blur-xl">
                 <div className="absolute -top-6 bg-yellow-500 text-black px-4 py-1 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg">Interrupt Request</div>
                 
                 <div className="flex items-center gap-6 mb-6">
                     <p className="text-yellow-100 text-sm opacity-80">Player {pendingInteraction.sourceActor} discarded:</p>
                     <div className="transform scale-125 shadow-[0_0_20px_rgba(255,255,255,0.4)] rounded-lg"><Tile tileName={pendingInteraction.tile} /></div>
                 </div>
                 
                 {pendingInteraction.selectingChow ? (
                     <div className="flex flex-col items-center gap-4">
                         <h3 className="text-white font-bold mb-2">Select a Sequence:</h3>
                         <div className="flex gap-4 sm:gap-6 items-center">
                             {pendingInteraction.selectingChow.map((seq, idx) => (
                                <button 
                                  key={`chow-opt-${idx}`} 
                                  onClick={() => executeChow(seq)}
                                  className="flex gap-1 p-2 bg-blue-900/50 hover:bg-blue-800 rounded-xl border border-blue-400 shadow-[0_5px_15px_rgba(59,130,246,0.4)] transition-all transform hover:scale-105 active:scale-95"
                                >
                                   {seq.map((t, i) => <div key={i} className="scale-75 origin-center -mx-1"><Tile tileName={t} /></div>)}
                                </button>
                             ))}
                         </div>
                         <button onClick={() => setPendingInteraction({...pendingInteraction, selectingChow: null})} className="mt-2 px-6 py-1.5 bg-slate-700/80 hover:bg-slate-600 text-white text-sm rounded-full transition-colors">Cancel</button>
                     </div>
                 ) : (
                     <div className="flex gap-4 sm:gap-6 items-center justify-center flex-wrap max-w-full">
                        <button onClick={() => handleInteractionResponse('pass')} className="px-6 py-2 bg-slate-700/80 hover:bg-slate-600 rounded-full text-white font-semibold transition-colors shadow-inner">Pass</button>
                        
                        {pendingInteraction.actions.includes('chow') && (
                           <button onClick={() => handleInteractionResponse('chow')} className="px-8 py-2 bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-600 hover:to-blue-400 border border-blue-300 shadow-[0_0_25px_rgba(59,130,246,0.6)] rounded-full text-white font-black text-lg transition-all transform hover:scale-110 active:scale-95">CHOW!</button>
                        )}
                        
                        {pendingInteraction.actions.includes('pon') && (
                           <button onClick={() => handleInteractionResponse('pon')} className="px-8 py-2 bg-gradient-to-r from-orange-700 to-orange-500 hover:from-orange-600 hover:to-orange-400 border border-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.6)] rounded-full text-white font-black text-lg transition-all transform hover:scale-110 active:scale-95">PON!</button>
                        )}
                        
                        {pendingInteraction.actions.includes('kong') && (
                           <button onClick={() => handleInteractionResponse('kong')} className="px-8 py-2 bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 border border-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.6)] rounded-full text-white font-black text-lg transition-all transform hover:scale-110 active:scale-95">KONG!</button>
                        )}
                        
                        {pendingInteraction.actions.includes('hu') && (
                           <button onClick={() => handleInteractionResponse('hu')} className="px-10 py-2 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 border-2 border-yellow-300 shadow-[0_0_40px_rgba(220,38,38,1)] rounded-full text-yellow-200 font-black text-xl transition-all transform hover:scale-110 animate-pulse">WIN!</button>
                        )}
                     </div>
                 )}
             </div>
         </div>
      )}

      {/* 1. TABLE CENTER */}
      <div className="col-start-1 row-start-1 md:col-start-1 md:col-span-2 md:row-start-1 relative z-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex flex-col min-h-0">
         
         <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <button onClick={startNewGame} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-800 border border-green-600 rounded text-xs sm:text-base shadow-sm hover:bg-green-700 transition w-max">Rearrange & Redeal</button>
         </div>
         
         <div className={`absolute bottom-4 sm:bottom-6 left-4 sm:left-6 z-10 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg font-mono bg-black/40 rounded-lg border-2 text-white/90 shadow-xl transition-colors duration-500 flex gap-3 items-center tracking-wider ${currentTurn === 0 ? 'border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-sm' : 'border-white/10 backdrop-blur-sm'}`}>
            <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${currentTurn === 0 ? 'bg-emerald-400 animate-pulse outline outline-emerald-400/50 outline-2 outline-offset-1' : 'bg-white/20'}`}></span>
            Wall: {remainingDeck.length}
         </div>
         
         {/* Center Felt - Discards */}
         <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 overflow-hidden w-full h-full p-4 sm:p-12">
            <div className={`absolute inset-0 p-8 flex flex-wrap content-start items-start justify-center gap-1 sm:gap-2 overflow-y-auto ${discardPile.length === 0 ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}>
               {discardPile.map((t, idx) => (
                  <div key={`discard-${idx}`} className={`w-6 h-9 sm:w-10 sm:h-14 opacity-80 transform shadow-sm rounded flex items-center justify-center bg-[#FCFCFC] border border-gray-300/50 ${idx === discardPile.length - 1 && currentTurn !== 0 ? 'ring-2 ring-yellow-400/50 opacity-100 scale-105' : ''}`}>
                      <img src={`/tiles/${t}.svg?v=6`} className="w-full h-full object-contain p-[2px]" draggable={false} alt={t}/>
                  </div>
               ))}
            </div>
            
            {discardPile.length === 0 && (
                <div className="w-48 h-48 sm:w-64 sm:h-64 border-4 border-green-800 rounded-lg flex items-center justify-center bg-green-900/40 transform scale-75 md:scale-100">
                    <span className="text-xl sm:text-3xl text-green-700 font-bold opacity-30 tracking-widest uppercase text-center leading-loose">Maia<br/>Mahjong</span>
                </div>
            )}
            
            {/* User Action Overlay */}
            {currentTurn === 0 && gamePhase === 'playing' && !pendingInteraction && (
               <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-4 animate-in slide-in-from-bottom-2 fade-in">
                 
                 {/* Self Kong Injection UI */}
                 {selfKongs.length > 0 && (
                     <button 
                       onClick={() => handleSelfKong(selfKongs[0])}
                       className="px-6 sm:px-8 py-2 sm:py-3 border-2 border-purple-500 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full shadow-[0_5px_15px_rgba(168,85,247,0.5)] transition-transform transform hover:scale-105 active:scale-95 text-sm sm:text-lg whitespace-nowrap animate-pulse"
                     >
                       Declare Kong
                     </button>
                 )}
                 
                 {/* Native Discard Selection */}
                 {selectedTile && (
                     <button 
                       onClick={() => handleDiscard(selectedTile)}
                       className="px-6 sm:px-10 py-2 sm:py-3 border-2 border-red-500 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-[0_10px_20px_rgba(220,38,38,0.4)] transition-transform transform hover:scale-105 active:scale-95 text-sm sm:text-lg whitespace-nowrap"
                     >
                       Discard Selection
                     </button>
                 )}
               </div>
            )}
         </div>
      </div>

      {/* 2. PLAYER TRAY */}
      <div 
         className="col-start-1 row-start-2 md:col-start-1 md:col-span-3 md:row-start-2 relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] bg-wood-light border-t-[2px] sm:border-t-[6px] border-wood flex flex-col justify-end px-1 sm:px-6 py-2 overflow-x-auto"
         style={{ 
           scrollbarWidth: 'none',
           backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z\' fill=\'%233e2723\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' 
         }}
      >
         {/* Bonus Rack for Extracted Flowers and Exposed Melds */}
         {(playerFlowers.length > 0 || playerExposed.length > 0) && (
           <div className="flex bg-black/10 p-1 sm:p-2 rounded-lg backdrop-blur-sm shadow-inner w-max mx-auto mb-2 transform scale-75 sm:scale-90 transition-all duration-500 gap-2 sm:gap-6 items-center border border-black/20">
             
             {/* Flowers Section */}
             {playerFlowers.length > 0 && (
                <div className="flex gap-[1px] opacity-90 p-1 bg-black/20 rounded shadow-inner border-b-2 border-green-800/50">
                   {playerFlowers.map((flower, i) => (
                      <Tile key={`flower-${flower}-${i}`} tileName={flower} />
                   ))}
                </div>
             )}
             
             {/* Exposed Melds Section */}
             {playerExposed.length > 0 && playerExposed.map((meld, mIdx) => (
                <div key={`exp-${mIdx}`} className="flex gap-[1px] bg-black/20 rounded shadow-inner p-1 sm:p-2 border-b-2 border-yellow-500/80 transform hover:scale-105 transition-transform cursor-default relative">
                   {meld.map((t, i) => (
                      <div key={`et-${mIdx}-${i}`} className={`opacity-95 ${meld.length === 4 && i === 3 ? 'absolute top-1/2 left-1/2 transform -translate-x-1/2 sm:-translate-y-[8px] -translate-y-1 shadow-[0_5px_15px_rgba(0,0,0,0.8)] outline outline-1 outline-yellow-400/50 rounded z-10 scale-[1.05]' : ''}`}>
                          <Tile tileName={t} />
                      </div>
                   ))}
                </div>
             ))}
           </div>
         )}
         
         <div className={`flex p-1 sm:p-2 rounded-lg backdrop-blur-sm border-b-[4px] w-max shrink-0 shadow-lg mx-auto transition-colors duration-500 ${currentTurn === 0 ? 'bg-emerald-900/30 border-emerald-900/50' : 'bg-black/20 border-black/30'}`}>
           
           {/* Main Remaining Interactive Hand */}
           <div className="flex">
               {playerHand.map((tile, i) => {
                  return (
                     <div key={`${tile}-${i}`} className={`relative ${isNewlyDrawn(i) ? 'ml-2 sm:ml-4 border-l-2 border-emerald-500/30 pl-1 sm:pl-2 transition-all duration-300' : ''}`}>
                        {isNewlyDrawn(i) && currentTurn === 0 && gamePhase === 'playing' && !pendingInteraction && (
                           <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2 text-[8px] sm:text-xs text-emerald-300 font-bold whitespace-nowrap animate-bounce drop-shadow-md">
                              DRAWN
                           </div>
                        )}
                        <Tile 
                          tileName={tile} 
                          selected={selectedTile === tile}
                          onClick={handleTileClick}
                        />
                     </div>
                  )
               })}
           </div>
         </div>
      </div>

      {/* 3. AI COACH PANEL */}
      <div className={`col-start-1 row-start-3 md:col-start-3 md:col-span-1 md:row-start-1 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] md:shadow-2xl bg-zinc-950 border-t border-white/10 md:border-t-0 md:border-l flex flex-col transition-all duration-300 overflow-hidden ${isCoachOpen ? 'h-[40vh] md:h-full' : 'h-14 sm:h-16 md:h-auto md:max-h-16'}`}>
        <div 
           className="p-3 sm:p-5 border-b border-white/10 bg-zinc-900/50 backdrop-blur flex justify-between items-center cursor-pointer select-none shrink-0"
           onClick={() => setIsCoachOpen(!isCoachOpen)}
        >
          <div>
            <h2 className="font-semibold flex items-center gap-2 sm:gap-3 text-sm sm:text-lg text-white/90">
               <div className="relative flex h-2 w-2 sm:h-3 sm:w-3">
                 <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentTurn === 0 ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 ${currentTurn === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
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
