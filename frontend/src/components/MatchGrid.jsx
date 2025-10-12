import React from 'react';
import MatchCell from './MatchCell';

const MatchGrid = ({ matches, showHT, filterMode, onMatchClick }) => {
  // Cria uma matriz 24h x 20min
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minuteSlots = Array.from({ length: 20 }, (_, i) => i * 3); // 0, 3, 6, 9...57

  // Organiza partidas por hora e minuto
  const matchGrid = {};
  matches.forEach(match => {
    const key = `${match.hour}-${match.minute}`;
    matchGrid[key] = match;
  });

  const getFilterColor = (match) => {
    if (!filterMode) return '';
    
    const { totalGolsFT } = match;
    
    if (filterMode === 'over35') {
      return totalGolsFT > 3.5 ? 'bg-green-600/30 border-green-500' : '';
    }
    
    if (filterMode === 'over45') {
      return totalGolsFT > 4.5 ? 'bg-blue-600/30 border-blue-500' : '';
    }
    
    return '';
  };

  const cellHeight = showHT ? 'h-[40px]' : 'h-[30px]';

  return (
    <div className="relative">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-gray-800 rounded-lg">
        <div className="inline-block min-w-full">
          {/* Header com minutos */}
          <div className="flex sticky top-0 z-10 bg-gray-950">
            <div className="w-[60px] flex-shrink-0 border-r border-gray-800 bg-gray-950 flex items-center justify-center text-xs font-semibold text-gray-400">
              Hora
            </div>
            {minuteSlots.map(minute => (
              <div
                key={minute}
                className="w-[50px] flex-shrink-0 border-r border-gray-800 flex items-center justify-center text-xs text-gray-400 font-medium"
              >
                :{minute.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Grid de partidas */}
          {hours.map(hour => (
            <div key={hour} className="flex">
              {/* Coluna da hora */}
              <div className="w-[60px] flex-shrink-0 border-r border-t border-gray-800 bg-gray-950 flex items-center justify-center text-sm font-semibold text-gray-300">
                {hour.toString().padStart(2, '0')}h
              </div>
              
              {/* Células de minutos */}
              {minuteSlots.map(minute => {
                const match = matchGrid[`${hour}-${minute}`];
                const filterColor = match ? getFilterColor(match) : '';
                
                return (
                  <div
                    key={`${hour}-${minute}`}
                    className={`w-[50px] ${cellHeight} flex-shrink-0 border-r border-t border-gray-800 transition-all duration-200`}
                  >
                    {match ? (
                      <MatchCell
                        match={match}
                        showHT={showHT}
                        filterColor={filterColor}
                        onClick={() => onMatchClick(match)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchGrid;