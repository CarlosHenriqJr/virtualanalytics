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
      // Extrai o padrão de Over 3.5 das células selecionadas (true/false)
      const pattern = selectedCells.map(c => c.match.totalGolsFT > 3.5);
      const patternString = pattern.map(p => p ? '1' : '0').join('');
      
      console.log('Buscando padrão:', pattern, 'String:', patternString);

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

        // Ordena partidas por hora e minuto para criar sequências
        const sortedMatches = [...pastMatches].sort((a, b) => {
          if (a.hour !== b.hour) return a.hour - b.hour;
          return a.minute - b.minute;
        });

        // Busca o padrão em todas as sequências possíveis
        for (let startIdx = 0; startIdx <= sortedMatches.length - pattern.length; startIdx++) {
          const sequence = sortedMatches.slice(startIdx, startIdx + pattern.length);
          const sequencePattern = sequence.map(m => m.totalGolsFT > 3.5);
          const sequenceString = sequencePattern.map(p => p ? '1' : '0').join('');
          
          // Verifica se o padrão coincide
          if (sequenceString === patternString) {
            const over35Count = sequencePattern.filter(p => p).length;
            const matchRate = (over35Count / pattern.length) * 100;
            const isFullMatch = over35Count === pattern.length;

            historicalOccurrences.push({
              date: pastDateStr1,
              matches: sequence,
              over35Count,
              totalInPattern: pattern.length,
              totalExpected: pattern.length,
              matchRate,
              isFullMatch,
              patternMatch: true,
              details: sequence.map(m => ({
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
      }

      // Calcula estatísticas gerais
      const totalOccurrences = historicalOccurrences.length;
      const fullMatches = historicalOccurrences.filter(o => o.isFullMatch).length;
      const successRate = totalOccurrences > 0 ? (fullMatches / totalOccurrences) * 100 : 0;
      const frequency = totalOccurrences > 0 ? (totalOccurrences / daysToAnalyze) * 100 : 0;

      const results = {
        pattern: pattern.map((isOver, idx) => ({
          position: idx + 1,
          isOver35: isOver,
          originalCell: selectedCells[idx]
        })),
        patternString,
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
            <p className="text-sm text-blue-200 mb-2">
              <strong>{selectedCells.length} célula(s) selecionada(s)</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedCells.map((cell, idx) => {
                const isOver35 = cell.match.totalGolsFT > 3.5;
                return (
                  <div key={idx} className={`px-2 py-1 rounded text-xs font-semibold ${
                    isOver35 ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                  }`}>
                    {idx + 1}. {cell.hour}:{cell.minute.toString().padStart(2, '0')} - {isOver35 ? 'Over 3.5 ✓' : 'Not Over ✗'}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-blue-300 mt-2">
              Padrão: {selectedCells.map(c => c.match.totalGolsFT > 3.5 ? '🟢' : '🔴').join(' ')}
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

          {/* Padrão Buscado */}
          <div className="mb-6 p-4 bg-gray-900/70 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Padrão buscado (combinação de resultados):</p>
            <div className="flex flex-wrap gap-2">
              {historicalResults.pattern.map((p, idx) => (
                <div key={idx} className={`px-3 py-2 rounded ${
                  p.isOver35 ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                } font-semibold`}>
                  {idx + 1}. {p.isOver35 ? 'Over 3.5 ✓' : 'Not Over ✗'}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Código do padrão: {historicalResults.patternString} 
              <span className="ml-2 text-gray-500">(1 = Over 3.5, 0 = Not Over)</span>
            </p>
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
                {historicalResults.totalOccurrences} ocorrências
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
                {historicalResults.fullMatches} padrões completos
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
              <p className="text-xs text-gray-500 mt-1">jogos consecutivos</p>
            </div>
          </div>

          {/* Interpretação */}
          <div className={`p-4 rounded-lg border mb-6 ${
            historicalResults.frequency >= 30 && historicalResults.successRate >= 70 ? 'bg-green-900/30 border-green-500/50' :
            historicalResults.frequency >= 15 && historicalResults.successRate >= 50 ? 'bg-yellow-900/30 border-yellow-500/50' :
            'bg-red-900/30 border-red-500/50'
          }`}>
            <p className="text-sm font-semibold mb-2 text-white">
              {historicalResults.frequency >= 30 && historicalResults.successRate >= 70 ? '✅ Padrão Forte e Frequente!' :
               historicalResults.frequency >= 15 && historicalResults.successRate >= 50 ? '⚠️ Padrão Moderado' :
               '❌ Padrão Fraco ou Raro'}
            </p>
            <p className="text-sm text-gray-300">
              {historicalResults.totalOccurrences === 0 ? (
                `Esta combinação específica não foi encontrada nos últimos ${historicalResults.daysAnalyzed} dias. Pode ser um padrão raro ou único.`
              ) : (
                <>
                  Esta combinação apareceu <strong>{historicalResults.totalOccurrences} vez(es)</strong> nos 
                  últimos {historicalResults.daysAnalyzed} dias (<strong>{historicalResults.frequency.toFixed(1)}%</strong> dos dias).
                  {' '}Das ocorrências encontradas, <strong>{historicalResults.fullMatches}</strong> tiveram 
                  o padrão exato de Over 3.5 (<strong>{historicalResults.successRate.toFixed(1)}%</strong> de acerto).
                  {historicalResults.frequency >= 30 && historicalResults.successRate >= 70 && ' 🎯 Excelente padrão para estratégias!'}
                  {historicalResults.frequency < 15 && ' Considere aumentar o período de análise ou buscar padrões mais comuns.'}
                </>
              )}
            </p>
          </div>

          {/* Lista de Ocorrências */}
          {historicalResults.occurrences.length > 0 && (
            <div>
              <h4 className="text-lg font-bold text-white mb-4">
                Ocorrências Encontradas ({historicalResults.occurrences.length})
              </h4>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {historicalResults.occurrences.map((occurrence, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-gray-800/50 rounded-lg p-4 border ${
                      occurrence.isFullMatch ? 'border-green-500/50' : 'border-yellow-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-white">{occurrence.date}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          occurrence.isFullMatch ? 'bg-green-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}>
                          {occurrence.isFullMatch ? '✓ Padrão Exato' : '~ Parcial'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          occurrence.matchRate === 100 ? 'bg-green-600 text-white' :
                          occurrence.matchRate >= 60 ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {occurrence.matchRate.toFixed(0)}% Match
                        </span>
                      </div>
                    </div>

                    {/* Sequência encontrada */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Sequência encontrada:</p>
                      <div className="flex gap-1">
                        {occurrence.details.map((detail, didx) => (
                          <div key={didx} className={`w-6 h-6 rounded flex items-center justify-center ${
                            detail.isOver35 ? 'bg-green-600' : 'bg-gray-600'
                          }`}>
                            <span className="text-white text-xs font-bold">
                              {detail.isOver35 ? '✓' : '✗'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {occurrence.details.map((detail, didx) => (
                        <div 
                          key={didx}
                          className={`p-2 rounded text-xs ${
                            detail.isOver35 ? 'bg-green-900/30 border border-green-500/30' :
                            'bg-gray-900/50 border border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-white">
                              #{didx + 1} - {detail.hour}:{detail.minute.toString().padStart(2, '0')}
                            </span>
                            <span className={`font-bold ${detail.isOver35 ? 'text-green-400' : 'text-red-400'}`}>
                              {detail.isOver35 ? '✓' : '✗'}
                            </span>
                          </div>
                          <p className="text-gray-300">{detail.teams}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-gray-400">{detail.score}</span>
                            <span className={`font-semibold ${
                              detail.totalGoals > 3.5 ? 'text-green-400' : 'text-gray-400'
                            }`}>
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
                Nenhuma ocorrência desta combinação foi encontrada nos últimos {historicalResults.daysAnalyzed} dias.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Tente aumentar o período de análise ou selecione uma combinação diferente.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InteractiveBlockSelector;
