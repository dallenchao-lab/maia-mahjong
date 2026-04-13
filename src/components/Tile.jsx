import React from 'react';

const Tile = ({ tileName, onClick, selected }) => {
  const isFlower = tileName.includes('Flower');
  const isSeason = tileName.includes('Season');
  const isPlaceholder = isFlower || isSeason;

  // Determine the display label for placeholders
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

  return (
    <div 
      onClick={() => onClick && onClick(tileName)}
      className={`
        relative w-8 h-12 sm:w-10 sm:h-14 md:w-12 md:h-16 lg:w-16 lg:h-24 m-0.5 sm:m-1 lg:m-1.5 cursor-pointer select-none
        transition-all duration-200 transform
        ${selected ? '-translate-y-4 shadow-2xl scale-110 drop-shadow-[0_10px_10px_rgba(0,100,0,0.5)]' : 'shadow-md hover:-translate-y-2 hover:shadow-xl'}
      `}
      style={{
        // 3D Isometric / Tactile effect
        borderRadius: '4px',
        backgroundColor: '#FCFCFC',
        boxShadow: selected ? '0px 10px 0px #cfcfcf, 0px 15px 15px rgba(0,0,0,0.4)' : '0px 4px 0px #cfcfcf, 0px 6px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Front Face (White Canvas) */}
      <div className="absolute inset-x-0 bottom-0 top-0 rounded overflow-hidden">
        {isPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-1 relative border border-gray-100 rounded">
            <img src="/tiles/Blank.svg" alt="Blank Tile" className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />
            <span className="text-[10px] sm:text-xs font-bold text-green-800 z-10 block whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
              {label}
            </span>
            <span className="text-xl sm:text-2xl mt-1 z-10 opacity-80">{isFlower ? '🌸' : '☀️'}</span>
          </div>
        ) : (
          <img 
            src={`/tiles/${tileName}.svg?v=2`} 
            alt={tileName}
            className="w-full h-full object-contain p-1 border border-gray-100 rounded"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};

export default Tile;
