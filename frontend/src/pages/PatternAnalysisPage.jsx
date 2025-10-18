import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Target, TrendingUp, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockMatches } from '../data/mockData';

const PatternAnalysisPage = () => {
  const navigate = useNavigate();
  const matches = mockMatches;
  
  // Estado da matriz 8x20
  const [matrix, setMatrix] = useState(() => {
    const initialMatrix = {};
    for (let row = 1; row <= 8; row++) {
      for (let col = 1; col <= 20; col++) {
        initialMatrix[`${row}-${col}`] = null;
      }
    }
    return initialMatrix;
  });

  // Células selecionadas temporariamente
  const [selectedCells, setSelectedCells] = useState([]);

  // Configuração atual (para aplicar nas células selecionadas)
  const [currentConfig, setCurrentConfig] = useState({
    markets: [],
    combination: 'AND'
  });

  const [analysisResults, setAnalysisResults] = useState(null);

  // Mercados disponíveis
  const availableMarkets = [
    { value: 'AM', label: 'Ambas Marcam' },
    { value: 'ANM', label: 'Ambas Não Marcam' },
    { value: 'O25', label: 'Over 2.5' },
    { value: 'O35', label: 'Over 3.5' },
    { value: 'U25', label: 'Under 2.5' },
    { value: 'U35', label: 'Under 3.5' }
  ];

  // Clica em célula para selecionar/desselecionar
  const handleCellClick = (row, col) => {
    const key = `${row}-${col}`;
    const isSelected = selectedCells.includes(key);

    if (isSelected) {
      setSelectedCells(selectedCells.filter(k => k !== key));
    } else {
      setSelectedCells([...selectedCells, key]);
    }
  };

  // Marca células selecionadas como Padrão Isolado
  const markAsPattern = () => {
    if (selectedCells.length === 0) {
      alert('Selecione células primeiro!');
      return;
    }

    if (currentConfig.markets.length === 0) {
      alert('Selecione pelo menos um mercado!');
      return;
    }

    const newMatrix = { ...matrix };
    selectedCells.forEach(key => {
      newMatrix[key] = {
        type: 'pattern',
        ...currentConfig
      };
    });

    setMatrix(newMatrix);
    setSelectedCells([]);
  };

  // Marca células selecionadas como Entrada
  const markAsEntry = () => {
    if (selectedCells.length === 0) {
      alert('Selecione células primeiro!');
      return;
    }

    if (currentConfig.markets.length === 0) {
      alert('Selecione pelo menos um mercado!');
      return;
    }

    const newMatrix = { ...matrix };
    selectedCells.forEach(key => {
      newMatrix[key] = {
        type: 'entry',
        ...currentConfig
      };
    });

    setMatrix(newMatrix);
    setSelectedCells([]);
  };

  // Limpa células selecionadas
  const clearSelected = () => {
    const newMatrix = { ...matrix };
    selectedCells.forEach(key => {
      newMatrix[key] = null;
    });

    setMatrix(newMatrix);
    setSelectedCells([]);
  };

  // Limpa tudo
  const clearAll = () => {
    const initialMatrix = {};
    for (let row = 1; row <= 8; row++) {
      for (let col = 1; col <= 20; col++) {
        initialMatrix[`${row}-${col}`] = null;
      }
    }
    setMatrix(initialMatrix);
    setSelectedCells([]);
    setCurrentConfig({ markets: [], combination: 'AND' });
  };

  // Gera texto da célula
  const getCellText = (config) => {
    if (!config) return '';
    const marketText = config.markets.join(config.combination === 'AND' ? ' + ' : ' | ');
    return marketText;
  };

  // Toggle mercado
  const toggleMarket = (marketValue) => {
    if (currentConfig.markets.includes(marketValue)) {
      setCurrentConfig({
        ...currentConfig,
        markets: currentConfig.markets.filter(m => m !== marketValue)
      });
    } else {
      setCurrentConfig({
        ...currentConfig,
        markets: [...currentConfig.markets, marketValue]
      });
    }
  };

  // Executa backtest
  const runBacktest = () => {
    if (!matches || matches.length === 0) {
      alert('Carregue dados primeiro!');
      return;
    }

    const patterns = [];
    const entries = [];

    for (let row = 1; row <= 8; row++) {
      for (let col = 1; col <= 20; col++) {
        const key = `${row}-${col}`;
        const config = matrix[key];
        
        if (config) {
          if (config.type === 'pattern') {
            patterns.push({ row, col, config });
          } else if (config.type === 'entry') {
            entries.push({ row, col, config });
          }
        }
      }
    }

    if (patterns.length === 0) {
      alert('Configure pelo menos um Padrão Isolado!');
      return;
    }

    if (entries.length === 0) {
      alert('Configure pelo menos uma Entrada!');
      return;
    }

    const results = executeBacktest(patterns, entries, matches);
    setAnalysisResults(results);
  };

  // Algoritmo de backtest
  const executeBacktest = (patterns, entries, historicalData) => {
    const sortedMatches = [...historicalData].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    const entryResults = [];

    entries.forEach(entry => {
      const relatedPatterns = patterns.filter(p => 
        p.col === entry.col && p.row < entry.row
      );

      if (relatedPatterns.length === 0) return;

      relatedPatterns.forEach(pattern => {
        const patternOccurrences = [];

        for (let i = 0; i < sortedMatches.length - 5; i++) {
          const match = sortedMatches[i];
          
          if (matchesPattern(match, pattern.config)) {
            const entryMatch = sortedMatches[i + 1];
            const galeMatches = sortedMatches.slice(i + 1, i + 6);
            const evaluation = evaluateEntry(entryMatch, galeMatches, entry.config);
            
            patternOccurrences.push({
              patternMatch: match,
              entryMatch,
              galeMatches,
              evaluation
            });
          }
        }

        const total = patternOccurrences.length;
        const sg = patternOccurrences.filter(o => o.evaluation.sg).length;
        const g1 = patternOccurrences.filter(o => o.evaluation.g1).length;
        const g2 = patternOccurrences.filter(o => o.evaluation.g2).length;
        const g3 = patternOccurrences.filter(o => o.evaluation.g3).length;
        const g4 = patternOccurrences.filter(o => o.evaluation.g4).length;

        entryResults.push({
          entryPosition: `${entry.row}-${entry.col}`,
          entryConfig: entry.config,
          patternPosition: `${pattern.row}-${pattern.col}`,
          patternConfig: pattern.config,
          totalOccurrences: total,
          assertiveness: {
            sg: { count: sg, percentage: total > 0 ? (sg / total) * 100 : 0 },
            g1: { count: g1, percentage: total > 0 ? (g1 / total) * 100 : 0 },
            g2: { count: g2, percentage: total > 0 ? (g2 / total) * 100 : 0 },
            g3: { count: g3, percentage: total > 0 ? (g3 / total) * 100 : 0 },
            g4: { count: g4, percentage: total > 0 ? (g4 / total) * 100 : 0 }
          },
          occurrences: patternOccurrences
        });
      });
    });

    return entryResults;
  };

  const matchesPattern = (match, config) => {
    const results = config.markets.map(marketCode => checkMarket(match, marketCode));
    return config.combination === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const checkMarket = (match, marketCode) => {
    const totalGoals = match.totalGolsFT;
    const placarCasa = match.placarCasaFT;
    const placarFora = match.placarForaFT;

    switch (marketCode) {
      case 'AM': return placarCasa > 0 && placarFora > 0;
      case 'ANM': return placarCasa === 0 || placarFora === 0;
      case 'O25': return totalGoals > 2.5;
      case 'O35': return totalGoals > 3.5;
      case 'U25': return totalGoals < 2.5;
      case 'U35': return totalGoals < 3.5;
      default: return false;
    }
  };

  const evaluateEntry = (entryMatch, galeMatches, config) => {
    const results = { sg: false, g1: false, g2: false, g3: false, g4: false };

    if (entryMatch && matchesPattern(entryMatch, config)) {
      results.sg = results.g1 = results.g2 = results.g3 = results.g4 = true;
      return results;
    }

    if (galeMatches.length > 1 && matchesPattern(galeMatches[1], config)) {
      results.g1 = results.g2 = results.g3 = results.g4 = true;
      return results;
    }

    if (galeMatches.length > 2 && matchesPattern(galeMatches[2], config)) {
      results.g2 = results.g3 = results.g4 = true;
      return results;
    }

    if (galeMatches.length > 3 && matchesPattern(galeMatches[3], config)) {
      results.g3 = results.g4 = true;
      return results;
    }

    if (galeMatches.length > 4 && matchesPattern(galeMatches[4], config)) {
      results.g4 = true;
    }

    return results;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="mb-4 bg-gray-800 border-gray-700 hover:bg-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Target className="w-8 h-8 text-purple-400" />
              Análise de Padrões
            </h1>
            <p className="text-gray-400 mt-1">
              Selecione células, configure mercados e execute backtest com progressões
            </p>
          </div>
          
          <Button
            onClick={runBacktest}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
          >
            <Search className="w-4 h-4 mr-2" />
            Executar Backtest
          </Button>
        </div>
      </div>

      {/* Painel de Configuração */}
      <Card className="bg-gray-900/50 border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Configuração de Mercados</h3>
        
        <div className="space-y-4">
          {/* Seleção de Mercados */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Selecione Mercados (múltipla seleção):
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {availableMarkets.map(market => (
                <label
                  key={market.value}
                  className={`flex items-center gap-2 p-3 rounded cursor-pointer transition-colors ${
                    currentConfig.markets.includes(market.value)
                      ? 'bg-purple-600 border-2 border-purple-400'
                      : 'bg-gray-800 border-2 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={currentConfig.markets.includes(market.value)}
                    onChange={() => toggleMarket(market.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm font-semibold">{market.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Combinação Lógica */}
          {currentConfig.markets.length > 1 && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Combinação Lógica:</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentConfig({ ...currentConfig, combination: 'AND' })}
                  className={`${
                    currentConfig.combination === 'AND'
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  E (todos os mercados)
                </Button>
                <Button
                  onClick={() => setCurrentConfig({ ...currentConfig, combination: 'OR' })}
                  className={`${
                    currentConfig.combination === 'OR'
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  OU (qualquer mercado)
                </Button>
              </div>
            </div>
          )}

          {/* Indicador de seleção */}
          {selectedCells.length > 0 && (
            <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded">
              <p className="text-white font-semibold mb-2">
                {selectedCells.length} célula(s) selecionada(s)
              </p>
              <p className="text-sm text-blue-200">
                Posições: {selectedCells.join(', ')}
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={markAsPattern}
              disabled={selectedCells.length === 0}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold"
            >
              🟨 Marcar como Padrão Isolado
            </Button>
            <Button
              onClick={markAsEntry}
              disabled={selectedCells.length === 0}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold"
            >
              🟩 Marcar como Entrada
            </Button>
            <Button
              onClick={clearSelected}
              disabled={selectedCells.length === 0}
              variant="outline"
              className="bg-red-900/20 hover:bg-red-900/40 border-red-500/30"
            >
              Limpar Selecionadas
            </Button>
            <Button
              onClick={clearAll}
              variant="outline"
              className="bg-gray-700 hover:bg-gray-600 border-gray-600"
            >
              Limpar Tudo
            </Button>
          </div>
        </div>
      </Card>

      {/* Matriz 8x20 */}
      <Card className="bg-gray-900/50 border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Matriz de Padrões (8 × 20)</h3>
        
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Header com números das colunas */}
            <div className="flex">
              <div className="w-[60px] h-[50px] flex-shrink-0 border-r border-gray-800 bg-gray-950 flex items-center justify-center text-xs font-semibold text-gray-400">
                #
              </div>
              {[...Array(20)].map((_, idx) => (
                <div
                  key={idx}
                  className="w-[70px] h-[50px] flex-shrink-0 border-r border-gray-800 bg-gray-950 flex items-center justify-center text-sm text-gray-400 font-medium"
                >
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Linhas da matriz */}
            {[...Array(8)].map((_, rowIdx) => {
              const row = rowIdx + 1;
              return (
                <div key={row} className="flex">
                  {/* Número da linha */}
                  <div className="w-[60px] h-[60px] flex-shrink-0 border-r border-t border-gray-800 bg-gray-950 flex items-center justify-center text-sm font-semibold text-gray-300">
                    {row}
                  </div>
                  
                  {/* Células da linha */}
                  {[...Array(20)].map((_, colIdx) => {
                    const col = colIdx + 1;
                    const key = `${row}-${col}`;
                    const config = matrix[key];
                    const cellText = getCellText(config);
                    
                    return (
                      <div
                        key={col}
                        onClick={() => handleCellClick(row, col)}
                        className={`w-[70px] h-[60px] flex-shrink-0 border-r border-t border-gray-800 cursor-pointer transition-all flex items-center justify-center p-1 ${
                          config?.type === 'pattern' ? 'bg-yellow-600/40 hover:bg-yellow-600/60 border-yellow-500/50' :
                          config?.type === 'entry' ? 'bg-green-600/40 hover:bg-green-600/60 border-green-500/50' :
                          'bg-gray-800/30 hover:bg-gray-700/50'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-white text-center leading-tight">
                          {cellText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-600/40 border-2 border-yellow-500/50 rounded"></div>
            <span className="text-gray-300">Padrão Isolado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600/40 border-2 border-green-500/50 rounded"></div>
            <span className="text-gray-300">Entrada</span>
          </div>
        </div>
      </Card>

      {/* Modal de Configuração */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="bg-gray-900 border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Configurar Célula {selectedCell?.row}-{selectedCell?.col}
              </h3>
              <Button
                onClick={() => setShowConfigModal(false)}
                variant="outline"
                className="bg-gray-800 border-gray-700"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              {/* Tipo de Marcação */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Tipo de Marcação:</label>
                <select
                  value={cellConfig.type}
                  onChange={(e) => setCellConfig({ ...cellConfig, type: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="pattern">🟨 Padrão Isolado</option>
                  <option value="entry">🟩 Entrada</option>
                </select>
              </div>

              {/* Mercados */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Mercados:</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableMarkets.map(market => (
                    <label key={market.value} className="flex items-center gap-2 bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={cellConfig.markets.includes(market.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCellConfig({ ...cellConfig, markets: [...cellConfig.markets, market.value] });
                          } else {
                            setCellConfig({ ...cellConfig, markets: cellConfig.markets.filter(m => m !== market.value) });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-white text-sm">{market.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Combinação Lógica */}
              {cellConfig.markets.length > 1 && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Combinação Lógica:</label>
                  <select
                    value={cellConfig.combination}
                    onChange={(e) => setCellConfig({ ...cellConfig, combination: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    <option value="AND">E (todos os mercados)</option>
                    <option value="OR">OU (qualquer mercado)</option>
                  </select>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={saveCellConfig}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                >
                  Salvar Configuração
                </Button>
                <Button
                  onClick={clearCell}
                  variant="outline"
                  className="bg-red-900/20 hover:bg-red-900/40 border-red-500/30"
                >
                  Limpar Célula
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Resultados do Backtest */}
      {analysisResults && analysisResults.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800 p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Resultados do Backtest
          </h3>

          <div className="space-y-4">
            {analysisResults.map((result, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">
                      Entrada: Célula {result.entryPosition} - {getCellText(result.entryConfig)}
                    </p>
                    <p className="text-sm text-gray-400">
                      Padrão: Célula {result.patternPosition} - {getCellText(result.patternConfig)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-400">{result.totalOccurrences}</p>
                    <p className="text-xs text-gray-400">Ocorrências</p>
                  </div>
                </div>

                {/* Tabela de Assertividade */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-900">
                        <th className="border border-gray-700 p-2 text-left text-white text-sm">Tipo</th>
                        <th className="border border-gray-700 p-2 text-center text-white text-sm">Acertos</th>
                        <th className="border border-gray-700 p-2 text-center text-white text-sm">Assertividade</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-700 p-2 text-white font-semibold">SG (Sem Gale)</td>
                        <td className="border border-gray-700 p-2 text-center text-white">{result.assertiveness.sg.count}/{result.totalOccurrences}</td>
                        <td className="border border-gray-700 p-2 text-center">
                          <span className={`font-bold ${
                            result.assertiveness.sg.percentage >= 70 ? 'text-green-400' :
                            result.assertiveness.sg.percentage >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {result.assertiveness.sg.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-700 p-2 text-white">G1</td>
                        <td className="border border-gray-700 p-2 text-center text-white">{result.assertiveness.g1.count}/{result.totalOccurrences}</td>
                        <td className="border border-gray-700 p-2 text-center">
                          <span className={`font-bold ${
                            result.assertiveness.g1.percentage >= 70 ? 'text-green-400' :
                            result.assertiveness.g1.percentage >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {result.assertiveness.g1.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-700 p-2 text-white">G2</td>
                        <td className="border border-gray-700 p-2 text-center text-white">{result.assertiveness.g2.count}/{result.totalOccurrences}</td>
                        <td className="border border-gray-700 p-2 text-center">
                          <span className={`font-bold ${
                            result.assertiveness.g2.percentage >= 70 ? 'text-green-400' :
                            result.assertiveness.g2.percentage >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {result.assertiveness.g2.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-700 p-2 text-white">G3</td>
                        <td className="border border-gray-700 p-2 text-center text-white">{result.assertiveness.g3.count}/{result.totalOccurrences}</td>
                        <td className="border border-gray-700 p-2 text-center">
                          <span className={`font-bold ${
                            result.assertiveness.g3.percentage >= 70 ? 'text-green-400' :
                            result.assertiveness.g3.percentage >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {result.assertiveness.g3.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-700 p-2 text-white">G4</td>
                        <td className="border border-gray-700 p-2 text-center text-white">{result.assertiveness.g4.count}/{result.totalOccurrences}</td>
                        <td className="border border-gray-700 p-2 text-center">
                          <span className={`font-bold ${
                            result.assertiveness.g4.percentage >= 70 ? 'text-green-400' :
                            result.assertiveness.g4.percentage >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {result.assertiveness.g4.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PatternAnalysisPage;
