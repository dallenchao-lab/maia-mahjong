import { useState, useEffect } from 'react'
import { generateDeck, dealInitialHands } from './game/gameState'
import { askMockCoach } from './ai/mockAiService'
import Tile from './components/Tile'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

function App() {
  const [boardState, setBoardState] = useState(null)
  const [playerHand, setPlayerHand] = useState([])
  const [selectedTile, setSelectedTile] = useState(null)
  
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-felt text-white">
      
      {/* Top Section: Table Center & AI Coach */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-0">
        
        {/* Table Felt (Left/Top) */}
        <div className="flex-1 flex flex-col relative shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
           <div className="absolute top-4 left-4 z-10 flex gap-4">
              <button onClick={startNewGame} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-800 border border-green-600 rounded text-xs sm:text-base shadow-sm hover:bg-green-700 transition">Rearrange & Redeal</button>
           </div>
           {/* The Felt Table Center */}
           <div className="flex-1 flex flex-col items-center justify-center relative min-h-[100px]">
              <div className="w-48 h-48 sm:w-64 sm:h-64 border-4 border-green-800 rounded-lg flex items-center justify-center bg-green-900/40 transform scale-75 md:scale-100">
                  <span className="text-xl sm:text-3xl text-green-700 font-bold opacity-30 tracking-widest uppercase text-center leading-loose">Maia<br/>Mahjong</span>
              </div>
              {/* Draw Pile (Mock) */}
              <div className="absolute top-1/4 right-1/4 transform rotate-12 flex -space-x-4 sm:-space-x-10 shadow-xl scale-50 sm:scale-100">
                 <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-1"></div>
                 <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-2"></div>
                 <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform -translate-y-3"></div>
                 <div className="w-16 h-24 bg-zinc-200 border-2 border-gray-300 rounded shadow-md transform flex items-center justify-center" style={{ backgroundColor: '#FCFCFC' }}>
                    <img src="/tiles/Back.svg" className="opacity-90 w-full h-full object-cover p-1" draggable={false} />
                 </div>
              </div>
              
              {/* Discard Overlay Action */}
              {selectedTile && (
                 <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
                   <button 
                     onClick={() => handleDiscard(selectedTile)}
                     className="px-6 sm:px-10 py-2 sm:py-3 border-2 border-red-500 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-2xl transition-transform transform active:scale-95 animate-pulse text-sm sm:text-lg whitespace-nowrap"
                   >
                     Discard
                   </button>
                 </div>
              )}
           </div>
        </div>

        {/* AI Coach Panel */}
        <div className={`w-full md:w-1/3 max-w-none md:max-w-sm lg:max-w-md bg-zinc-950 border-t md:border-t-0 md:border-l border-white/10 flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)] md:shadow-2xl z-20 shrink-0 transition-all duration-300 overflow-hidden ${isCoachOpen ? 'flex-1 md:h-auto' : 'h-14 sm:h-16 min-h-0 flex-none'}`}>
          <div 
             className="p-3 sm:p-5 border-b border-white/10 bg-zinc-900/50 backdrop-blur flex justify-between items-center cursor-pointer select-none shrink-0"
             onClick={() => setIsCoachOpen(!isCoachOpen)}
          >
            <div>
              <h2 className="font-semibold flex items-center gap-2 sm:gap-3 text-sm sm:text-lg text-white/90">
                 <div className="relative flex h-2 w-2 sm:h-3 sm:w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-emerald-500"></span>
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

      {/* Bottom Section: Player Hand */}
      <div className="w-full flex flex-col shrink-0 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] h-1/4 min-h-[80px] bg-wood-light">
         {/* Player Tray */}
         <div 
            className="w-full h-full border-t-[2px] sm:border-t-[6px] border-wood flex items-end px-1 sm:px-6 pb-2 relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.4)] overflow-x-auto"
            style={{ 
              scrollbarWidth: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z\' fill=\'%233e2723\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' 
            }}
         >
            <div className="flex items-end justify-start min-w-max h-full mx-auto max-h-full">
               <div className="flex bg-black/20 p-1 sm:p-2 rounded-lg backdrop-blur-sm border-b-[4px] border-black/30 w-max shrink-0 shadow-lg max-h-full">
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
      </div>
    </div>
  )
}

export default App
