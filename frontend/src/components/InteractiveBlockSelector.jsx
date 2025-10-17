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
  const [cellTypes, setCellTypes] = useState({}); // 'pattern' ou 'entry'
  const [selectionMode, setSelectionMode] = useState('pattern'); // 'pattern' ou 'entry'
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
      const newTypes = {...cellTypes};
      delete newTypes[cellKey];
      setCellTypes(newTypes);
    } else {
      // Adiciona à seleção com o tipo atual (pattern ou entry)
      setSelectedCells([...selectedCells, { hour, minute, match }]);
      setCellTypes({...cellTypes, [cellKey]: selectionMode});
    }
  };

  // Limpa seleção
  const clearSelection = () => {
    setSelectedCells([]);
    setCellTypes({});
    setHistoricalResults(null);
  };

  // Analisa probabilidade de entrada baseada em padrão
  const analyzeEntryPattern = () => {
    if (selectedCells.length === 0) {
      alert('Selecione células primeiro!');
      return;
    }

    // Separa células por tipo
    const patternCells = selectedCells.filter(c => {
      const key = `${c.hour}-${c.minute}`;
      return cellTypes[key] === 'pattern';
    });

    const entryCells = selectedCells.filter(c => {
      const key = `${c.hour}-${c.minute}`;
      return cellTypes[key] === 'entry';
    });

    if (patternCells.length === 0) {
      alert('Selecione pelo menos 1 célula como PADRÃO!');
      return;
    }

    if (entryCells.length === 0) {
      alert('Selecione pelo menos 1 célula como ENTRADA!');
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log(`Analisando padrão de ${patternCells.length} células e ${entryCells.length} entradas`);

      // Extrai o padrão base (sequência de Over 3.5)
      const basePattern = patternCells.map(c => c.match.totalGolsFT > 3.5);
      const basePatternString = basePattern.map(p => p ? '1' : '0').join('');

      // Data atual
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
        alert('Erro ao processar a data');
        setIsAnalyzing(false);
        return;
      }

      // Busca todas as partidas do dia
      const dateStr1 = format(currentDate, 'dd/MM/yyyy');
      const dateStr2 = format(currentDate, 'yyyy-MM-dd');
      
      const dayMatches = allMatchesData?.filter(m => 
        m.date === dateStr1 || m.date === dateStr2
      ) || [];

      const sortedMatches = [...dayMatches].sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minute - b.minute;
      });

      // Para cada célula de entrada, analisa o contexto
      const entryAnalyses = [];

      for (const entryCell of entryCells) {
        // Encontra o índice da entrada
        const entryIndex = sortedMatches.findIndex(m =>
          m.hour === entryCell.hour && m.minute === entryCell.minute
        );

        if (entryIndex === -1) continue;

        // Verifica se há o padrão antes da entrada
        const startIdx = entryIndex - patternCells.length;
        if (startIdx < 0) continue;

        const precedingGames = sortedMatches.slice(startIdx, entryIndex);
        const precedingPattern = precedingGames.map(m => m.totalGolsFT > 3.5);
        const precedingString = precedingPattern.map(p => p ? '1' : '0').join('');

        // Pega os 5 jogos a partir da entrada (incluindo ela)
        const next5Games = sortedMatches.slice(entryIndex, entryIndex + 5);

        entryAnalyses.push({
          entryCell,
          entryPosition: `${entryCell.hour}:${entryCell.minute.toString().padStart(2, '0')}`,
          precedingPattern,
          precedingString,
          matchesBasePattern: precedingString === basePatternString,
          next5Games: next5Games.map((game, idx) => ({
            position: idx,
            hour: game.hour,
            minute: game.minute,
            teams: `${game.timeCasa} vs ${game.timeFora}`,
            score: game.placarFT,
            totalGoals: game.totalGolsFT,
            isOver35: game.totalGolsFT > 3.5,
            isOver45: game.totalGolsFT > 4.5
          }))
        });
      }

      // Busca histórico: quando esse padrão apareceu, o que aconteceu nos próximos 5 jogos?
      const historicalOccurrences = [];

      // Percorre todos os jogos do sortedMatches
      for (let i = patternCells.length; i < sortedMatches.length - 5; i++) {
        // Verifica se há o padrão aqui
        const precedingGames = sortedMatches.slice(i - patternCells.length, i);
        const precedingPattern = precedingGames.map(m => m.totalGolsFT > 3.5);
        const precedingString = precedingPattern.map(p => p ? '1' : '0').join('');

        if (precedingString === basePatternString) {
          // Padrão encontrado! Pega os próximos 5 jogos
          const next5 = sortedMatches.slice(i, i + 5);
          
          historicalOccurrences.push({
            foundAtIndex: i,
            foundAtPosition: `${sortedMatches[i].hour}:${sortedMatches[i].minute.toString().padStart(2, '0')}`,
            next5Games: next5.map((game, idx) => ({
              position: idx,
              hour: game.hour,
              minute: game.minute,
              teams: `${game.timeCasa} vs ${game.timeFora}`,
              score: game.placarFT,
              totalGoals: game.totalGolsFT,
              isOver35: game.totalGolsFT > 3.5,
              isOver45: game.totalGolsFT > 4.5
            }))
          });
        }
      }

      // Calcula probabilidades para cada posição (0-4)
      const probabilities = [];
      for (let pos = 0; pos < 5; pos++) {
        const totalOccurrences = historicalOccurrences.filter(occ => occ.next5Games.length > pos).length;
        const over35Count = historicalOccurrences.filter(occ => 
          occ.next5Games.length > pos && occ.next5Games[pos].isOver35
        ).length;
        const over45Count = historicalOccurrences.filter(occ =>
          occ.next5Games.length > pos && occ.next5Games[pos].isOver45
        ).length;

        probabilities.push({
          position: pos,
          label: pos === 0 ? 'Entrada' : `+${pos} jogos`,
          totalOccurrences,
          over35Count,
          over35Probability: totalOccurrences > 0 ? (over35Count / totalOccurrences) * 100 : 0,
          over45Count,
          over45Probability: totalOccurrences > 0 ? (over45Count / totalOccurrences) * 100 : 0
        });
      }

      const results = {
        type: 'entry_pattern',
        basePattern,
        basePatternString,
        patternCells: patternCells.map(c => ({
          position: `${c.hour}:${c.minute.toString().padStart(2, '0')}`,
          teams: `${c.match.timeCasa} vs ${c.match.timeFora}`,
          isOver35: c.match.totalGolsFT > 3.5
        })),
        entryAnalyses,
        historicalOccurrences,
        probabilities,
        totalHistoricalOccurrences: historicalOccurrences.length,
        analysisQuality: historicalOccurrences.length >= 5 ? 'high' : historicalOccurrences.length >= 2 ? 'medium' : 'low'
      };

      setHistoricalResults(results);
      onBlockAnalyzed?.(results);

    } catch (error) {
      console.error('Erro ao analisar padrão de entrada:', error);
      alert('Erro ao analisar. Verifique os dados.');
    } finally {
      setIsAnalyzing(false);
    }
  };
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

    // Padrão de odds green mais frequentes com valores
    const oddData = {};
    games.forEach(game => {
      game.greenOdds.forEach(odd => {
        const key = odd.market;
        if (!oddData[key]) {
          oddData[key] = {
            count: 0,
            totalOdd: 0,
            odds: []
          };
        }
        oddData[key].count += 1;
        oddData[key].totalOdd += odd.odd;
        oddData[key].odds.push(odd.odd);
      });
    });

    const topGreenOdds = Object.entries(oddData)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([market, data]) => ({
        market,
        frequency: data.count,
        percentage: ((data.count / games.length) * 100).toFixed(1),
        avgOdd: (data.totalOdd / data.count).toFixed(2),
        minOdd: Math.min(...data.odds).toFixed(2),
        maxOdd: Math.max(...data.odds).toFixed(2)
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

    // Agrupa todas as odds green com seus valores
    const globalOddData = {};
    let totalGamesAnalyzed = 0;

    analyses.forEach(analysis => {
      totalGamesAnalyzed += analysis.previousGames.length;
      analysis.previousGames.forEach(game => {
        game.greenOdds.forEach(odd => {
          const key = odd.market;
          if (!globalOddData[key]) {
            globalOddData[key] = {
              count: 0,
              totalOdd: 0,
              odds: []
            };
          }
          globalOddData[key].count += 1;
          globalOddData[key].totalOdd += odd.odd;
          globalOddData[key].odds.push(odd.odd);
        });
      });
    });

    const commonGreenOdds = Object.entries(globalOddData)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([market, data]) => ({
        market,
        frequency: data.count,
        percentage: ((data.count / totalGamesAnalyzed) * 100).toFixed(1),
        avgOdd: (data.totalOdd / data.count).toFixed(2),
        minOdd: Math.min(...data.odds).toFixed(2),
        maxOdd: Math.max(...data.odds).toFixed(2),
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
          <strong>Modo Análise de Entrada:</strong> Selecione células como padrão base e células de entrada para simular probabilidades.
        </p>
        <p className="text-gray-300 mb-3">
          <strong>Modo Jogos Anteriores:</strong> Analisa o que aconteceu antes de cada Over 3.5.
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong>Clique em cada célula</strong> para adicionar/remover</p>
          <p>• Use os botões abaixo para alternar entre PADRÃO e ENTRADA</p>
          <p>• Células PADRÃO (amarelo) servem como base para busca</p>
          <p>• Células ENTRADA (roxo) são onde você simularia a aposta</p>
        </div>

        {/* Seletor de Modo de Seleção */}
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => setSelectionMode('pattern')}
            className={`${
              selectionMode === 'pattern' 
                ? 'bg-yellow-600 hover:bg-yellow-500' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Marcar como PADRÃO
          </Button>
          <Button
            onClick={() => setSelectionMode('entry')}
            className={`${
              selectionMode === 'entry'
                ? 'bg-purple-600 hover:bg-purple-500'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Marcar como ENTRADA
          </Button>
        </div>

        {/* Controles */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-400 mb-1 block">Jogos anteriores (modo Over 3.5):</label>
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
            onClick={analyzeEntryPattern}
            disabled={selectedCells.length === 0 || isAnalyzing}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
          >
            <Target className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analisando...' : 'Analisar Probabilidade de Entrada'}
          </Button>
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
            
            {/* Células PADRÃO */}
            {selectedCells.filter(c => cellTypes[`${c.hour}-${c.minute}`] === 'pattern').length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-yellow-300 font-semibold mb-1">PADRÃO (Base):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCells
                    .filter(c => cellTypes[`${c.hour}-${c.minute}`] === 'pattern')
                    .map((cell, idx) => {
                      const isOver35 = cell.match.totalGolsFT > 3.5;
                      return (
                        <div key={idx} className={`px-2 py-1 rounded text-xs font-semibold ${
                          isOver35 ? 'bg-yellow-600 text-white' : 'bg-yellow-800 text-white'
                        }`}>
                          {cell.hour}:{cell.minute.toString().padStart(2, '0')} - {isOver35 ? 'Over 3.5 ✓' : 'Not Over ✗'}
                        </div>
                      );
                    })}
                </div>
                <p className="text-xs text-yellow-400 mt-1">
                  {selectedCells.filter(c => cellTypes[`${c.hour}-${c.minute}`] === 'pattern')
                    .map(c => c.match.totalGolsFT > 3.5 ? '🟢' : '🔴').join(' ')}
                </p>
              </div>
            )}

            {/* Células ENTRADA */}
            {selectedCells.filter(c => cellTypes[`${c.hour}-${c.minute}`] === 'entry').length > 0 && (
              <div>
                <p className="text-xs text-purple-300 font-semibold mb-1">ENTRADA (Aposta):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCells
                    .filter(c => cellTypes[`${c.hour}-${c.minute}`] === 'entry')
                    .map((cell, idx) => {
                      const isOver35 = cell.match.totalGolsFT > 3.5;
                      return (
                        <div key={idx} className={`px-2 py-1 rounded text-xs font-semibold ${
                          isOver35 ? 'bg-purple-600 text-white' : 'bg-purple-800 text-white'
                        }`}>
                          {cell.hour}:{cell.minute.toString().padStart(2, '0')} - {isOver35 ? 'Over 3.5 ✓' : 'Not Over ✗'}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
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
                  const cellKey = `${hour}-${minute}`;
                  const isSelected = isCellSelected(hour, minute);
                  const cellType = cellTypes[cellKey];
                  const isOver35 = match && match.totalGolsFT > 3.5;
                  const isOver45 = match && match.totalGolsFT > 4.5;

                  return (
                    <div
                      key={cellKey}
                      className={`w-[50px] h-[50px] flex-shrink-0 border-r border-t border-gray-800 cursor-pointer transition-all ${
                        isSelected && cellType === 'pattern' ? 'ring-4 ring-yellow-400 ring-inset' :
                        isSelected && cellType === 'entry' ? 'ring-4 ring-purple-400 ring-inset' :
                        ''
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

      {/* Resultados da Análise de Probabilidade de Entrada */}
      {historicalResults && historicalResults.type === 'entry_pattern' && (
        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Análise de Probabilidade de Entrada</h3>
          </div>

          {/* Grid de Visualização do Padrão */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Padrão Selecionado */}
            <div className="p-4 bg-gray-900/70 rounded-lg border border-yellow-500/30">
              <p className="text-sm font-semibold text-yellow-400 mb-3">Padrão Base (Células PADRÃO)</p>
              <div className="space-y-2">
                {historicalResults.patternCells.map((cell, idx) => (
                  <div key={idx} className={`p-3 rounded ${
                    cell.isOver35 ? 'bg-green-900/40 border border-green-500/50' : 'bg-gray-800/60 border border-gray-700'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">#{idx + 1} - {cell.position}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        cell.isOver35 ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                      }`}>
                        {cell.isOver35 ? 'Over 3.5 ✓' : 'Not Over ✗'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{cell.teams}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-400 mt-3">
                Código do Padrão: <span className="font-mono font-bold">{historicalResults.basePatternString}</span>
                <span className="ml-2 text-gray-500">(1=Over 3.5, 0=Not Over)</span>
              </p>
            </div>

            {/* Estatísticas Gerais */}
            <div className="p-4 bg-gray-900/70 rounded-lg border border-blue-500/30">
              <p className="text-sm font-semibold text-blue-400 mb-3">Estatísticas da Análise</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800/50 rounded">
                  <p className="text-xs text-gray-400">Ocorrências Encontradas</p>
                  <p className="text-2xl font-bold text-white">{historicalResults.totalHistoricalOccurrences}</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded">
                  <p className="text-xs text-gray-400">Qualidade</p>
                  <p className={`text-xl font-bold ${
                    historicalResults.analysisQuality === 'high' ? 'text-green-400' :
                    historicalResults.analysisQuality === 'medium' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {historicalResults.analysisQuality === 'high' ? 'Alta ✓' :
                     historicalResults.analysisQuality === 'medium' ? 'Média ~' :
                     'Baixa ✗'}
                  </p>
                </div>
              </div>
              
              {historicalResults.totalHistoricalOccurrences > 0 && (
                <div className="mt-3 p-3 bg-blue-900/30 rounded border border-blue-500/30">
                  <p className="text-xs text-blue-200">
                    ✓ Dados suficientes para análise confiável
                  </p>
                </div>
              )}
              
              {historicalResults.totalHistoricalOccurrences === 0 && (
                <div className="mt-3 p-3 bg-red-900/30 rounded border border-red-500/30">
                  <p className="text-xs text-red-200">
                    ⚠ Nenhuma ocorrência encontrada. Tente um padrão diferente.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Probabilidades */}
          {historicalResults.totalHistoricalOccurrences > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-br from-green-900/20 to-purple-900/20 border border-green-500/30 rounded-lg">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-green-400" />
                Probabilidades de Acerto (Entrada + Próximos 4 Jogos)
              </h4>
              
              <p className="text-sm text-gray-300 mb-4">
                Quando o padrão <span className="text-yellow-400 font-mono font-bold">{historicalResults.basePatternString}</span> apareceu 
                historicamente, estas foram as probabilidades de Over 3.5:
              </p>

              {/* Grid de Probabilidades */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="border border-gray-700 p-3 text-left text-white">Posição</th>
                      <th className="border border-gray-700 p-3 text-center text-white">Probabilidade Over 3.5</th>
                      <th className="border border-gray-700 p-3 text-center text-white">Acertos</th>
                      <th className="border border-gray-700 p-3 text-center text-white">Probabilidade Over 4.5</th>
                      <th className="border border-gray-700 p-3 text-center text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalResults.probabilities.map((prob, idx) => (
                      <tr key={idx} className={`${
                        idx === 0 ? 'bg-purple-900/50' : idx % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/10'
                      } hover:bg-gray-700/50 transition-colors`}>
                        <td className="border border-gray-700 p-3">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <span className="text-xl">🎯</span>}
                            <span className={`font-semibold ${idx === 0 ? 'text-purple-300' : 'text-white'}`}>
                              {prob.label}
                            </span>
                          </div>
                        </td>
                        <td className="border border-gray-700 p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-2xl font-bold ${
                              prob.over35Probability >= 70 ? 'text-green-400' :
                              prob.over35Probability >= 50 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {prob.over35Probability.toFixed(1)}%
                            </span>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  prob.over35Probability >= 70 ? 'bg-green-500' :
                                  prob.over35Probability >= 50 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{width: `${prob.over35Probability}%`}}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="border border-gray-700 p-3 text-center">
                          <span className="text-white font-mono">{prob.over35Count}/{prob.totalOccurrences}</span>
                        </td>
                        <td className="border border-gray-700 p-3 text-center">
                          <span className={`font-semibold ${
                            prob.over45Probability >= 50 ? 'text-blue-400' : 'text-gray-400'
                          }`}>
                            {prob.over45Probability.toFixed(1)}%
                          </span>
                        </td>
                        <td className="border border-gray-700 p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            prob.over35Probability >= 70 ? 'bg-green-600 text-white' :
                            prob.over35Probability >= 50 ? 'bg-yellow-600 text-white' :
                            'bg-red-600 text-white'
                          }`}>
                            {prob.over35Probability >= 70 ? 'Excelente ✓' :
                             prob.over35Probability >= 50 ? 'Moderado ~' :
                             'Baixo ✗'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recomendação */}
              <div className={`mt-4 p-4 rounded-lg border ${
                historicalResults.probabilities[0]?.over35Probability >= 70 ? 'bg-green-900/30 border-green-500/50' :
                historicalResults.probabilities[0]?.over35Probability >= 50 ? 'bg-yellow-900/30 border-yellow-500/50' :
                'bg-red-900/30 border-red-500/50'
              }`}>
                <p className="text-sm font-bold text-white mb-2">
                  {historicalResults.probabilities[0]?.over35Probability >= 70 ? '✅ RECOMENDAÇÃO: Alta Probabilidade!' :
                   historicalResults.probabilities[0]?.over35Probability >= 50 ? '⚠️ ATENÇÃO: Probabilidade Moderada' :
                   '❌ CUIDADO: Baixa Probabilidade'}
                </p>
                <p className="text-xs text-gray-300">
                  {historicalResults.probabilities[0]?.over35Probability >= 70 && 
                    'Baseado nos dados históricos, este é um excelente ponto de entrada com alta probabilidade de acerto.'
                  }
                  {historicalResults.probabilities[0]?.over35Probability >= 50 && historicalResults.probabilities[0]?.over35Probability < 70 &&
                    'A probabilidade é moderada. Considere outros fatores antes de tomar a decisão de entrada.'
                  }
                  {historicalResults.probabilities[0]?.over35Probability < 50 &&
                    'A probabilidade histórica é baixa. Recomenda-se cautela ou buscar outro padrão com melhores indicadores.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Ocorrências Históricas (Colapsável) */}
          {historicalResults.historicalOccurrences.length > 0 && (
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <button
                onClick={() => {
                  const elem = document.getElementById('historical-occurrences');
                  if (elem) elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                }}
                className="w-full text-left flex items-center justify-between text-white font-semibold hover:text-blue-400 transition-colors"
              >
                <span>Ocorrências Históricas Detalhadas ({historicalResults.historicalOccurrences.length})</span>
                <span>▼</span>
              </button>
              
              <div id="historical-occurrences" style={{display: 'none'}} className="mt-4 space-y-3 max-h-[500px] overflow-y-auto">
                {historicalResults.historicalOccurrences.map((occ, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 mb-3">
                      <span className="text-white font-semibold">Ocorrência #{idx + 1}</span> - Entrada identificada em: 
                      <span className="text-purple-400 font-semibold ml-1">{occ.foundAtPosition}</span>
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                      {occ.next5Games.map((game, gidx) => (
                        <div key={gidx} className={`p-3 rounded text-xs border ${
                          gidx === 0 ? 'bg-purple-900/30 border-purple-500/50 ring-2 ring-purple-400' :
                          game.isOver35 ? 'bg-green-900/30 border-green-500/30' :
                          'bg-gray-900/50 border-gray-700'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-white">
                              {gidx === 0 ? '🎯 Entrada' : `+${gidx}`}
                            </span>
                            <span className={`font-bold ${game.isOver35 ? 'text-green-400' : 'text-red-400'}`}>
                              {game.isOver35 ? '✓' : '✗'}
                            </span>
                          </div>
                          <p className="text-gray-400 font-mono">{game.hour}:{game.minute.toString().padStart(2, '0')}</p>
                          <p className="text-gray-300 truncate text-[10px] mt-1" title={game.teams}>{game.teams}</p>
                          <p className="font-bold text-white mt-1">{game.score}</p>
                          <p className="text-xs text-gray-500">{game.totalGoals} gols</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Resultados da Análise de Jogos Anteriores */}
      {historicalResults && historicalResults.type !== 'entry_pattern' && historicalResults.globalPatterns && (
        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Análise de Jogos Anteriores - Padrões Antes do Over 3.5</h3>
          </div>

          {/* Resumo Geral */}
          <div className="mb-6 p-4 bg-gray-900/70 rounded-lg border border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Células Over 3.5 Analisadas</p>
                <p className="text-2xl font-bold text-white">{historicalResults.selectedOver35Count}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Jogos Anteriores por Célula</p>
                <p className="text-2xl font-bold text-blue-400">{historicalResults.previousGamesToAnalyze}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total de Jogos Analisados</p>
                <p className="text-2xl font-bold text-green-400">{historicalResults.globalPatterns.totalGamesAnalyzed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Qualidade da Análise</p>
                <p className={`text-2xl font-bold ${
                  historicalResults.globalPatterns.analysisQuality === 'high' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {historicalResults.globalPatterns.analysisQuality === 'high' ? 'Alta' : 'Média'}
                </p>
              </div>
            </div>
          </div>

          {/* Padrões Globais */}
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-green-400" />
              Odds Mais Frequentes nos Jogos Anteriores aos Over 3.5
            </h4>
            <p className="text-sm text-gray-300 mb-3">
              Estas odds apareceram com maior frequência antes dos Over 3.5 acontecerem:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {historicalResults.globalPatterns.commonGreenOdds.map((odd, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded p-3 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-400">
                      #{idx + 1} {odd.market.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {odd.frequency}x ({odd.percentage}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-yellow-400 font-bold">Odd Média: {odd.avgOdd}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">Min: {odd.minOdd}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">Max: {odd.maxOdd}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Apareceu em {odd.appearsInCells} de {historicalResults.selectedOver35Count} células analisadas
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Análise Individual de Cada Célula Over 3.5 */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white">Análise Detalhada por Célula Over 3.5</h4>
            
            {historicalResults.cellAnalyses.map((analysis, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                {/* Header da Célula */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                  <div>
                    <h5 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="bg-green-600 text-white px-3 py-1 rounded">
                        {analysis.cellPosition}
                      </span>
                      Over 3.5 ✓
                    </h5>
                    <p className="text-sm text-gray-400 mt-1">{analysis.cellTeams}</p>
                    <p className="text-xs text-gray-500">
                      Placar: {analysis.cellScore} ({analysis.cellTotalGoals} gols)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Jogos Anteriores</p>
                    <p className="text-3xl font-bold text-blue-400">{analysis.previousGamesCount}</p>
                  </div>
                </div>

                {/* Padrões Encontrados */}
                {analysis.patterns && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Estatísticas Gerais */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-xs text-gray-400 mb-2 font-semibold">Estatísticas dos Jogos Anteriores:</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-300">
                          Over 3.5: <span className="text-green-400 font-bold">{analysis.patterns.over35Count}</span> 
                          <span className="text-gray-500"> ({analysis.patterns.over35Percentage}%)</span>
                        </p>
                        <p className="text-gray-300">
                          Over 4.5: <span className="text-blue-400 font-bold">{analysis.patterns.over45Count}</span>
                          <span className="text-gray-500"> ({analysis.patterns.over45Percentage}%)</span>
                        </p>
                        <p className="text-gray-300">
                          Média de Gols: <span className="text-yellow-400 font-bold">{analysis.patterns.avgGoals}</span>
                        </p>
                      </div>
                    </div>

                    {/* Top Odds Green */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-xs text-gray-400 mb-2 font-semibold">Top Odds Green:</p>
                      <div className="space-y-1">
                        {analysis.patterns.topGreenOdds?.slice(0, 3).map((odd, oidx) => (
                          <div key={oidx} className="flex items-center justify-between text-xs">
                            <span className="text-green-400">{odd.market.replace(/_/g, ' ')}</span>
                            <span className="text-gray-500">{odd.frequency}x ({odd.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de Jogos Anteriores */}
                <div>
                  <button
                    onClick={() => {
                      const elem = document.getElementById(`games-${idx}`);
                      elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300 mb-2"
                  >
                    {analysis.previousGamesCount} Jogos Anteriores (clique para expandir) ▼
                  </button>
                  
                  <div id={`games-${idx}`} style={{display: 'none'}} className="space-y-2 max-h-[400px] overflow-y-auto">
                    {analysis.previousGames.map((game, gidx) => (
                      <div key={gidx} className={`p-3 rounded border ${
                        game.isOver35 ? 'bg-green-900/20 border-green-500/30' :
                        'bg-gray-900/30 border-gray-700'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-white">
                              #{gidx + 1} - {game.hour}:{game.minute.toString().padStart(2, '0')}
                            </span>
                            <span className={`ml-2 text-xs px-2 py-1 rounded ${
                              game.isOver35 ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                            }`}>
                              {game.isOver35 ? 'Over 3.5 ✓' : 'Not Over'}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">{game.timeCasa} vs {game.timeFora}</p>
                            <p className="text-sm font-bold text-white">{game.placarFT} ({game.totalGolsFT} gols)</p>
                          </div>
                        </div>

                        {/* Odds Green deste jogo */}
                        {game.greenOdds.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700">
                            <p className="text-xs text-gray-400 mb-1">
                              Odds Green ({game.greenOddsCount}):
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {game.greenOdds.slice(0, 5).map((odd, oidx) => (
                                <span key={oidx} className="text-xs bg-green-600/30 text-green-300 px-2 py-1 rounded">
                                  {odd.market.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {game.greenOdds.length > 5 && (
                                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                  +{game.greenOdds.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
