import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TileMap } from '../utils/tileMapper';

const NativeTile = ({ tileName, onClick, selected, isMobileContext = true }) => {
  const isFlower = tileName.includes('Flower');
  const isSeason = tileName.includes('Season');
  const isPlaceholder = isFlower || isSeason;

  // Render Label securely mimicking Web DOM metrics
  let label = '';
  if (isFlower) {
    const num = tileName.replace('Flower', '');
    const names = ['Plum', 'Orchid', 'Chrys.', 'Bamboo'];
    label = names[parseInt(num) - 1] || 'Flower';
  } else if (isSeason) {
    const num = tileName.replace('Season', '');
    const names = ['Spring', 'Summer', 'Autumn', 'Winter'];
    label = names[parseInt(num) - 1] || 'Season';
  }

  // Load physical mapped component natively utilizing SvgXml transformer bounds
  const TileSvg = TileMap[tileName] || TileMap['Front']; 

  return (
    <TouchableOpacity 
      onPress={() => onClick && onClick(tileName)}
      className={`relative justify-center items-center rounded overflow-hidden h-12 w-8 mx-[1px] my-0.5 ${selected ? 'shadow-xl -translate-y-4' : 'shadow-sm'}`}
      style={{
        backgroundColor: '#FCFCFC',
        elevation: selected ? 10 : 3, // Android shadow
      }}
      activeOpacity={0.8}
    >
      {isPlaceholder ? (
        <View className="w-full h-full flex flex-col items-center justify-center p-1 border border-gray-100 rounded">
           <Text className="text-[10px] font-bold text-green-800 text-center" numberOfLines={1}>{label}</Text>
           <Text className="text-xl mt-1 opacity-80">{isFlower ? '🌸' : '☀️'}</Text>
        </View>
      ) : (
        <View className="w-full h-full p-[2px]">
           {TileSvg && <TileSvg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default NativeTile;
