import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from './ui/button';

const FilterButtons = ({ filterMode, onFilterChange, showLegend }) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-gray-400 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtros:
        </span>
        
        <Button
          onClick={() => onFilterChange('over35')}
          className={`${
            filterMode === 'over35'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-800 hover:bg-gray-700'
          } text-white`}
        >
          Over 3.5
        </Button>
        
        <Button
          onClick={() => onFilterChange('over45')}
          className={`${
            filterMode === 'over45'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-800 hover:bg-gray-700'
          } text-white`}
        >
          Over 4.5
        </Button>
        
        <Button
          onClick={() => onFilterChange(null)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
          disabled={!filterMode}
        >
          <X className="w-4 h-4 mr-1" />
          Limpar Filtros
        </Button>
      </div>

      {/* Legenda */}
      {showLegend && filterMode && (
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <h4 className="font-semibold mb-2 text-white">Legenda:</h4>
          {filterMode === 'over35' && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-green-600/30 border border-green-500 rounded"></div>
              <span className="text-gray-300">Partidas com mais de 3.5 gols (4+ gols)</span>
            </div>
          )}
          {filterMode === 'over45' && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-blue-600/30 border border-blue-500 rounded"></div>
              <span className="text-gray-300">Partidas com mais de 4.5 gols (5+ gols)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterButtons;