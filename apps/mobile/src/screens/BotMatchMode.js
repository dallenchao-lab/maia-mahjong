import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { useMoneyStore } from '../store/useMoneyStore';
import {
  generateDeck, dealInitialHands, sortHand, checkWin,
  getAvailableInteractions, calculateScore,
  rankDiscards, getBotInterruptAction, getAllAvailableChows
} from '@maia-mahjong/engine';
import NativeTile from '../components/NativeTile';

const BOT1 = 'player1'; // Right
const BOT2 = 'player2'; // Top
const BOT3 = 'player3'; // Left
const USER = 'player0'; // Bottom

export default function BotMatchMode({ onExit }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [deck, setDeck] = useState([]);
  const [hands, setHands] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
  const [exposed, setExposed] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
  const [flowers, setFlowers] = useState({ [USER]: [], [BOT1]: [], [BOT2]: [], [BOT3]: [] });
  const [globalDiscard, setGlobalDiscard] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gamePhase, setGamePhase] = useState('playing');
  const [winState, setWinState] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [pendingInteraction, setPendingInteraction] = useState(null);
  const { balance, winMoney, loseMoney } = useMoneyStore();
  const [financials, setFinancials] = useState(null);

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
    setFlowers({ 
      [USER]: dealt.flowers.dealer, 
      [BOT1]: dealt.flowers.player1, 
      [BOT2]: dealt.flowers.player2, 
      [BOT3]: dealt.flowers.player3 
    });
    setGlobalDiscard([]);
    setDeck(dealt.remainingDeck);
    setCurrentTurn(0);
    setGamePhase('playing');
    setWinState(null);
    setSelectedTile(null);
    setPendingInteraction(null);
    setIsInitialized(true);
  };

  useEffect(() => { startGame(); }, []);

  // Bot Turn Loop
  useEffect(() => {
    if (!isInitialized || gamePhase !== 'playing' || pendingInteraction !== null || currentTurn === 0) return;
    let isActive = true;

    const runBotTurn = async () => {
      await new Promise(r => setTimeout(r, 600)); // slightly faster
      if (!isActive) return;

      const playerKey = `player${currentTurn}`;
      const botHand = [...hands[playerKey]];
      let freshDeck = [...deck];

      if (freshDeck.length === 0) { setGamePhase('draw'); return; }

      let draw = freshDeck.pop();
      let newFlowers = [];
      while (draw.startsWith('Flower') || draw.startsWith('Season')) {
        newFlowers.push(draw);
        if (freshDeck.length === 0) { 
           setFlowers(prev => ({ ...prev, [playerKey]: [...prev[playerKey], ...newFlowers] }));
           setGamePhase('draw'); 
           return; 
        }
        draw = freshDeck.pop();
      }
      if (newFlowers.length > 0) {
         setFlowers(prev => ({ ...prev, [playerKey]: [...prev[playerKey], ...newFlowers] }));
      }
      botHand.push(draw);

      if (checkWin(botHand)) { handleWin(currentTurn, 'zimo', botHand, exposed[playerKey]); return; }

      await new Promise(r => setTimeout(r, 400));
      if (!isActive) return;

      const ranked = rankDiscards(botHand);
      const chosenDiscard = ranked[0].tile;
      const newBotHand = [...botHand];
      newBotHand.splice(newBotHand.indexOf(chosenDiscard), 1);

      setHands(prev => ({ ...prev, [playerKey]: sortHand(newBotHand) }));
      setGlobalDiscard(prev => [...prev, chosenDiscard]); // Add to central pile
      setDeck(freshDeck);
      processDiscard(playerKey, chosenDiscard, newBotHand, freshDeck);
    };

    runBotTurn();
    return () => { isActive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setGlobalDiscard(prev => prev.slice(0, -1)); // Steal from middle
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

    if (nextTurn === 0) {
      let freshDeck = [...currentDeck];
      if (freshDeck.length === 0) { setGamePhase('draw'); return; }
      let draw = freshDeck.pop();
      let newFlowers = [];
      while (draw && (draw.startsWith('Flower') || draw.startsWith('Season'))) {
        newFlowers.push(draw);
        if (freshDeck.length === 0) { 
           setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }));
           setGamePhase('draw'); 
           return; 
        }
        draw = freshDeck.pop();
      }
      if (newFlowers.length > 0) {
         setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }));
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
    let scoreObj = null;
    const playerKey = `player${playerIdx}`;
    try {
      scoreObj = calculateScore({ hand: finalHand, exposed: finalExposed, flowers: flowers[playerKey] || [], winType: type });
    } catch (e) {
      scoreObj = { total: 1, breakdown: [{ label: 'Win', points: 1 }] };
    }

    const totalTai = scoreObj.total;
    const baseFee = 5;
    const pointFee = 1;
    const amountPerPlayer = baseFee + (totalTai * pointFee);
    
    let userDelta = 0;
    
    if (playerIdx === 0) {
      if (type === 'zimo') userDelta = amountPerPlayer * 3;
      else userDelta = amountPerPlayer * 1;
      winMoney(userDelta);
    } else {
      if (type === 'zimo') userDelta = -amountPerPlayer;
      else if (dealInSource === 'player0') userDelta = -amountPerPlayer;
      
      if (userDelta < 0) loseMoney(Math.abs(userDelta));
    }

    setFinancials({ delta: userDelta, amountPerPlayer });
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
      setSelectedTile(null);
      processDiscard(USER, tileToDiscard, newHand, deck);
    }
  };

  const handleUserAction = (action) => {
    const tile = pendingInteraction.tile;
    const sourceActor = pendingInteraction.sourceActor;
    let newDeck = [...deck];

    if (action === 'pass') {
      setPendingInteraction(null);
      let nextTurn = pendingInteraction.nextTurnIfPass;
      if (nextTurn === 0) {
        if (newDeck.length === 0) { setGamePhase('draw'); return; }
        let draw = newDeck.pop();
        let newFlowers = [];
        while (draw && (draw.startsWith('Flower') || draw.startsWith('Season'))) {
          newFlowers.push(draw);
          if (newDeck.length === 0) { 
             setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }));
             setGamePhase('draw'); 
             return; 
          }
          draw = newDeck.pop();
        }
        if (newFlowers.length > 0) {
           setFlowers(prev => ({ ...prev, [USER]: [...prev[USER], ...newFlowers] }));
        }
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
      setGlobalDiscard(prev => prev.slice(0, -1)); // steal from global pile
      setPendingInteraction(null);
      setCurrentTurn(0);
      return;
    }
    // Mobile chow (rudimentary, using first matched sequence just like web baseline)
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
  };

  if (!isInitialized) return <View style={s.root} />;

  // We hide hidden hands per request. We only render exposed melds and flowers.
  const renderBotExposedMelds = (botKey, direction) => {
    const isV = direction === 'v';
    // If no exposed, render an invisible spacer to preserve minimum positioning
    if (exposed[botKey].length === 0 && flowers[botKey].length === 0) return <View style={{ width: 10, height: 10 }} />;
    return (
      <View style={[s.botHandBox, isV ? { flexDirection: 'column' } : { flexDirection: 'row' }]}>
        {flowers[botKey].length > 0 && (
           <View style={[s.flowerMeld, isV ? { marginBottom: 4 } : { marginRight: 4 }]}>
              {flowers[botKey].map((t, i) => (
                 <View key={`f-${i}`} style={{ transform: [{ scale: 0.65 }], margin: -4 }}>
                    <NativeTile tileName={t} onClick={() => {}} />
                 </View>
              ))}
           </View>
        )}
        {exposed[botKey].map((m, i) => (
           <View key={`exp-${i}`} style={[s.exposedMeld, isV ? { marginBottom: 4 } : { marginRight: 4 }]}>
              {m.map((t, idx) => (
                 <View key={idx} style={{ transform: [{ scale: 0.65 }], margin: -4 }}>
                    <NativeTile tileName={t} onClick={() => {}} />
                 </View>
              ))}
           </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.btnLeave} onPress={onExit}>
          <Text style={s.btnLeaveText}>Leave Match</Text>
        </TouchableOpacity>
        <View style={s.bankBadge}>
           <Text style={s.bankText}>Bank: ${balance}</Text>
        </View>
        <View style={s.deckBadge}>
          <Text style={s.deckText}>Deck: {deck.length}</Text>
        </View>
      </View>

      {/* 4-way table */}
      <View style={s.tableArea}>

        {/* Top: BOT 2 */}
        <View style={s.botTop}>
          <Text style={[s.botLabel, currentTurn === 2 ? s.labelActive : s.labelIdle]}>Player 2 (Top)</Text>
          {renderBotExposedMelds(BOT2, 'h')}
        </View>

        {/* Left: BOT 3 */}
        <View style={s.botLeft}>
          <Text style={[s.botLabel, { transform: [{ rotate: '-90deg' }], marginBottom: 8 }, currentTurn === 3 ? s.labelActive : s.labelIdle]}>P3</Text>
          {renderBotExposedMelds(BOT3, 'v')}
        </View>

        {/* Right: BOT 1 */}
        <View style={s.botRight}>
          <Text style={[s.botLabel, { transform: [{ rotate: '90deg' }], marginBottom: 8 }, currentTurn === 1 ? s.labelActive : s.labelIdle]}>P1</Text>
          {renderBotExposedMelds(BOT1, 'v')}
        </View>

        {/* Center Discard Area */}
        <View style={s.centerDiscardsWrapper} pointerEvents={selectedTile ? 'auto' : 'none'}>
            <View style={s.centerDiscards}>
               {Array.isArray(globalDiscard) && globalDiscard.map((t, i) => (
                 <View key={i} style={[s.centerDiscardTile, i === globalDiscard.length - 1 && currentTurn !== 0 ? s.latestDiscard : null]}>
                    <NativeTile tileName={t} onClick={() => {}} />
                 </View>
               ))}
            </View>
            {(!globalDiscard || !Array.isArray(globalDiscard) || globalDiscard.length === 0) && (
                <View style={s.centerCircle}>
                   <Text style={s.centerText}>Bot{'\n'}Match</Text>
                </View>
            )}

            {/* User Action Overlay Native */}
            {currentTurn === 0 && gamePhase === 'playing' && !pendingInteraction && selectedTile && (
               <View style={s.discardOverlayWrapper}>
                   <TouchableOpacity 
                     onPress={() => handleUserDiscard(selectedTile)}
                     style={s.btnBigRedDiscard}
                   >
                     <Text style={s.btnBigRedText}>DISCARD</Text>
                   </TouchableOpacity>
               </View>
            )}
        </View>

      </View>

      {/* User action / discard area */}
      <View style={s.userArea}>
        {pendingInteraction ? (
          <View style={s.interactionRow}>
            <NativeTile tileName={pendingInteraction.tile} onClick={() => {}} />
            <View style={s.actionButtons}>
              <TouchableOpacity style={s.btnPass} onPress={() => handleUserAction('pass')}>
                <Text style={s.btnPassText}>Pass</Text>
              </TouchableOpacity>
              {pendingInteraction.actions.includes('chow') && (
                <TouchableOpacity style={s.btnChow} onPress={() => handleUserAction('chow')}>
                  <Text style={s.btnActionText}>CHOW!</Text>
                </TouchableOpacity>
              )}
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
        ) : (
          <View style={s.userDiscardSpacer} />
        )}
      </View>

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

            <View style={s.financeBox}>
               <Text style={s.financeTitle}>PAYOUT (${5} base + $1 / Tai)</Text>
               <Text style={[s.financeDelta, financials?.delta > 0 ? {color: '#10b981'} : financials?.delta < 0 ? {color: '#ef4444'} : {color: '#94a3b8'}]}>
                  {financials?.delta > 0 ? '+' : ''}{financials?.delta === 0 ? 'NO LOSS' : `$${financials?.delta}`}
               </Text>
            </View>

            <TouchableOpacity style={s.btnPlayAgain} onPress={startGame}>
              <Text style={s.btnPlayAgainText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* DRAW MODAL */}
      {gamePhase === 'draw' && (
        <View style={s.modalOverlay}>
          <View style={s.modalLose}>
            <Text style={s.modalTitle}>DRAW</Text>
            <TouchableOpacity style={s.btnPlayAgain} onPress={startGame}>
              <Text style={s.btnPlayAgainText}>Redeal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* User hand tray */}
      <View style={[s.handTray, currentTurn === 0 && !pendingInteraction ? s.handTrayActive : s.handTrayIdle]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
          <View style={s.handRow}>
            {flowers[USER].length > 0 && (
               <View style={s.flowerMeldUser}>
                  {flowers[USER].map((t, i) => <NativeTile key={`f-${i}`} tileName={t} onClick={() => {}} />)}
               </View>
            )}
            {exposed[USER].map((m, mIdx) => (
              <View key={mIdx} style={s.exposedMeldUser}>
                {m.map((t, i) => <NativeTile key={i} tileName={t} onClick={() => {}} />)}
              </View>
            ))}
            {hands[USER].map((tileName, idx) => {
              const isNew = currentTurn === 0 && idx === hands[USER].length - 1 && hands[USER].length === (17 - exposed[USER].length * 3);
              return (
                <View key={`tile-${idx}`} style={isNew ? { marginLeft: 16 } : {}}>
                  <NativeTile 
                     tileName={tileName} 
                     onClick={() => setSelectedTile(selectedTile === tileName ? null : tileName)}
                     selected={selectedTile === tileName}
                  />
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
  root: { flex: 1, backgroundColor: '#052e16' },

  // Top bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 8 },
  btnLeave: { backgroundColor: 'rgba(127,29,29,0.8)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ef4444' },
  btnLeaveText: { color: 'white', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  deckBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  deckText: { color: 'white', fontSize: 11, fontFamily: 'Courier' },
  bankBadge: { backgroundColor: 'rgba(52,211,153,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#34d399' },
  bankText: { color: '#34d399', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // Table
  tableArea: { flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  botTop: { position: 'absolute', top: -60, alignSelf: 'center', alignItems: 'center', width: '75%', zIndex: 10 },
  botLeft: { position: 'absolute', left: 4, top: 10, alignItems: 'center', zIndex: 10 },
  botRight: { position: 'absolute', right: 4, top: 10, alignItems: 'center', zIndex: 10 },
  botLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 },
  labelActive: { color: '#34d399' },
  labelIdle: { color: '#71717a' },
  botHandBox: { backgroundColor: 'rgba(160,82,45,0.2)', padding: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  exposedMeld: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(234,179,8,0.5)', padding: 2 },
  flowerMeld: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(236,72,153,0.5)', padding: 2 },
  
  centerDiscardsWrapper: { position: 'absolute', top: 40, bottom: 40, left: 40, right: 40, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  centerDiscards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: 660, height: '100%' },
  centerDiscardTile: { transform: [{ scale: 0.7 }], margin: -4, opacity: 0.9 },
  latestDiscard: { opacity: 1, transform: [{ scale: 0.8 }], borderRadius: 4, borderWidth: 4, borderColor: '#eab308' },
  
  centerCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(6,95,70,0.4)', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(6,78,59,0.2)', position: 'absolute' },
  centerText: { color: 'rgba(6,95,70,0.5)', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 2 },

  // User area
  userArea: { width: '100%', alignItems: 'center', marginBottom: 8, paddingVertical: 8, backgroundColor: 'rgba(5,46,22,0.8)' },
  interactionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#18181b', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(234,179,8,0.5)' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  btnPass: { backgroundColor: '#3f3f46', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnPassText: { color: 'white', fontWeight: 'bold' },
  btnChow: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#60a5fa' },
  btnPon: { backgroundColor: '#ea580c', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#fb923c' },
  btnHu: { backgroundColor: '#dc2626', paddingHorizontal: 32, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: '#eab308' },
  btnActionText: { color: 'white', fontWeight: 'bold' },
  btnHuText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userDiscardSpacer: { height: 10 },
  discardOverlayWrapper: { position: 'absolute', bottom: -50, right: -30, zIndex: 100 },
  btnBigRedDiscard: { backgroundColor: '#dc2626', borderColor: '#ef4444', borderWidth: 2, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, shadowColor: '#dc2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16 },
  btnBigRedText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

  // Modals
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, zIndex: 100 },
  modalBox: { padding: 32, borderRadius: 24, width: '100%', maxWidth: 360, borderWidth: 4 },
  modalWin: { backgroundColor: '#991b1b', borderColor: '#eab308' },
  modalLose: { backgroundColor: '#1e293b', borderColor: '#475569' },
  modalTitle: { color: '#eab308', fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: 3, marginBottom: 8 },
  modalSubtitle: { color: 'white', textAlign: 'center', fontSize: 16, marginBottom: 24 },
  penaltyBox: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 12, marginBottom: 24 },
  penaltyWho: { color: '#f87171', textAlign: 'center', fontWeight: 'bold' },
  penaltyAmount: { color: 'white', textAlign: 'center', marginTop: 8, fontSize: 22, fontWeight: '900' },
  financeBox: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 8, marginTop: 12, marginBottom: 12 },
  financeTitle: { color: '#94a3b8', fontSize: 10, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  financeDelta: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  btnPlayAgain: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  btnPlayAgainText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18, letterSpacing: 2 },

  // Hand tray
  handTray: { backgroundColor: '#A0522D', borderTopWidth: 4, borderTopColor: '#8B5A2B', paddingTop: 12 },
  handTrayActive: { shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20 },
  handTrayIdle: { opacity: 0.85 },
  handRow: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 8 },
  flowerMeldUser: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginRight: 16, padding: 4, borderRadius: 4, borderBottomWidth: 2, borderBottomColor: '#ec4899' },
  exposedMeldUser: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginRight: 16, padding: 4, borderRadius: 4, borderBottomWidth: 2, borderBottomColor: '#eab308' },
});
