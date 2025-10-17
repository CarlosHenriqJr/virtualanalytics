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
  const [previousGamesToAnalyze, setPreviousGamesToAnalyze] = useState(10);
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

  // Analisa jogos anteriores de cada Over 3.5 selecionado
  const analyzeHistoricalPattern = () => {
    if (selectedCells.length === 0) {
      alert('Selecione pelo menos uma célula primeiro!');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Filtra apenas células Over 3.5
      const over35Cells = selectedCells.filter(c => c.match.totalGolsFT > 3.5);
      
      if (over35Cells.length === 0) {
        alert('Selecione pelo menos uma célula Over 3.5 para análise!');
        setIsAnalyzing(false);
        return;
      }

      console.log(`Analisando ${previousGamesToAnalyze} jogos anteriores para ${over35Cells.length} células Over 3.5`);

      // Data atual selecionada
      let currentDate;
      try {
        currentDate = parse(selectedDate, 'dd/MM/yyyy', new Date());
        if (!isValid(currentDate)) {
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

      const dateStr1 = format(currentDate, 'dd/MM/yyyy');
      const dateStr2 = format(currentDate, 'yyyy-MM-dd');
      
      // Busca todas as partidas do dia atual
      const dayMatches = allMatchesData?.filter(m => 
        m.date === dateStr1 || m.date === dateStr2
      ) || [];
      
      // Ordena partidas por hora e minuto
      const sortedMatches = [...dayMatches].sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minute - b.minute;
      });

      // Análise de cada célula Over 3.5
      const cellAnalyses = [];
      
      for (const cell of over35Cells) {
        // Encontra o índice deste jogo na lista ordenada
        const matchIndex = sortedMatches.findIndex(m => 
          m.hour === cell.hour && m.minute === cell.minute
        );
        
        if (matchIndex === -1) continue;

        // Pega os X jogos anteriores
        const startIndex = Math.max(0, matchIndex - previousGamesToAnalyze);
        const previousMatches = sortedMatches.slice(startIndex, matchIndex);
        
        if (previousMatches.length === 0) continue;

        // Analisa cada jogo anterior
        const previousGamesAnalysis = previousMatches.map(prevMatch => {
          // Identifica todas as odds disponíveis
          const allOdds = [];
          const greenOdds = []; // Odds que venceram
          
          if (prevMatch.markets) {
            // Análise de cada mercado
            Object.keys(prevMatch.markets).forEach(marketKey => {
              const oddValue = prevMatch.markets[marketKey];
              const isGreen = checkIfOddIsGreen(marketKey, prevMatch);
              
              allOdds.push({
                market: marketKey,
                odd: oddValue,
                isGreen
              });
              
              if (isGreen) {
                greenOdds.push({
                  market: marketKey,
                  odd: oddValue
                });
              }
            });
          }

          return {
            hour: prevMatch.hour,
            minute: prevMatch.minute,
            timeCasa: prevMatch.timeCasa,
            timeFora: prevMatch.timeFora,
            placarHT: prevMatch.placarHT,
            placarFT: prevMatch.placarFT,
            totalGolsFT: prevMatch.totalGolsFT,
            isOver35: prevMatch.totalGolsFT > 3.5,
            isOver45: prevMatch.totalGolsFT > 4.5,
            allOdds,
            greenOdds,
            greenOddsCount: greenOdds.length
          };
        });

        // Busca padrões nos jogos anteriores
        const patterns = findPatternsInPreviousGames(previousGamesAnalysis);

        cellAnalyses.push({
          cellPosition: `${cell.hour}:${cell.minute.toString().padStart(2, '0')}`,
          cellTeams: `${cell.match.timeCasa} vs ${cell.match.timeFora}`,
          cellScore: cell.match.placarFT,
          cellTotalGoals: cell.match.totalGolsFT,
          previousGamesCount: previousGamesAnalysis.length,
          previousGames: previousGamesAnalysis,
          patterns
        });
      }

      // Busca padrões globais entre todas as análises
      const globalPatterns = findGlobalPatterns(cellAnalyses);

      const results = {
        selectedOver35Count: over35Cells.length,
        previousGamesToAnalyze,
        cellAnalyses,
        globalPatterns,
        analysisDate: dateStr1
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

  // Verifica se uma odd específica foi "green" (venceu)
  const checkIfOddIsGreen = (marketKey, match) => {
    const totalGoals = match.totalGolsFT;
    const placarCasa = match.placarCasaFT;
    const placarFora = match.placarForaFT;
    
    // Total de Gols
    if (marketKey.includes('TotalGols_MaisDe_35')) return totalGoals > 3.5;
    if (marketKey.includes('TotalGols_MaisDe_45')) return totalGoals > 4.5;
    if (marketKey.includes('TotalGols_MaisDe_25')) return totalGoals > 2.5;
    if (marketKey.includes('TotalGols_MenosDe_35')) return totalGoals < 3.5;
    if (marketKey.includes('TotalGols_MenosDe_25')) return totalGoals < 2.5;
    
    // Ambas Marcam
    if (marketKey.includes('AmbasMarcam')) return placarCasa > 0 && placarFora > 0;
    
    // Vencedor
    if (marketKey.includes('Vencedor') || marketKey.includes('VencedorFT')) {
      if (marketKey.includes('Casa')) return placarCasa > placarFora;
      if (marketKey.includes('Visitante')) return placarFora > placarCasa;
      if (marketKey.includes('Empate')) return placarCasa === placarFora;
    }
    
    // Resultado Correto
    if (marketKey.includes('ResultadoCorreto')) {
      const scoreInMarket = marketKey.match(/(\d+)x(\d+)/);
      if (scoreInMarket) {
        return placarCasa === parseInt(scoreInMarket[1]) && placarFora === parseInt(scoreInMarket[2]);
      }
    }
    
    return false;
  };

  // Encontra padrões nos jogos anteriores de uma célula
  const findPatternsInPreviousGames = (games) => {
    if (games.length === 0) return {};

    // Padrão de odds green mais frequentes
    const oddFrequency = {};
    games.forEach(game => {
      game.greenOdds.forEach(odd => {
        const key = odd.market;
        oddFrequency[key] = (oddFrequency[key] || 0) + 1;
      });
    });

    const topGreenOdds = Object.entries(oddFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([market, count]) => ({
        market,
        frequency: count,
        percentage: ((count / games.length) * 100).toFixed(1)
      }));

    // Padrão de placares
    const scorePatterns = {};
    games.forEach(game => {
      const key = game.placarFT;
      scorePatterns[key] = (scorePatterns[key] || 0) + 1;
    });

    const topScores = Object.entries(scorePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([score, count]) => ({
        score,
        frequency: count,
        percentage: ((count / games.length) * 100).toFixed(1)
      }));

    // Padrão de times
    const teamsFrequency = {};
    games.forEach(game => {
      [game.timeCasa, game.timeFora].forEach(team => {
        teamsFrequency[team] = (teamsFrequency[team] || 0) + 1;
      });
    });

    const topTeams = Object.entries(teamsFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([team, count]) => ({
        team,
        frequency: count
      }));

    // Estatísticas gerais
    const over35Count = games.filter(g => g.isOver35).length;
    const over45Count = games.filter(g => g.isOver45).length;
    const avgGoals = (games.reduce((sum, g) => sum + g.totalGolsFT, 0) / games.length).toFixed(2);

    return {
      topGreenOdds,
      topScores,
      topTeams,
      over35Count,
      over35Percentage: ((over35Count / games.length) * 100).toFixed(1),
      over45Count,
      over45Percentage: ((over45Count / games.length) * 100).toFixed(1),
      avgGoals
    };
  };

  // Encontra padrões globais entre todas as células analisadas
  const findGlobalPatterns = (analyses) => {
    if (analyses.length === 0) return {};

    // Agrupa todas as odds green
    const globalOddFrequency = {};
    let totalGamesAnalyzed = 0;

    analyses.forEach(analysis => {
      totalGamesAnalyzed += analysis.previousGames.length;
      analysis.previousGames.forEach(game => {
        game.greenOdds.forEach(odd => {
          const key = odd.market;
          globalOddFrequency[key] = (globalOddFrequency[key] || 0) + 1;
        });
      });
    });

    const commonGreenOdds = Object.entries(globalOddFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([market, count]) => ({
        market,
        frequency: count,
        percentage: ((count / totalGamesAnalyzed) * 100).toFixed(1),
        appearsInCells: analyses.filter(a => 
          a.patterns.topGreenOdds?.some(o => o.market === market)
        ).length
      }));

    return {
      totalGamesAnalyzed,
      commonGreenOdds,
      analysisQuality: totalGamesAnalyzed >= previousGamesToAnalyze * analyses.length * 0.8 ? 'high' : 'medium'
    };
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
            <label className="text-xs text-gray-400 mb-1 block">Jogos anteriores para analisar (cada célula Over 3.5):</label>
            <Input
              type="number"
              min="1"
              max="50"
              value={previousGamesToAnalyze}
              onChange={(e) => setPreviousGamesToAnalyze(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="Ex: 5, 10, 20"
            />
          </div>
          <Button
            onClick={analyzeHistoricalPattern}
            disabled={selectedCells.length === 0 || isAnalyzing}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
          >
            <Search className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analisando...' : 'Analisar Jogos Anteriores'}
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
