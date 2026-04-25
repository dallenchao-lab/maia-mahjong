import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar } from 'react-native';
import BotMatchMode from './src/screens/BotMatchMode';
import PracticeMode from './src/screens/PracticeMode';

export default function App() {
  const [activeMode, setActiveMode] = useState(null);

  if (activeMode === 'bot_match') {
    return <BotMatchMode onExit={() => setActiveMode(null)} />;
  }
  
  if (activeMode === 'practice') {
    return <PracticeMode onExit={() => setActiveMode(null)} />;
  }

  return (
    <View style={s.menuRoot}>
      <StatusBar barStyle="light-content" />
      <Text style={s.menuTitle}>MAIA MAHJONG</Text>
      <View style={s.menuButtons}>
        <TouchableOpacity style={s.btnBotMatch} onPress={() => setActiveMode('bot_match')}>
          <Text style={s.btnText}>Bot Match Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnPractice} onPress={() => setActiveMode('practice')}>
          <Text style={s.btnTextSm}>Solo Practice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  menuRoot: { flex: 1, backgroundColor: '#14532d', justifyContent: 'center', alignItems: 'center' },
  menuTitle: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 32, textAlign: 'center', letterSpacing: 4 },
  menuButtons: { width: '100%', paddingHorizontal: 32 },
  btnBotMatch: { backgroundColor: '#059669', marginBottom: 16, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#34d399' },
  btnPractice: { backgroundColor: '#334155', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#64748b', opacity: 0.85 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 2 },
  btnTextSm: { color: 'white', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 2 },
});
