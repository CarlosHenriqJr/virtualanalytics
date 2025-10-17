import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, Award, Clock, Users, Search, Calendar } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import MatchCell from './MatchCell';
import { parse, subDays, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const InteractiveBlockSelector = ({ matches, allMatchesData, selectedDate, onBlockAnalyzed }) => {
  const [selectedCells, setSelectedCells] = useState([]);
  const [analyzedBlocks, setAnalyzedBlocks] = useState([]);
  const [daysToAnalyze, setDaysToAnalyze] = useState(7);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historicalResults, setHistoricalResults] = useState(null);

  // Cria grid 24h x 20min
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minuteSlots = Array.from({ length: 20 }, (_, i) => i * 3);

  // Organiza partidas por hora e minuto
  const matchGrid = useMemo(() => {
    const grid = {};
    matches.forEach(match => {
      const key = `${match.hour}-${match.minute}`;
      grid[key] = match;
    });
    return grid;
  }, [matches]);

  // Seleciona/deseleciona célula individual
  const handleCellClick = (hour, minute) => {
    const match = matchGrid[`${hour}-${minute}`];
    if (!match) return;

    const cellKey = `${hour}-${minute}`;
    const isAlreadySelected = selectedCells.some(
      c => `${c.hour}-${c.minute}` === cellKey
    );

    if (isAlreadySelected) {
      // Remove da seleção
      setSelectedCells(selectedCells.filter(c => `${c.hour}-${c.minute}` !== cellKey));
    } else {
      // Adiciona à seleção
      setSelectedCells([...selectedCells, { hour, minute, match }]);
    }
  };

  // Limpa seleção
  const clearSelection = () => {
    setSelectedCells([]);
    setHistoricalResults(null);
  };

  // Analisa padrão histórico
  const analyzeHistoricalPattern = () => {
    if (selectedCells.length === 0) {
      alert('Selecione pelo menos uma célula primeiro!');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Extrai o padrão de posições selecionadas (horário/minuto)
      const pattern = selectedCells.map(c => ({
        hour: c.hour,
        minute: c.minute
      }));

      // Data atual selecionada
      const currentDate = parse(selectedDate, 'dd/MM/yyyy', new Date());
      
      // Array para armazenar resultados históricos
      const historicalOccurrences = [];
      
      // Itera pelos X dias anteriores
      for (let i = 1; i <= daysToAnalyze; i++) {
        const pastDate = subDays(currentDate, i);
        const pastDateStr = format(pastDate, 'dd/MM/yyyy');
        
        // Busca partidas do dia anterior
        const pastMatches = allMatchesData?.filter(m => m.date === pastDateStr) || [];
        
        if (pastMatches.length === 0) continue;

        // Cria grid do dia anterior
        const pastGrid = {};
        pastMatches.forEach(match => {
          const key = `${match.hour}-${match.minute}`;
          pastGrid[key] = match;
        });

        // Verifica se o padrão existe neste dia
        const patternMatches = pattern.map(p => {
          const key = `${p.hour}-${p.minute}`;
          return pastGrid[key];
        }).filter(m => m); // Remove nulls

        if (patternMatches.length > 0) {
          // Conta quantas células são Over 3.5
          const over35Count = patternMatches.filter(m => m.totalGolsFT > 3.5).length;
          const totalInPattern = patternMatches.length;
          const matchRate = (over35Count / pattern.length) * 100;
          const isFullMatch = over35Count === pattern.length;

          historicalOccurrences.push({
            date: pastDateStr,
            matches: patternMatches,
            over35Count,
            totalInPattern,
            totalExpected: pattern.length,
            matchRate,
            isFullMatch,
            details: patternMatches.map(m => ({
              hour: m.hour,
              minute: m.minute,
              teams: `${m.timeCasa} vs ${m.timeFora}`,
              score: m.placarFT,
              totalGoals: m.totalGolsFT,
              isOver35: m.totalGolsFT > 3.5,
              odd: m.markets?.TotalGols_MaisDe_35 || 0
            }))
          });
        }
      }

      // Calcula estatísticas gerais
      const totalOccurrences = historicalOccurrences.length;
      const fullMatches = historicalOccurrences.filter(o => o.isFullMatch).length;
      const successRate = totalOccurrences > 0 ? (fullMatches / totalOccurrences) * 100 : 0;
      const frequency = (totalOccurrences / daysToAnalyze) * 100;

      const results = {
        pattern,
        patternSize: pattern.length,
        daysAnalyzed: daysToAnalyze,
        totalOccurrences,
        fullMatches,
        partialMatches: totalOccurrences - fullMatches,
        successRate,
        frequency,
        occurrences: historicalOccurrences.sort((a, b) => 
          parse(b.date, 'dd/MM/yyyy', new Date()) - parse(a.date, 'dd/MM/yyyy', new Date())
        )
      };

      setHistoricalResults(results);
      onBlockAnalyzed?.(results);
    } catch (error) {
      console.error('Erro ao analisar padrão histórico:', error);
      alert('Erro ao analisar padrão. Verifique os dados.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Verifica se célula está na seleção
  const isCellInSelection = (hour, minute) => {
    if (!isSelecting || !selectionStart || !selectionEnd) return false;

    const minHour = Math.min(selectionStart.hour, selectionEnd.hour);
    const maxHour = Math.max(selectionStart.hour, selectionEnd.hour);
    const minMinIdx = Math.min(
      minuteSlots.indexOf(selectionStart.minute),
      minuteSlots.indexOf(selectionEnd.minute)
    );
    const maxMinIdx = Math.max(
      minuteSlots.indexOf(selectionStart.minute),
      minuteSlots.indexOf(selectionEnd.minute)
    );
    const minIdx = minuteSlots.indexOf(minute);

    return hour >= minHour && hour <= maxHour && minIdx >= minMinIdx && minIdx <= maxMinIdx;
  };

  return (
    <div className="space-y-6">
      {/* Instruções */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Seletor de Blocos Interativo</h3>
        </div>
        <p className="text-gray-300 mb-3">
          Arraste o mouse sobre o grid para selecionar blocos de jogos e analisá-los:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong>Clique e arraste</strong> para desenhar um retângulo sobre os jogos</p>
          <p>• O sistema analisará automaticamente o bloco selecionado</p>
          <p>• Veja estatísticas de Over 3.5, Over 4.5, times envolvidos e padrões</p>
        </div>
      </Card>

      {/* Grid Interativo */}
      <Card className="bg-gray-900/50 border-gray-800 p-4">
        <div className="overflow-x-auto">
          <div 
            className="inline-block"
            onMouseLeave={() => {
              if (isSelecting) {
                setIsSelecting(false);
              }
            }}
          >
            {/* Header */}
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

            {/* Grid */}
            {hours.map(hour => (
              <div key={hour} className="flex">
                <div className="w-[60px] flex-shrink-0 border-r border-t border-gray-800 bg-gray-950 flex items-center justify-center text-sm font-semibold text-gray-300">
                  {hour.toString().padStart(2, '0')}h
                </div>
                
                {minuteSlots.map(minute => {
                  const match = matchGrid[`${hour}-${minute}`];
                  const isSelected = isCellInSelection(hour, minute);
                  const isOver35 = match && match.totalGolsFT > 3.5;
                  const isOver45 = match && match.totalGolsFT > 4.5;

                  return (
                    <div
                      key={`${hour}-${minute}`}
                      className={`w-[50px] h-[50px] flex-shrink-0 border-r border-t border-gray-800 cursor-crosshair transition-all ${
                        isSelected ? 'bg-blue-500/30 ring-2 ring-blue-400' : ''
                      }`}
                      onMouseDown={() => handleMouseDown(hour, minute)}
                      onMouseEnter={() => handleMouseEnter(hour, minute)}
                      onMouseUp={handleMouseUp}
                    >
                      {match && (
                        <div className={`w-full h-full p-1 text-[9px] leading-tight flex flex-col items-center justify-center ${
                          isOver45 ? 'bg-blue-600/40 border-2 border-blue-400' :
                          isOver35 ? 'bg-green-600/40 border-2 border-green-400' :
                          'bg-gray-800'
                        }`}>
                          <div className="font-semibold text-white text-center">
                            {match.timeCasa.substring(0, 3)} x {match.timeFora.substring(0, 3)}
                          </div>
                          <div className="font-bold text-green-400 text-[10px]">
                            {match.placarFT}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Blocos Analisados */}
      {analyzedBlocks.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <h3 className="text-xl font-bold text-white">Blocos Analisados</h3>
            </div>
            <Button
              onClick={() => setAnalyzedBlocks([])}
              variant="outline"
              size="sm"
              className="bg-red-900/20 hover:bg-red-900/40"
            >
              Limpar Análises
            </Button>
          </div>

          <div className="space-y-4">
            {analyzedBlocks.map((block, idx) => (
              <div key={block.id} className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-white">Bloco #{idx + 1}</h4>
                  <div className="flex gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      block.over35Rate > 60 ? 'bg-green-600' :
                      block.over35Rate > 40 ? 'bg-yellow-600' :
                      'bg-gray-600'
                    } text-white`}>
                      {block.over35Rate.toFixed(0)}% Over 3.5
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      block.over45Rate > 50 ? 'bg-blue-600' :
                      'bg-gray-600'
                    } text-white`}>
                      {block.over45Rate.toFixed(0)}% Over 4.5
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Total Jogos</p>
                    <p className="text-2xl font-bold text-white">{block.totalMatches}</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Over 3.5</p>
                    <p className="text-2xl font-bold text-green-400">{block.over35Count}</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Over 4.5</p>
                    <p className="text-2xl font-bold text-blue-400">{block.over45Count}</p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Odd Média</p>
                    <p className="text-2xl font-bold text-yellow-400">{block.avgOdd.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-sm text-gray-400 mb-2">Horários:</p>
                    <div className="flex flex-wrap gap-1">
                      {block.hours.map(h => (
                        <span key={h} className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs">
                          {h}h
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded p-3">
                    <p className="text-sm text-gray-400 mb-2">Times Envolvidos:</p>
                    <div className="flex flex-wrap gap-1">
                      {block.teams.slice(0, 6).map((team, tidx) => (
                        <span key={tidx} className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                          {team}
                        </span>
                      ))}
                      {block.teams.length > 6 && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          +{block.teams.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded p-3">
                  <p className="text-sm text-green-200">
                    <strong>Insight:</strong> Este bloco tem {block.over35Rate > 60 ? 'alta' : block.over35Rate > 40 ? 'média' : 'baixa'} taxa de Over 3.5. 
                    {block.over35Rate > 60 && ' Excelente para estratégias agressivas!'}
                    {block.avgOdd < 3 && ' Odds baixas indicam favorecimento.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default InteractiveBlockSelector;
