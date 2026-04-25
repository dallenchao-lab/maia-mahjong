import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TileMap } from '../utils/tileMapper';

const NativeTile = ({ tileName, onClick, selected }) => {
  const isFlower = tileName.includes('Flower');
  const isSeason = tileName.includes('Season');
  const isPlaceholder = isFlower || isSeason;

  let label = '';
  if (isFlower) {
    const num = tileName.replace('Flower', '');
    label = (['Plum', 'Orchid', 'Chrys.', 'Bamboo'])[parseInt(num) - 1] || 'Flower';
  } else if (isSeason) {
    const num = tileName.replace('Season', '');
    label = (['Spring', 'Summer', 'Autumn', 'Winter'])[parseInt(num) - 1] || 'Season';
  }

  const TileEntry = TileMap[tileName] || TileMap['Front'];
  const TileSvg = TileEntry?.default ?? TileEntry;

  return (
    <TouchableOpacity
      onPress={() => onClick && onClick(tileName)}
      style={[s.tile, selected && s.tileSelected]}
      activeOpacity={0.8}
    >
      {isPlaceholder ? (
        <View style={s.placeholderInner}>
          <Text style={s.placeholderLabel} numberOfLines={1}>{label}</Text>
          <Text style={s.placeholderEmoji}>{isFlower ? '🌸' : '☀️'}</Text>
        </View>
      ) : (
        <View style={s.svgInner}>
          {TileSvg && <TileSvg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />}
        </View>
      )}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  tile: {
    height: 48,
    width: 32,
    marginHorizontal: 1,
    marginVertical: 2,
    backgroundColor: '#FCFCFC',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  tileSelected: {
    elevation: 10,
    transform: [{ translateY: -8 }],
  },
  placeholderInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  placeholderLabel: { fontSize: 8, fontWeight: 'bold', color: '#166534', textAlign: 'center' },
  placeholderEmoji: { fontSize: 14, marginTop: 2, opacity: 0.8 },
  svgInner: { width: '100%', height: '100%', padding: 2 },
});

export default NativeTile;
