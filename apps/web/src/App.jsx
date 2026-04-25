import React, { useState } from 'react'
import PracticeMode from './PracticeMode'
import BotMatchMode from './BotMatchMode'
import { Sparkles, Bot, User } from 'lucide-react'

function App() {
  const [activeMode, setActiveMode] = useState(null) // null | 'practice' | 'bot_match'

  if (activeMode === 'practice') {
     return <PracticeMode onExit={() => setActiveMode(null)} />
  }

  if (activeMode === 'bot_match') {
     return <BotMatchMode onExit={() => setActiveMode(null)} />
  }

  return (
    <div className="h-screen w-screen bg-felt flex items-center justify-center text-white relative overflow-hidden font-sans">
       
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-green-950/80 to-black pointer-events-none z-0"></div>

       <div className="relative z-10 p-8 sm:p-12 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl flex flex-col items-center max-w-md w-full mx-4">
          
          <div className="w-24 h-24 mb-6 rounded-full border-4 border-emerald-500 bg-emerald-900 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)]">
             <span className="text-4xl text-emerald-300 font-black tracking-tighter">M</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-emerald-50 tracking-widest uppercase mb-2 drop-shadow-md text-center">
             Maia<br/>Mahjong
          </h1>
          <p className="text-emerald-200/60 font-mono text-sm tracking-widest mb-10 text-center uppercase">Project Alpha 4.0</p>

          <div className="w-full flex flex-col gap-4">
             <button 
                onClick={() => setActiveMode('bot_match')}
                className="group relative w-full overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl shadow-[0_10px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_30px_rgba(16,185,129,0.5)] transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-between"
             >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="flex items-center gap-3">
                   <Bot className="w-6 h-6 text-emerald-100" />
                   <span className="text-lg tracking-wider text-left block">Bot Match Mode (NEW)</span>
                </div>
                <Sparkles className="w-5 h-5 text-emerald-200 opacity-50 group-hover:opacity-100 transition-opacity" />
             </button>

             <button 
                onClick={() => setActiveMode('practice')}
                className="group relative w-full overflow-hidden bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-between"
             >
                <div className="flex items-center gap-3">
                   <User className="w-6 h-6 text-zinc-400" />
                   <span className="text-lg tracking-wider text-left block">Solo Practice (AI Coach)</span>
                </div>
             </button>
          </div>

       </div>
    </div>
  )
}

export default App
