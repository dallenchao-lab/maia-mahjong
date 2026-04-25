import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import {
  generateDeck, dealInitialHands, sortHand, checkWin,
  getAvailableInteractions, calculateScore,
  rankDiscards, getBotInterruptAction, askCoach
} from '@maia-mahjong/engine';
import NativeTile from '../components/NativeTile';

const BOT1 = 'player1'; // Right
const BOT2 = 'player2'; // Top
const BOT3 = 'player3'; // Left
const USER = 'player0'; // Bottom

export default function PracticeMode({ onExit }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [deck, setDeck] = useState([]);
  const [hands, setHands] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
  const [exposed, setExposed] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
  const [globalDiscard, setGlobalDiscard] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gamePhase, setGamePhase] = useState('playing');
  const [winState, setWinState] = useState(null);
  const [pendingInteraction, setPendingInteraction] = useState(null);
  const [isCoachThinking, setIsCoachThinking] = useState(false);

  const startGame = () => {
    const newDeck = generateDeck(true);
    const dealt = dealInitialHands(newDeck);
    setHands({
      [USER]: sortHand(dealt.hands.dealer),
      [BOT1]: sortHand(dealt.hands.player1),
      [BOT2]: sortHand(dealt.hands.player2),
      [BOT3]: sortHand(dealt.hands.player3),
    });
    setExposed({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
    setGlobalDiscard([]);
    setDeck(dealt.remainingDeck);
    setCurrentTurn(0);
    setGamePhase('playing');
    setWinState(null);
    setPendingInteraction(null);
    setIsInitialized(true);
  };

  useEffect(() => { startGame(); }, []);

  // Bot Turn Loop
  useEffect(() => {
    if (!isInitialized || gamePhase !== 'playing' || pendingInteraction !== null || currentTurn === 0) return;
    let isActive = true;

    const runBotTurn = async () => {
      // Simulate Bot Thinking
      await new Promise(r => setTimeout(r, 600));
      if (!isActive) return;

      const playerKey = `player${currentTurn}`;
      const botHand = [...hands[playerKey]];
      let freshDeck = [...deck];

      if (freshDeck.length === 0) { setGamePhase('draw'); return; }

      let draw = freshDeck.pop();
      while (draw.startsWith('Flower') || draw.startsWith('Season')) {
        if (freshDeck.length === 0) { setGamePhase('draw'); return; }
        draw = freshDeck.pop();
      }
      botHand.push(draw);

      if (checkWin(botHand)) { handleWin(currentTurn, 'zimo', botHand, exposed[playerKey]); return; }

      await new Promise(r => setTimeout(r, 200));
      if (!isActive) return;

      // Smart Discard Selection
      const ranked = rankDiscards(botHand);
      const chosenDiscard = ranked[0].tile;
      const newBotHand = [...botHand];
      newBotHand.splice(newBotHand.indexOf(chosenDiscard), 1);

      setHands(prev => ({ ...prev, [playerKey]: sortHand(newBotHand) }));
      setGlobalDiscard(prev => [...prev, chosenDiscard]);
      setDeck(freshDeck);
      processDiscard(playerKey, chosenDiscard, newBotHand, freshDeck);
    };

    runBotTurn();
    return () => { isActive = false; };
  }, [currentTurn, gamePhase, pendingInteraction, isInitialized]);

  const processDiscard = (sourcePlayerKey, discardedTile, sourceHandAfterDiscard, currentDeck) => {
    let nextTurn = (parseInt(sourcePlayerKey.replace('player', '')) + 1) % 4;

    if (sourcePlayerKey !== USER) {
      const isLeft = sourcePlayerKey === BOT3;
      const available = getAvailableInteractions(hands[USER], discardedTile, isLeft);
      if (available.length > 0) {
        setPendingInteraction({ tile: discardedTile, sourceActor: sourcePlayerKey, actions: available, nextTurnIfPass: nextTurn });
        return;
      }
    }

    let interceptor = null;
    let interceptedAction = null;
    // Check Bots to Intercept
    for (let i = 1; i <= 3; i++) {
      const checkTurn = (parseInt(sourcePlayerKey.replace('player', '')) + i) % 4;
      if (checkTurn === 0) continue;
      const botKey = `player${checkTurn}`;
      const isLeftOfBot = (sourcePlayerKey === `player${(checkTurn + 3) % 4}`);
      const actions = getAvailableInteractions(hands[botKey], discardedTile, isLeftOfBot);
      if (actions.length > 0) {
        const decision = getBotInterruptAction(hands[botKey], discardedTile, actions);
        if (decision !== 'pass') {
          if (decision === 'hu') { interceptor = botKey; interceptedAction = 'hu'; break; }
          else if (!interceptedAction) { interceptor = botKey; interceptedAction = decision; }
        }
      }
    }

    if (interceptor && interceptedAction) {
      if (interceptedAction === 'hu') {
        const winHand = [...hands[interceptor], discardedTile];
        handleWin(parseInt(interceptor.replace('player', '')), 'hupai', winHand, exposed[interceptor], sourcePlayerKey);
        return;
      } else if (interceptedAction === 'pon') {
        setGlobalDiscard(prev => prev.slice(0, -1)); // steal from central pile
        setHands(prev => {
          const h = [...prev[interceptor]];
          h.splice(h.indexOf(discardedTile), 1);
          h.splice(h.indexOf(discardedTile), 1);
          return { ...prev, [interceptor]: h };
        });
        setExposed(prev => ({ ...prev, [interceptor]: [...prev[interceptor], [discardedTile, discardedTile, discardedTile]] }));
        setCurrentTurn(parseInt(interceptor.replace('player', '')));
        return;
      }
    }

    // Pass turn properly
    if (nextTurn === 0) {
      let freshDeck = [...currentDeck];
      if (freshDeck.length === 0) { setGamePhase('draw'); return; }
      let draw = freshDeck.pop();
      while (draw && (draw.startsWith('Flower') || draw.startsWith('Season'))) {
        if (freshDeck.length === 0) { setGamePhase('draw'); return; }
        draw = freshDeck.pop();
      }
      const newUserHand = [...hands[USER], draw];
      setDeck(freshDeck);
      setHands(prev => ({ ...prev, [USER]: newUserHand }));
      if (checkWin(newUserHand)) { handleWin(0, 'zimo', newUserHand, exposed[USER]); return; }
      setCurrentTurn(0);
    } else {
      setCurrentTurn(nextTurn);
    }
  };

  const handleWin = (playerIdx, type, finalHand, finalExposed, dealInSource = null) => {
    let scoreObj;
    try {
      scoreObj = calculateScore({ hand: finalHand, exposed: finalExposed, flowers: [], winType: type });
    } catch (e) {
      scoreObj = { total: 1, breakdown: [{ label: 'Win', points: 1 }] };
    }
    setWinState({ winner: playerIdx, type, score: scoreObj, penalty: dealInSource ? scoreObj.total : 0, penaltyFrom: dealInSource });
    setGamePhase('win');
  };

  const handleUserDiscard = (tileToDiscard) => {
    if (gamePhase !== 'playing' || currentTurn !== 0) return;
    const newHand = [...hands[USER]];
    const index = newHand.indexOf(tileToDiscard);
    if (index > -1) {
      newHand.splice(index, 1);
      setHands(prev => ({ ...prev, [USER]: sortHand(newHand) }));
      setGlobalDiscard(prev => [...prev, tileToDiscard]);
      processDiscard(USER, tileToDiscard, newHand, deck);
    }
  };

  const handleUserAction = (action) => {
    const tile = pendingInteraction.tile;
    const sourceActor = pendingInteraction.sourceActor;
    let newDeck = [...deck];

    if (action === 'pass') {
      setPendingInteraction(null);
      let nextTurn = (parseInt(sourceActor.replace('player', '')) + 1) % 4;
      if (nextTurn === 0) {
        if (newDeck.length === 0) { setGamePhase('draw'); return; }
        const draw = newDeck.pop();
        setDeck(newDeck);
        setHands(prev => ({ ...prev, [USER]: [...prev[USER], draw] }));
        setCurrentTurn(0);
      } else {
        setCurrentTurn(nextTurn);
      }
      return;
    }
    if (action === 'hu') {
      setPendingInteraction(null);
      handleWin(0, 'hupai', [...hands[USER], tile], exposed[USER], sourceActor);
      return;
    }
    if (action === 'pon') {
      let newHand = [...hands[USER]];
      newHand.splice(newHand.indexOf(tile), 1);
      newHand.splice(newHand.indexOf(tile), 1);
      setHands(prev => ({ ...prev, [USER]: newHand }));
      setExposed(prev => ({ ...prev, [USER]: [...prev[USER], [tile, tile, tile]] }));
      setGlobalDiscard(prev => prev.slice(0, -1)); // Extract from global discard
      setPendingInteraction(null);
      setCurrentTurn(0);
      return;
    }
  };

  const handleAskCoach = async () => {
    if (isCoachThinking || hands[USER].length === 0) return;
    setIsCoachThinking(true);
    
    try {
      const advice = await askCoach(hands[USER], exposed[USER], [], globalDiscard, deck.length);
      Alert.alert('Maia Coach Advice', advice.replace(/\*\*/g, ''));
    } catch (e) {
      Alert.alert('Coach Error', e.message);
    } finally {
      setIsCoachThinking(false);
    }
  };

  if (!isInitialized) return <View style={s.root} />;

  return (
    <SafeAreaView style={s.root}>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.btnLeave} onPress={onExit}>
          <Text style={s.btnLeaveText}>Exit Practice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnCoach} onPress={handleAskCoach} disabled={isCoachThinking || currentTurn !== 0}>
           {isCoachThinking ? (
             <ActivityIndicator size="small" color="#fff" />
           ) : (
             <Text style={s.btnCoachText}>Ask Maia Coach</Text>
           )}
        </TouchableOpacity>
        <View style={s.deckBadge}>
          <Text style={s.deckText}>Deck: {deck.length}</Text>
        </View>
      </View>

      {/* Table Area (Global Discards) */}
      <View style={s.tableArea}>
        <ScrollView contentContainerStyle={s.discardScroll}>
          {globalDiscard.map((t, i) => (
            <View key={i} style={[s.discardItem, (i === globalDiscard.length - 1 && currentTurn !== 0) && s.discardItemLatest]}>
              <NativeTile tileName={t} onClick={() => {}} />
            </View>
          ))}
          {globalDiscard.length === 0 && (
             <View style={s.emptyTable}><Text style={s.emptyTableText}>TABLE CENTER</Text></View>
          )}
        </ScrollView>
      </View>

      {/* Interruption actions */}
      {pendingInteraction && (
         <View style={s.interactionRow}>
           <Text style={s.interactionLabel}>Discarded:</Text>
           <View style={{ transform: [{ scale: 0.8 }] }}>
             <NativeTile tileName={pendingInteraction.tile} onClick={() => {}} />
           </View>
           <View style={s.actionButtons}>
             <TouchableOpacity style={s.btnPass} onPress={() => handleUserAction('pass')}>
               <Text style={s.btnPassText}>Pass</Text>
             </TouchableOpacity>
             {pendingInteraction.actions.includes('pon') && (
               <TouchableOpacity style={s.btnPon} onPress={() => handleUserAction('pon')}>
                 <Text style={s.btnActionText}>PON!</Text>
               </TouchableOpacity>
             )}
             {pendingInteraction.actions.includes('hu') && (
               <TouchableOpacity style={s.btnHu} onPress={() => handleUserAction('hu')}>
                 <Text style={s.btnHuText}>HU!</Text>
               </TouchableOpacity>
             )}
           </View>
         </View>
      )}

      {/* WIN MODAL */}
      {gamePhase === 'win' && winState && (
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, winState.winner === 0 ? s.modalWin : s.modalLose]}>
            <Text style={s.modalTitle}>
              {winState.winner === 0 ? 'YOU WIN!' : `PLAYER ${winState.winner} WINS`}
            </Text>
            <Text style={s.modalSubtitle}>{winState.type === 'zimo' ? 'Self-Draw' : 'Discard Intercept (Ron)'}</Text>
            {winState.penaltyFrom && (
              <View style={s.penaltyBox}>
                <Text style={s.penaltyWho}>
                  {winState.penaltyFrom === 'player0' ? 'YOU' : `Player ${winState.penaltyFrom.replace('player', '')}`} threw the losing tile!
                </Text>
                <Text style={s.penaltyAmount}>-{winState.penalty} Tai Penalty</Text>
              </View>
            )}
            <TouchableOpacity style={s.btnPlayAgain} onPress={startGame}>
              <Text style={s.btnPlayAgainText}>Redeal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* User hand tray */}
      <View style={[s.handTray, currentTurn === 0 && !pendingInteraction ? s.handTrayActive : s.handTrayIdle]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <View style={s.handRow}>
            {exposed[USER].map((m, mIdx) => (
              <View key={mIdx} style={s.exposedMeld}>
                {m.map((t, i) => <NativeTile key={i} tileName={t} onClick={() => {}} />)}
              </View>
            ))}
            {hands[USER].map((tileName, idx) => {
              const isNew = currentTurn === 0 && idx === hands[USER].length - 1 && hands[USER].length === (17 - exposed[USER].length * 3);
              return (
                <View key={`tile-${idx}`} style={isNew ? { marginLeft: 16 } : {}}>
                  <NativeTile tileName={tileName} onClick={handleUserDiscard} />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#022c22' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, paddingHorizontal: 16, paddingBottom: 8 },
  btnLeave: { backgroundColor: 'rgba(127,29,29,0.8)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ef4444' },
  btnLeaveText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  btnCoach: { backgroundColor: '#059669', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#34d399', width: 140, alignItems: 'center' },
  btnCoachText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  deckBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  deckText: { color: 'white', fontSize: 13, fontFamily: 'Courier' },
  
  tableArea: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064e3b', margin: 16, borderRadius: 16, borderWidth: 2, borderColor: '#065f46' },
  discardScroll: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 16 },
  discardItem: { transform: [{ scale: 0.6 }], margin: -8, opacity: 0.85 },
  discardItemLatest: { transform: [{ scale: 0.7 }], opacity: 1, borderWidth: 2, borderColor: '#eab308', borderRadius: 6 },
  emptyTable: { justifyContent: 'center', alignItems: 'center', height: 200 },
  emptyTableText: { color: 'rgba(255,255,255,0.1)', fontSize: 24, fontWeight: 'bold', textTransform: 'uppercase' },

  interactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#18181b', paddingVertical: 12, position: 'absolute', bottom: 120, left: 0, right: 0, zIndex: 10, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#eab308' },
  interactionLabel: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  btnPass: { backgroundColor: '#3f3f46', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnPassText: { color: 'white', fontWeight: 'bold' },
  btnPon: { backgroundColor: '#ea580c', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#fb923c' },
  btnHu: { backgroundColor: '#dc2626', paddingHorizontal: 32, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: '#eab308' },
  btnActionText: { color: 'white', fontWeight: 'bold' },
  btnHuText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, zIndex: 50 },
  modalBox: { padding: 32, borderRadius: 24, width: '100%', maxWidth: 360, borderWidth: 4 },
  modalWin: { backgroundColor: '#991b1b', borderColor: '#eab308' },
  modalLose: { backgroundColor: '#1e293b', borderColor: '#475569' },
  modalTitle: { color: '#eab308', fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: 3, marginBottom: 8 },
  modalSubtitle: { color: 'white', textAlign: 'center', fontSize: 16, marginBottom: 24 },
  penaltyBox: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 12, marginBottom: 24 },
  penaltyWho: { color: '#f87171', textAlign: 'center', fontWeight: 'bold' },
  penaltyAmount: { color: 'white', textAlign: 'center', marginTop: 8, fontSize: 22, fontWeight: '900' },
  btnPlayAgain: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  btnPlayAgainText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18, letterSpacing: 2 },

  handTray: { backgroundColor: '#A0522D', borderTopWidth: 4, borderTopColor: '#8B5A2B', paddingTop: 12 },
  handTrayActive: { shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20 },
  handTrayIdle: { opacity: 0.85 },
  handRow: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 8 },
  exposedMeld: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginRight: 16, padding: 4, borderRadius: 4, borderBottomWidth: 2, borderBottomColor: '#eab308' },
});
