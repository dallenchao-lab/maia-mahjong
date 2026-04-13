import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { generateDeck, dealInitialHands, sortHand } from '@maia-mahjong/engine';
import NativeTile from './src/components/NativeTile';
import { NativeWindStyleSheet } from "nativewind";

// Map NativeWind structural hooks directly
NativeWindStyleSheet.setOutput({
  default: "native",
});

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [discardPile, setDiscardPile] = useState([]);

  // Mock Startup Simulator
  const startGame = () => {
    const newDeck = generateDeck(true);
    const { player1, player2, player3, player4, remainingDeck } = dealInitialHands(newDeck);
    
    setPlayerHand(sortHand(player1));
    setDeck(remainingDeck);
    setDiscardPile([]);
    setIsInitialized(true);
  };

  const handleDiscard = (tile) => {
    // Basic mockup intercept logic just physically testing UI renders natively
    const newHand = [...playerHand];
    const idx = newHand.indexOf(tile);
    if(idx > -1) newHand.splice(idx, 1);
    
    setPlayerHand(sortHand(newHand));
    setDiscardPile([...discardPile, tile]);
  };

  if(!isInitialized) {
    return (
      <View className="flex-1 bg-green-900 justify-center items-center">
        <Text className="text-white text-4xl font-bold mb-4 tracking-widest">MAIA MAHJONG</Text>
        <TouchableOpacity 
          onPress={startGame} 
          className="bg-emerald-600 px-8 py-4 rounded-xl shadow-lg border border-emerald-400"
        >
          <Text className="text-white font-bold text-xl uppercase tracking-wider">Start Native Prototype</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-green-950">
      
      {/* Table Interface */}
      <View className="flex-1 relative justify-center items-center px-4 overflow-hidden shadow-inner">
         
         <View className="absolute top-4 left-4 z-10 px-4 py-2 bg-black/40 rounded border border-white/20">
            <Text className="text-white/90 text-sm font-mono tracking-wider">Remaining: {deck.length}</Text>
         </View>
         
         <View className="absolute top-4 right-4 z-10">
            <TouchableOpacity onPress={startGame} className="px-4 py-2 bg-green-800 border border-green-600 rounded">
               <Text className="text-white text-sm">Redeal</Text>
            </TouchableOpacity>
         </View>
        
         {/* Center Discard Felt Grid mapping */}
         <ScrollView contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {discardPile.map((t, i) => (
              <View key={`discard-${i}`} className="opacity-80 scale-90 m-[1px]">
                 <NativeTile tileName={t} onClick={() => {}} />
              </View>
            ))}
            
            {discardPile.length === 0 && (
                <View className="w-48 h-48 border-4 border-green-800/50 rounded-lg justify-center items-center bg-green-900/40">
                    <Text className="text-2xl text-green-700 font-bold opacity-30 tracking-widest uppercase text-center leading-loose">TABLE{'\n'}CENTER</Text>
                </View>
            )}
         </ScrollView>

      </View>

      {/* Player User Hand Tray mapping physically scaling safely across notch dimensions */}
      <View className="bg-[#A0522D] border-t-4 border-[#8B5A2B] pt-4 pb-0 relative z-30">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
           <View className="flex-row items-end pb-2">
             {playerHand.map((tileName, idx) => (
               <NativeTile 
                 key={`tile-${idx}`} 
                 tileName={tileName} 
                 onClick={handleDiscard}
               />
             ))}
           </View>
        </ScrollView>
      </View>
      
      <StatusBar style="light" hidden={true} />
    </SafeAreaView>
  );
}
