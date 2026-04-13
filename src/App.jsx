import { useState, useEffect } from 'react'
import { generateDeck, dealInitialHands } from './game/gameState'
import { askMockCoach } from './ai/mockAiService'
import Tile from './components/Tile'
import { Sparkles, Loader2 } from 'lucide-react'

function App() {
  const [boardState, setBoardState] = useState(null)
  const [playerHand, setPlayerHand] = useState([])
  const [selectedTile, setSelectedTile] = useState(null)
  
  // AI State
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
    const { hands, remainingDeck } = dealInitialHands(deck);
    setBoardState({ hands, remainingDeck });
    
    // Sort player's hand for visual clarity (Simplified alphabetical sort)
    const sortedHand = [...hands.dealer].sort();
    setPlayerHand(sortedHand);
    setSelectedTile(null);
    setCoachMessages([
      { id: 1, role: 'ai', text: 'New game started! I am ready to analyze your hand.' }
    ]);
  }

  const handleTileClick = (tileName) => {
    setSelectedTile(selectedTile === tileName ? null : tileName);
  }

  const handleAskCoach = async () => {
    if (isThinking) return;
    
    // Append user prompt
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
    if (!tileToDiscard) return;
    // Remove the tile from hand
    const newHand = [...playerHand];
    const index = newHand.indexOf(tileToDiscard);
    if (index > -1) {
      newHand.splice(index, 1);
      setPlayerHand(newHand);
      setSelectedTile(null);
    }
  }

  if (!boardState) return <div className="h-screen w-screen bg-felt flex items-center justify-center text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-felt text-white">
      
      {/* Table Panel (Left) */}
      <div className="flex-1 flex flex-col relative z-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
         
         <div className="absolute top-4 left-4 z-10 flex gap-4">
            <button onClick={startNewGame} className="px-4 py-2 bg-green-800 border border-green-600 rounded shadow-sm hover:bg-green-700 transition">Rearrange & Redeal</button>
         </div>

         {/* The Felt Table Center */}
         <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="w-64 h-64 border-4 border-green-800 rounded-lg flex items-center justify-center bg-green-900/40">
                <span className="text-3xl text-green-700 font-bold opacity-30 tracking-widest uppercase">Maia Mahjong</span>
            </div>
            {/* Draw Pile (Mock) */}
            <div className="absolute top-1/4 right-1/4 transform rotate-12 flex -space-x-10 shadow-xl">
               <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-1"></div>
               <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-2"></div>
               <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-3"></div>
               <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform flex items-center justify-center" style={{ backgroundColor: '#FCFCFC' }}>
                  <img src="/tiles/Back.svg" className="opacity-90 w-full h-full object-cover p-1" />
               </div>
            </div>
         </div>

         {/* Action Bar */}
         <div className="h-16 bg-wood/80 flex items-center justify-between px-8 border-t-2 border-wood-light relative z-10">
            <div className="text-amber-200 font-semibold tracking-wide text-sm opacity-80 uppercase">
              17 Tiles (Dealer)
            </div>
            {selectedTile && (
              <button 
                onClick={() => handleDiscard(selectedTile)}
                className="px-8 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-lg transition-transform transform active:scale-95 animate-pulse"
              >
                Discard {selectedTile}
              </button>
            )}
         </div>

         {/* Player Tray */}
         <div 
            className="h-32 sm:h-48 bg-wood-light border-t-[8px] border-wood flex items-end justify-center px-4 pb-6 relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)]"
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z\' fill=\'%233e2723\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' 
            }}
         >
            <div className="flex bg-black/20 p-2 rounded-lg backdrop-blur-sm border-b-[8px] border-black/30">
              {playerHand.map((tile, i) => (
                <Tile 
                  key={`${tile}-${i}`} 
                  tileName={tile} 
                  selected={selectedTile === tile}
                  onClick={handleTileClick}
                />
              ))}
            </div>
         </div>
      </div>
      
      {/* AI Coach Panel (Right - Antigravity Theme) */}
      <div className="w-full md:w-96 bg-zinc-950 border-l border-white/5 flex flex-col shadow-2xl z-20">
        <div className="p-5 border-b border-white/10 bg-zinc-900/50 backdrop-blur">
          <h2 className="font-semibold flex items-center gap-3 text-lg text-white/90">
             <div className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
             </div>
             Antigravity Coach
          </h2>
          <p className="text-xs text-white/40 mt-1 ml-6">v1.0 Dallen Heuristics Engine</p>
        </div>
        
        {/* Chat Feed */}
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
           {coachMessages.map((msg) => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-md
                  ${msg.role === 'user' 
                    ? 'bg-emerald-600/90 text-emerald-50 rounded-tr-sm' 
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-tl-sm'}
                `}>
                  {/* Basic markdown simulation for bolding */}
                  {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white bg-zinc-950/40 px-1 rounded">{part}</strong> : part)}
                </div>
             </div>
           ))}
           {isThinking && (
             <div className="flex justify-start">
               <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-sm shadow-md flex items-center gap-2">
                 <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                 <span className="text-zinc-400 text-sm italic">Analyzing matrix...</span>
               </div>
             </div>
           )}
        </div>
        
        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/30">
           <button 
              onClick={handleAskCoach}
              disabled={isThinking || playerHand.length === 0}
              className="w-full group relative overflow-hidden bg-white text-zinc-900 font-medium py-3 px-4 rounded-xl transition-all hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-[0.98]"
           >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2 font-semibold tracking-wide">
                 <Sparkles className="w-4 h-4 text-emerald-600" />
                 Ask Coach for Discard Move
              </div>
           </button>
        </div>
      </div>
    </div>
  )
}

export default App
