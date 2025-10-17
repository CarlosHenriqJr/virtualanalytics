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

      // Data atual selecionada - tenta diferentes formatos
      let currentDate;
      try {
        // Tenta formato dd/MM/yyyy
        currentDate = parse(selectedDate, 'dd/MM/yyyy', new Date());
        if (!isValid(currentDate)) {
          // Tenta formato yyyy-MM-dd
          currentDate = parse(selectedDate, 'yyyy-MM-dd', new Date());
        }
      } catch {
        currentDate = new Date(selectedDate);
      }
      
      if (!isValid(currentDate)) {
        alert('Erro ao processar a data selecionada');
        setIsAnalyzing(false);
        return;
      }
      
      // Array para armazenar resultados históricos
      const historicalOccurrences = [];
      
      // Itera pelos X dias anteriores
      for (let i = 1; i <= daysToAnalyze; i++) {
        const pastDate = subDays(currentDate, i);
        
        // Tenta ambos os formatos de data para comparação
        const pastDateStr1 = format(pastDate, 'dd/MM/yyyy');
        const pastDateStr2 = format(pastDate, 'yyyy-MM-dd');
        
        // Busca partidas do dia anterior (ambos os formatos)
        const pastMatches = allMatchesData?.filter(m => 
          m.date === pastDateStr1 || m.date === pastDateStr2
        ) || [];
        
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
            date: pastDateStr1,
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
        occurrences: historicalOccurrences.sort((a, b) => {
          const dateA = parse(a.date, 'dd/MM/yyyy', new Date());
          const dateB = parse(b.date, 'dd/MM/yyyy', new Date());
          return dateB - dateA;
        })
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

  // Verifica se célula está selecionada
  const isCellSelected = (hour, minute) => {
    return selectedCells.some(c => c.hour === hour && c.minute === minute);
  };

  return (
    <div className="space-y-6">
      {/* Instruções */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Seletor de Blocos - Análise Histórica</h3>
        </div>
        <p className="text-gray-300 mb-3">
          Selecione células Over 3.5 e descubra com que frequência esse padrão se repete em dias anteriores:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong>Clique em cada célula</strong> para adicionar/remover do padrão</p>
          <p>• Escolha quantos dias anteriores deseja analisar</p>
          <p>• Veja a frequência e taxa de acerto do padrão histórico</p>
          <p>• Células selecionadas ficam destacadas em azul</p>
        </div>

        {/* Controles */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-400 mb-1 block">Dias anteriores para análise:</label>
            <Input
              type="number"
              min="1"
              max="90"
              value={daysToAnalyze}
              onChange={(e) => setDaysToAnalyze(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="Ex: 7, 15, 30"
            />
          </div>
          <Button
            onClick={analyzeHistoricalPattern}
            disabled={selectedCells.length === 0 || isAnalyzing}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
          >
            <Search className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analisando...' : 'Analisar Padrão'}
          </Button>
          <Button
            onClick={clearSelection}
            disabled={selectedCells.length === 0}
            variant="outline"
            className="bg-red-900/20 hover:bg-red-900/40 border-red-500/30"
          >
            Limpar Seleção
          </Button>
        </div>

        {/* Indicador de seleção */}
        {selectedCells.length > 0 && (
          <div className="mt-3 p-3 bg-blue-900/30 border border-blue-500/30 rounded">
            <p className="text-sm text-blue-200">
              <strong>{selectedCells.length} célula(s) selecionada(s)</strong> - 
              Posições: {selectedCells.map(c => `${c.hour}:${c.minute.toString().padStart(2, '0')}`).join(', ')}
            </p>
          </div>
        )}
      </Card>

      {/* Grid Interativo */}
      <Card className="bg-gray-900/50 border-gray-800 p-4">
        <div className="overflow-x-auto">
          <div className="inline-block">
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
                  const isSelected = isCellSelected(hour, minute);
                  const isOver35 = match && match.totalGolsFT > 3.5;
                  const isOver45 = match && match.totalGolsFT > 4.5;

                  return (
                    <div
                      key={`${hour}-${minute}`}
                      className={`w-[50px] h-[50px] flex-shrink-0 border-r border-t border-gray-800 cursor-pointer transition-all ${
                        isSelected ? 'ring-4 ring-blue-400 ring-inset' : ''
                      } ${match ? 'hover:ring-2 hover:ring-blue-300' : ''}`}
                      onClick={() => handleCellClick(hour, minute)}
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

      {/* Resultados da Análise Histórica */}
      {historicalResults && (
        <Card className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-500/30 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Análise Histórica do Padrão</h3>
          </div>

          {/* Estatísticas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-400">Dias Analisados</p>
              </div>
              <p className="text-3xl font-bold text-white">{historicalResults.daysAnalyzed}</p>
            </div>

            <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-gray-400">Frequência</p>
              </div>
              <p className="text-3xl font-bold text-purple-400">
                {historicalResults.frequency.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {historicalResults.totalOccurrences} de {historicalResults.daysAnalyzed} dias
              </p>
            </div>

            <div className="bg-gray-900/70 rounded-lg p-4 border border-green-600/50">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-green-400" />
                <p className="text-xs text-gray-400">Taxa de Acerto</p>
              </div>
              <p className="text-3xl font-bold text-green-400">
                {historicalResults.successRate.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {historicalResults.fullMatches} acertos completos
              </p>
            </div>

            <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-gray-400">Tamanho Padrão</p>
              </div>
              <p className="text-3xl font-bold text-yellow-400">
                {historicalResults.patternSize}
              </p>
              <p className="text-xs text-gray-500 mt-1">células selecionadas</p>
            </div>
          </div>

          {/* Interpretação */}
          <div className={`p-4 rounded-lg border mb-6 ${
            historicalResults.successRate >= 70 ? 'bg-green-900/30 border-green-500/50' :
            historicalResults.successRate >= 50 ? 'bg-yellow-900/30 border-yellow-500/50' :
            'bg-red-900/30 border-red-500/50'
          }`}>
            <p className="text-sm font-semibold mb-2 text-white">
              {historicalResults.successRate >= 70 ? '✅ Padrão Forte!' :
               historicalResults.successRate >= 50 ? '⚠️ Padrão Moderado' :
               '❌ Padrão Fraco'}
            </p>
            <p className="text-sm text-gray-300">
              {historicalResults.totalOccurrences === 0 ? (
                `Este padrão não foi encontrado nos últimos ${historicalResults.daysAnalyzed} dias. Pode ser um padrão raro ou único.`
              ) : (
                <>
                  Este padrão apareceu em <strong>{historicalResults.frequency.toFixed(1)}%</strong> dos dias analisados.
                  {' '}Das {historicalResults.totalOccurrences} ocorrências, <strong>{historicalResults.fullMatches}</strong> tiveram 
                  todas as células como Over 3.5 (<strong>{historicalResults.successRate.toFixed(1)}%</strong> de acerto).
                  {historicalResults.successRate >= 70 && ' Excelente padrão para estratégias!'}
                  {historicalResults.successRate < 50 && ' Considere revisar o padrão ou buscar correlações adicionais.'}
                </>
              )}
            </p>
          </div>

          {/* Lista de Ocorrências */}
          {historicalResults.occurrences.length > 0 && (
            <div>
              <h4 className="text-lg font-bold text-white mb-4">
                Ocorrências Históricas ({historicalResults.occurrences.length})
              </h4>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {historicalResults.occurrences.map((occurrence, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-gray-800/50 rounded-lg p-4 border ${
                      occurrence.isFullMatch ? 'border-green-500/50' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-white">{occurrence.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          occurrence.isFullMatch ? 'bg-green-600 text-white' :
                          occurrence.matchRate >= 50 ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {occurrence.over35Count}/{occurrence.totalExpected} Over 3.5
                        </span>
                        <span className="text-xs text-gray-400">
                          ({occurrence.matchRate.toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {occurrence.details.map((detail, didx) => (
                        <div 
                          key={didx}
                          className={`p-2 rounded text-xs ${
                            detail.isOver35 ? 'bg-green-900/30 border border-green-500/30' :
                            'bg-gray-900/50 border border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">
                              {detail.hour}:{detail.minute.toString().padStart(2, '0')}
                            </span>
                            <span className={`font-bold ${detail.isOver35 ? 'text-green-400' : 'text-red-400'}`}>
                              {detail.isOver35 ? '✓' : '✗'}
                            </span>
                          </div>
                          <p className="text-gray-300 mt-1">{detail.teams}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-gray-400">{detail.score}</span>
                            <span className="text-gray-400">
                              {detail.totalGoals} gols
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historicalResults.occurrences.length === 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
              <p className="text-gray-400">
                Nenhuma ocorrência deste padrão foi encontrada nos últimos {historicalResults.daysAnalyzed} dias.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Tente selecionar um padrão diferente ou aumentar o período de análise.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InteractiveBlockSelector;
