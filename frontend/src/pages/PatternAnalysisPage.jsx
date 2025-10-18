import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Target, TrendingUp, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMatches } from '../contexts/MatchesContext';

const PatternAnalysisPage = () => {
  const navigate = useNavigate();
  const { matches } = useMatches();
  
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

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
      console.log(`✅ Marcado como PADRÃO: ${key}`, newMatrix[key]);
    });

    setMatrix(newMatrix);
    setSelectedCells([]);
    console.log('📊 Matriz atualizada:', newMatrix);
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
      console.log(`✅ Marcado como ENTRADA: ${key}`, newMatrix[key]);
    });

    setMatrix(newMatrix);
    setSelectedCells([]);
    console.log('📊 Matriz atualizada:', newMatrix);
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
  const runBacktest = async () => {
    console.log('=== INICIANDO BACKTEST ===');
    console.log('Total de partidas:', matches?.length);
    console.log('📊 Estado da matriz:', matrix);
    
    if (!matches || matches.length === 0) {
      alert('Carregue dados primeiro! Não há partidas disponíveis.');
      return;
    }

    const patterns = [];
    const entries = [];

    for (let row = 1; row <= 8; row++) {
      for (let col = 1; col <= 20; col++) {
        const key = `${row}-${col}`;
        const config = matrix[key];
        
        if (config) {
          console.log(`🔍 Célula ${key}:`, config);
          if (config.type === 'pattern') {
            patterns.push({ row, col, config });
          } else if (config.type === 'entry') {
            entries.push({ row, col, config });
          }
        }
      }
    }

    console.log('Padrões encontrados:', patterns.length);
    console.log('Entradas encontradas:', entries.length);
    console.log('Padrões:', patterns);
    console.log('Entradas:', entries);

    if (patterns.length === 0) {
      alert('Configure pelo menos um Padrão Isolado! Selecione células, escolha mercados e clique em "🟨 Marcar como Padrão Isolado"');
      return;
    }

    if (entries.length === 0) {
      alert('Configure pelo menos uma Entrada! Selecione células, escolha mercados e clique em "🟩 Marcar como Entrada"');
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    // Simula progresso durante análise com intervalo mais lento
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 5; // Incrementa de 5 em 5
      });
    }, 300); // A cada 300ms

    // Pequeno delay para garantir que o estado seja atualizado
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log('Executando backtest...');
      const results = executeBacktest(patterns, entries, matches);
      console.log('Resultados do backtest:', results);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Aguarda um pouco para mostrar 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!results || results.length === 0) {
        setIsAnalyzing(false);
        setProgress(0);
        alert('Nenhum resultado encontrado! Verifique se há dados suficientes e se as entradas estão relacionadas aos padrões (mesma coluna, entrada abaixo do padrão na timeline).');
        return;
      }
      
      setAnalysisResults(results);
      setIsAnalyzing(false);
      setProgress(0);
      
      // Scroll para resultados
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 300);
    } catch (error) {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setProgress(0);
      console.error('Erro no backtest:', error);
      alert('Erro ao executar backtest. Verifique o console para detalhes.');
    }
  };

  // Algoritmo de backtest
  const executeBacktest = (patterns, entries, historicalData) => {
    console.log('=== EXECUTE BACKTEST ===');
    console.log('Padrões:', patterns);
    console.log('Entradas:', entries);
    console.log('Dados históricos:', historicalData.length, 'partidas');
    
    const sortedMatches = [...historicalData].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    console.log('Partidas ordenadas:', sortedMatches.length);

    const entryResults = [];

    entries.forEach((entry, entryIdx) => {
      console.log(`\n=== Processando Entrada ${entryIdx + 1} ===`);
      console.log('Entrada:', entry);
      
      const relatedPatterns = patterns.filter(p => 
        p.col === entry.col && p.row > entry.row // Padrão em linha MAIOR (acima), Entrada em linha MENOR (abaixo)
      );

      if (relatedPatterns.length === 0) {
        console.log(`⚠️ Entrada ${entry.row}-${entry.col} não tem padrão relacionado na mesma coluna e linha acima`);
        continue; // Pula esta entrada se não houver padrão relacionado
      }

      console.log('Padrões relacionados:', relatedPatterns.length);

      if (relatedPatterns.length === 0) {
        console.log('⚠️ Nenhum padrão relacionado (mesma coluna, linha acima)');
        return;
      }

      relatedPatterns.forEach((pattern, patternIdx) => {
        console.log(`\n--- Padrão ${patternIdx + 1} para Entrada ${entryIdx + 1} ---`);
        const patternOccurrences = [];
        const greenOdds = []; // Odds dos jogos GREEN (que bateram)
        const redOdds = []; // Odds dos jogos RED (que falharam)
        const greenScores = []; // Placares dos jogos GREEN
        const redScores = []; // Placares dos jogos RED

        for (let i = 0; i < sortedMatches.length - 5; i++) {
          const match = sortedMatches[i];
          
          if (matchesPattern(match, pattern.config)) {
            // Com a matriz invertida (8→1), o jogo de entrada vem DEPOIS na timeline
            const entryMatch = sortedMatches[i + 1];
            const galeMatches = sortedMatches.slice(i + 1, i + 6);
            const evaluation = evaluateEntry(entryMatch, galeMatches, entry.config);
            
            // Coleta TODAS as odds disponíveis no jogo de entrada
            if (entryMatch && entryMatch.markets) {
              const allOdds = [];
              
              // Itera por TODOS os mercados disponíveis no jogo
              Object.entries(entryMatch.markets).forEach(([marketKey, oddValue]) => {
                // Debug: log de valores inválidos
                if (!oddValue || typeof oddValue !== 'number' || isNaN(oddValue) || oddValue <= 0) {
                  console.log(`⚠️ Odd inválida ignorada: ${marketKey} = ${oddValue}`);
                  return; // Ignora essa odd
                }
                
                // Converte chave do mercado para nome legível
                const marketLabel = getMarketLabelFromKey(marketKey);
                if (marketLabel) {
                  allOdds.push({
                    market: marketLabel,
                    marketKey,
                    odd: oddValue
                  });
                } else {
                  console.log(`⚠️ Mercado sem label ignorado: ${marketKey}`);
                }
              });
              
              // Separa entre GREEN e RED baseado no resultado
              const isGreen = evaluation.level !== 'F';
              if (isGreen) {
                greenOdds.push(...allOdds.map(o => ({ ...o, level: evaluation.level })));
                greenScores.push({
                  score: `${entryMatch.placarCasaFT}x${entryMatch.placarForaFT}`,
                  totalGoals: entryMatch.totalGolsFT,
                  teams: `${entryMatch.timeCasa} x ${entryMatch.timeFora}`,
                  level: evaluation.level
                });
              } else {
                redOdds.push(...allOdds.map(o => ({ ...o, level: 'F' })));
                redScores.push({
                  score: `${entryMatch.placarCasaFT}x${entryMatch.placarForaFT}`,
                  totalGoals: entryMatch.totalGolsFT,
                  teams: `${entryMatch.timeCasa} x ${entryMatch.timeFora}`,
                  level: 'F'
                });
              }
            }
            
            patternOccurrences.push({
              patternMatch: match,
              entryMatch,
              galeMatches,
              evaluation
            });
          }
        }

        console.log('Ocorrências do padrão:', patternOccurrences.length);

        const total = patternOccurrences.length;
        const sg = patternOccurrences.filter(o => o.evaluation.level === 'SG').length;
        const g1 = patternOccurrences.filter(o => o.evaluation.level === 'G1').length;
        const g2 = patternOccurrences.filter(o => o.evaluation.level === 'G2').length;
        const g3 = patternOccurrences.filter(o => o.evaluation.level === 'G3').length;
        const g4 = patternOccurrences.filter(o => o.evaluation.level === 'G4').length;
        const failures = patternOccurrences.filter(o => o.evaluation.level === 'F').length;

        // Calcula assertividade total
        const totalSuccess = sg + g1 + g2 + g3 + g4;
        const totalSuccessPercentage = total > 0 ? (totalSuccess / total) * 100 : 0;

        console.log('Assertividade - SG:', sg, 'G1:', g1, 'G2:', g2, 'G3:', g3, 'G4:', g4, 'F:', failures);
        console.log('Odds GREEN coletadas:', greenOdds.length);
        console.log('Odds RED coletadas:', redOdds.length);

        // Análise separada para GREEN e RED
        const greenAnalysis = {
          odds: analyzeOdds(greenOdds),
          scores: analyzeScores(greenScores),
          count: totalSuccess,
          percentage: totalSuccessPercentage
        };
        
        const redAnalysis = {
          odds: analyzeOdds(redOdds),
          scores: analyzeScores(redScores),
          count: failures,
          percentage: total > 0 ? (failures / total) * 100 : 0
        };

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
            g4: { count: g4, percentage: total > 0 ? (g4 / total) * 100 : 0 },
            failures: { count: failures, percentage: total > 0 ? (failures / total) * 100 : 0 },
            total: { count: totalSuccess, percentage: totalSuccessPercentage }
          },
          greenAnalysis, // Análise dos jogos GREEN
          redAnalysis, // Análise dos jogos RED
          occurrences: patternOccurrences
        });
      });
    });

    console.log('\n=== RESULTADOS FINAIS ===');
    console.log('Total de análises:', entryResults.length);
    console.log('Resultados:', entryResults);

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

  const getOddKeyForMarket = (marketCode) => {
    const mapping = {
      'AM': 'ParaOTimeMarcarSimNao_AmbasMarcam',
      'O25': 'TotalGols_MaisDe_25',
      'O35': 'TotalGols_MaisDe_35',
      'O45': 'TotalGols_MaisDe_45'
    };
    return mapping[marketCode] || null;
  };

  const getMarketLabel = (marketCode) => {
    const labels = {
      'AM': 'Ambas Marcam',
      'ANM': 'Ambas Não Marcam',
      'O25': 'Over 2.5',
      'O35': 'Over 3.5',
      'U25': 'Under 2.5',
      'U35': 'Under 3.5',
      'O45': 'Over 4.5'
    };
    return labels[marketCode] || marketCode;
  };

  const getMarketLabelFromKey = (marketKey) => {
    // Mapeamento completo de TODOS os mercados disponíveis
    const mapping = {
      // Total de Gols
      'TotalGols_MaisDe_05': 'Over 0.5',
      'TotalGols_MaisDe_15': 'Over 1.5',
      'TotalGols_MaisDe_25': 'Over 2.5',
      'TotalGols_MaisDe_35': 'Over 3.5',
      'TotalGols_MaisDe_45': 'Over 4.5',
      'TotalGols_MenosDe_05': 'Under 0.5',
      'TotalGols_MenosDe_15': 'Under 1.5',
      'TotalGols_MenosDe_25': 'Under 2.5',
      'TotalGols_MenosDe_35': 'Under 3.5',
      'TotalGols_MenosDe_45': 'Under 4.5',
      'TOTAL_GOLS_HT': 'Total Gols HT',
      
      // Resultado Final
      'VencedorFT_Casa': 'Vitória Casa',
      'VencedorFT_Visitante': 'Vitória Visitante',
      'VencedorFT_Empate': 'Empate',
      
      // Dupla Chance
      'DuplaHipotese_CasaOuEmpate': 'Dupla Chance 1X',
      'DuplaHipotese_CasaOuVisitante': 'Dupla Chance 12',
      'DuplaHipotese_EmpateOuVisitante': 'Dupla Chance X2',
      
      // Ambas Marcam
      'ParaOTimeMarcarSimNao_AmbasMarcam': 'Ambas Marcam',
      'ParaOTimeMarcarSimNao_AmbasNaoMarcam': 'Ambas Não Marcam',
      'ParaOTimeMarcarSimNao_CasaSim': 'Casa Marca',
      'ParaOTimeMarcarSimNao_CasaNao': 'Casa Não Marca',
      'ParaOTimeMarcarSimNao_VisitanteSim': 'Visitante Marca',
      'ParaOTimeMarcarSimNao_VisitanteNao': 'Visitante Não Marca',
      
      // Resultado Correto
      'ResultadoCorreto_Casa_1x0': 'Placar Exato 1x0',
      'ResultadoCorreto_Casa_2x0': 'Placar Exato 2x0',
      'ResultadoCorreto_Casa_2x1': 'Placar Exato 2x1',
      'ResultadoCorreto_Casa_3x0': 'Placar Exato 3x0',
      'ResultadoCorreto_Casa_3x1': 'Placar Exato 3x1',
      'ResultadoCorreto_Casa_3x2': 'Placar Exato 3x2',
      'ResultadoCorreto_Casa_4x0': 'Placar Exato 4x0',
      'ResultadoCorreto_Casa_QualquerOutro': 'Placar Casa Outro',
      'ResultadoCorreto_Visitante_1x0': 'Placar Exato 0x1',
      'ResultadoCorreto_Visitante_2x0': 'Placar Exato 0x2',
      'ResultadoCorreto_Visitante_2x1': 'Placar Exato 1x2',
      'ResultadoCorreto_Visitante_3x0': 'Placar Exato 0x3',
      'ResultadoCorreto_Visitante_3x1': 'Placar Exato 1x3',
      'ResultadoCorreto_Visitante_3x2': 'Placar Exato 2x3',
      'ResultadoCorreto_Visitante_4x0': 'Placar Exato 0x4',
      'ResultadoCorreto_Visitante_QualquerOutro': 'Placar Visitante Outro',
      'ResultadoCorreto_Empate_0x0': 'Placar Exato 0x0',
      'ResultadoCorreto_Empate_1x1': 'Placar Exato 1x1',
      'ResultadoCorreto_Empate_2x2': 'Placar Exato 2x2',
      'ResultadoCorreto_Empate_QualquerOutro': 'Placar Empate Outro',
      
      // Resultado Correto Grupo
      'ResultadoCorretoGrupo_Casa_1x0_2x0_2x1': 'Grupo Casa 1x0/2x0/2x1',
      'ResultadoCorretoGrupo_Casa_3x0_3x1_4x0': 'Grupo Casa 3x0/3x1/4x0',
      'ResultadoCorretoGrupo_Casa_QualquerOutro': 'Grupo Casa Outro',
      'ResultadoCorretoGrupo_Visitante_1x0_2x0_2x1': 'Grupo Visitante 0x1/0x2/1x2',
      'ResultadoCorretoGrupo_Visitante_3x0_3x1_4x0': 'Grupo Visitante 0x3/1x3/0x4',
      'ResultadoCorretoGrupo_Visitante_QualquerOutro': 'Grupo Visitante Outro',
      'ResultadoCorretoGrupo_Empate_0x0': 'Grupo Empate 0x0',
      'ResultadoCorretoGrupo_Empate_1x1_2x2': 'Grupo Empate 1x1/2x2',
      'ResultadoCorretoGrupo_Empate_3x3_4x4': 'Grupo Empate 3x3/4x4',
      
      // HT/FT
      'IntervaloFinalJogo_CasaCasa': 'HT/FT Casa/Casa',
      'IntervaloFinalJogo_CasaEmpate': 'HT/FT Casa/Empate',
      'IntervaloFinalJogo_CasaVisitante': 'HT/FT Casa/Visitante',
      'IntervaloFinalJogo_EmpateCasa': 'HT/FT Empate/Casa',
      'IntervaloFinalJogo_EmpateEmpate': 'HT/FT Empate/Empate',
      'IntervaloFinalJogo_EmpateVisitante': 'HT/FT Empate/Visitante',
      'IntervaloFinalJogo_VisitanteCasa': 'HT/FT Visitante/Casa',
      'IntervaloFinalJogo_VisitanteEmpate': 'HT/FT Visitante/Empate',
      'IntervaloFinalJogo_VisitanteVisitante': 'HT/FT Visitante/Visitante',
      
      // Gols Exatos
      'GolsExatos_0': '0 Gols',
      'GolsExatos_1': '1 Gol',
      'GolsExatos_2': '2 Gols',
      'GolsExatos_3': '3 Gols',
      'GolsExatos_4': '4 Gols',
      'GolsExatos_5_Mais': '5+ Gols',
      
      // Margem Vitória
      'MargemVitoriaGols_Casa1': 'Casa Vence por 1',
      'MargemVitoriaGols_Casa2': 'Casa Vence por 2',
      'MargemVitoriaGols_Casa3Mais': 'Casa Vence por 3+',
      'MargemVitoriaGols_Visitante1': 'Visitante Vence por 1',
      'MargemVitoriaGols_Visitante2': 'Visitante Vence por 2',
      'MargemVitoriaGols_Visitante3Mais': 'Visitante Vence por 3+',
      'MargemVitoriaGols_EmpateComGols': 'Empate com Gols',
      'MargemVitoriaGols_SemGols': 'Empate 0x0',
      
      // Time Gols
      'TimeGols_Casa0': 'Casa 0 Gols',
      'TimeGols_Casa1': 'Casa 1 Gol',
      'TimeGols_Casa2': 'Casa 2 Gols',
      'TimeGols_Casa3': 'Casa 3 Gols',
      'TimeGols_Casa4': 'Casa 4 Gols',
      'TimeGols_Casa5mais': 'Casa 5+ Gols',
      'TimeGols_Visitante0': 'Visitante 0 Gols',
      'TimeGols_Visitante1': 'Visitante 1 Gol',
      'TimeGols_Visitante2': 'Visitante 2 Gols',
      'TimeGols_Visitante3': 'Visitante 3 Gols',
      'TimeGols_Visitante4': 'Visitante 4 Gols',
      'TimeGols_Visitante5mais': 'Visitante 5+ Gols',
      
      // Primeiro/Último Gol
      'TimeAMarcarPrimeiro_Casa': 'Primeiro Gol Casa',
      'TimeAMarcarPrimeiro_Visitante': 'Primeiro Gol Visitante',
      'TimeAMarcarPrimeiro_Nenhum': 'Sem Gols',
      'TimeAMarcarPorUltimo_Casa': 'Último Gol Casa',
      'TimeAMarcarPorUltimo_Visitante': 'Último Gol Visitante',
      'TimeAMarcarPorUltimo_Nenhum': 'Último Sem Gols',
      
      // Intervalo
      'IntervaloVencedor_Casa': 'Casa Vence HT',
      'IntervaloVencedor_Visitante': 'Visitante Vence HT',
      'IntervaloVencedor_Empate': 'Empate HT',
      'IntervaloResultadoCorreto_Casa_1x0': 'HT 1x0',
      'IntervaloResultadoCorreto_Casa_2x0': 'HT 2x0',
      'IntervaloResultadoCorreto_Visitante_1x0': 'HT 0x1',
      'IntervaloResultadoCorreto_Visitante_2x0': 'HT 0x2',
      'IntervaloResultadoCorreto_Empate_0x0': 'HT 0x0',
      'IntervaloResultadoCorreto_Empate_1x1': 'HT 1x1',
      'IntervaloResultadoCorreto_Outros': 'HT Outros',
      
      // Handicap
      'HandicapAsiatico_Casa': 'Handicap Asiático Casa',
      'HandicapAsiatico_Visitante': 'Handicap Asiático Visitante',
      'HandicapResultado_Casa_Mais10': 'Handicap Casa +1',
      'HandicapResultado_Casa_Mais20': 'Handicap Casa +2',
      'HandicapResultado_Casa_Menos10': 'Handicap Casa -1',
      'HandicapResultado_Casa_Menos20': 'Handicap Casa -2',
      'HandicapResultado_Visitante_Mais10': 'Handicap Visitante +1',
      'HandicapResultado_Visitante_Mais20': 'Handicap Visitante +2',
      'HandicapResultado_Visitante_Menos10': 'Handicap Visitante -1',
      'HandicapResultado_Visitante_Menos20': 'Handicap Visitante -2',
      'HandicapResultado_Empate_Mais10': 'Handicap Empate +1',
      'HandicapResultado_Empate_Mais20': 'Handicap Empate +2',
      'HandicapResultado_Empate_Menos10': 'Handicap Empate -1',
      'HandicapResultado_Empate_Menos20': 'Handicap Empate -2',
      
      // Resultado + Ambas Marcam
      'ResultadoParaAmbosMarcarem_CasaSim': 'Casa + Ambas Marcam',
      'ResultadoParaAmbosMarcarem_CasaNao': 'Casa + Ambas Não',
      'ResultadoParaAmbosMarcarem_VisitanteSim': 'Visitante + Ambas Marcam',
      'ResultadoParaAmbosMarcarem_VisitanteNao': 'Visitante + Ambas Não',
      'ResultadoParaAmbosMarcarem_EmpateSim': 'Empate + Ambas Marcam',
      'ResultadoParaAmbosMarcarem_EmpateNao': 'Empate + Ambas Não'
    };
    
    // Retorna label se existir no mapping, caso contrário retorna null
    return mapping[marketKey] || null;
  };

  const analyzeOdds = (oddsData) => {
    if (oddsData.length === 0) return { mostCommon: [], avgByLevel: {} };
    
    // Filtra odds inválidas antes de processar
    const validOdds = oddsData.filter(({ odd }) => 
      odd && typeof odd === 'number' && !isNaN(odd) && odd > 0
    );
    
    if (validOdds.length === 0) return { mostCommon: [], avgByLevel: {} };
    
    // Conta frequência de cada combinação mercado+odd
    const oddFrequency = {};
    validOdds.forEach(({ market, odd, level }) => {
      const roundedOdd = Math.round(odd * 10) / 10; // Arredonda para 1 decimal
      const key = `${market}-${roundedOdd}`;
      if (!oddFrequency[key]) {
        oddFrequency[key] = { market, odd: roundedOdd, count: 0, levels: {} };
      }
      oddFrequency[key].count++;
      oddFrequency[key].levels[level] = (oddFrequency[key].levels[level] || 0) + 1;
    });
    
    // Ordena por frequência
    const sorted = Object.values(oddFrequency).sort((a, b) => b.count - a.count);
    
    // Calcula média por nível
    const avgByLevel = {};
    validOdds.forEach(({ odd, level }) => {
      if (!avgByLevel[level]) avgByLevel[level] = { sum: 0, count: 0 };
      avgByLevel[level].sum += odd;
      avgByLevel[level].count++;
    });
    
    Object.keys(avgByLevel).forEach(level => {
      avgByLevel[level] = avgByLevel[level].sum / avgByLevel[level].count;
    });
    
    return {
      mostCommon: sorted.slice(0, 10), // Top 10 odds mais comuns
      avgByLevel
    };
  };

  const analyzeScores = (scoresData) => {
    if (scoresData.length === 0) return { mostCommon: [], avgGoalsByLevel: {} };
    
    // Conta frequência de cada placar
    const scoreFrequency = {};
    scoresData.forEach(({ score, level }) => {
      if (!scoreFrequency[score]) {
        scoreFrequency[score] = { score, count: 0, levels: {} };
      }
      scoreFrequency[score].count++;
      scoreFrequency[score].levels[level] = (scoreFrequency[score].levels[level] || 0) + 1;
    });
    
    // Ordena por frequência
    const sorted = Object.values(scoreFrequency).sort((a, b) => b.count - a.count);
    
    // Calcula média de gols por nível
    const avgGoalsByLevel = {};
    scoresData.forEach(({ totalGoals, level }) => {
      if (!avgGoalsByLevel[level]) avgGoalsByLevel[level] = { sum: 0, count: 0 };
      avgGoalsByLevel[level].sum += totalGoals;
      avgGoalsByLevel[level].count++;
    });
    
    Object.keys(avgGoalsByLevel).forEach(level => {
      avgGoalsByLevel[level] = avgGoalsByLevel[level].sum / avgGoalsByLevel[level].count;
    });
    
    return {
      mostCommon: sorted.slice(0, 10), // Top 10 placares mais comuns
      avgGoalsByLevel
    };
  };

  const evaluateEntry = (entryMatch, galeMatches, config) => {
    const results = { 
      sg: false, 
      g1: false, 
      g2: false, 
      g3: false, 
      g4: false,
      level: null // Qual nível bateu: 'SG', 'G1', 'G2', 'G3', 'G4', ou null (falha)
    };

    // Verifica jogo de entrada (SG)
    if (entryMatch && matchesPattern(entryMatch, config)) {
      results.sg = true;
      results.level = 'SG';
      return results;
    }

    // Verifica Gale 1
    if (galeMatches.length > 1 && matchesPattern(galeMatches[1], config)) {
      results.g1 = true;
      results.level = 'G1';
      return results;
    }

    // Verifica Gale 2
    if (galeMatches.length > 2 && matchesPattern(galeMatches[2], config)) {
      results.g2 = true;
      results.level = 'G2';
      return results;
    }

    // Verifica Gale 3
    if (galeMatches.length > 3 && matchesPattern(galeMatches[3], config)) {
      results.g3 = true;
      results.level = 'G3';
      return results;
    }

    // Verifica Gale 4
    if (galeMatches.length > 4 && matchesPattern(galeMatches[4], config)) {
      results.g4 = true;
      results.level = 'G4';
      return results;
    }

    // Nenhum bateu = Falha
    results.level = 'F';
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
            disabled={isAnalyzing}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allow"
          >
            <Search className="w-4 h-4 mr-2" />
            {isAnalyzing ? `Analisando... ${progress}%` : 'Executar Backtest'}
          </Button>
        </div>
        
        {/* Barra de Progresso */}
        {isAnalyzing && (
          <div className="mt-4 p-4 bg-purple-900/30 border border-purple-500/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-200 font-semibold">⏳ Executando análise...</span>
              <span className="text-sm text-purple-300">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Analisando padrões históricos e calculando probabilidades...</p>
          </div>
        )}
      </div>

      {/* Painel de Configuração */}
      <Card className="bg-gray-900/50 border-gray-800 p-6 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Configuração de Mercados</h3>
        
        {/* Helper Text */}
        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
          <p className="text-sm text-blue-200 mb-2">
            <strong>📘 Como usar a Análise de Padrões:</strong>
          </p>
          <ul className="text-sm text-blue-200 space-y-1 ml-4">
            <li><strong>1. Selecione Mercados:</strong> Escolha os mercados que deseja testar (Over 3.5, Ambas Marcam, etc.)</li>
            <li><strong>2. Defina o Padrão Isolado (🟨):</strong> Clique nas células que formam o gatilho do seu padrão</li>
            <li><strong>3. Defina a Entrada (🟩):</strong> Clique na célula onde você faria a aposta após o padrão</li>
            <li className="text-yellow-300 font-semibold">
              ⚠️ <strong>REGRA IMPORTANTE:</strong> A Entrada deve estar na <strong>mesma coluna</strong> e em <strong>linha abaixo</strong> do Padrão para que o backtest funcione! (Linhas decrescem de 8 a 1, sendo 8 o jogo mais antigo e 1 o mais recente)
            </li>
            <li><strong>4. Execute o Backtest:</strong> O sistema vai analisar os dados históricos e mostrar:
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>• <strong>SG (Sem Gale):</strong> Quando bateu no primeiro jogo</li>
                <li>• <strong>G1-G4 (Gale 1-4):</strong> Quando precisou de 1 a 4 progressões</li>
                <li>• <strong>F (Falha):</strong> Quando não bateu em nenhum dos 5 jogos</li>
                <li>• <strong>ROI Simulado:</strong> Lucro/prejuízo estimado (odd 2.0, stake 100)</li>
              </ul>
            </li>
          </ul>
        </div>
        
        {/* Seção de Tooltips Informativos */}
        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <details className="cursor-pointer">
            <summary className="text-sm font-semibold text-purple-300 hover:text-purple-200">
              ❓ O que significa cada conceito? (clique para expandir)
            </summary>
            <div className="mt-3 space-y-2 text-sm text-gray-300">
              <div>
                <strong className="text-yellow-400">🟨 Padrão Isolado:</strong> São as células que representam o "gatilho" da sua estratégia. 
                Por exemplo: 3 jogos seguidos que bateram Over 3.5. Quando esse padrão é encontrado nos dados históricos, o sistema registra e analisa o que aconteceu depois.
              </div>
              <div>
                <strong className="text-green-400">🟩 Entrada:</strong> É a célula onde você faria a aposta após identificar o padrão. 
                O sistema vai verificar se essa entrada bateu (SG), se precisou de gale (G1-G4), ou se falhou (F).
              </div>
              <div>
                <strong className="text-blue-400">📊 Gale (Progressão):</strong> Estratégia onde, se a aposta não bate no primeiro jogo, você aposta novamente com valor maior no próximo jogo. 
                G1 = precisou de 1 jogo extra, G2 = 2 jogos extras, etc. Máximo de 4 gales (G4).
              </div>
              <div>
                <strong className="text-purple-400">💰 ROI (Return on Investment):</strong> Retorno sobre investimento. 
                Calcula quanto você lucraria (ou perderia) seguindo esse padrão, considerando odd média de 2.0 e stake de 100 por aposta.
              </div>
            </div>
          </details>
        </div>
        
        <div className="space-y-4">
          {/* Seleção de Mercados */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              Selecione Mercados (múltipla seleção):
              <span className="text-xs text-gray-500 italic" title="Escolha os mercados que o padrão deve verificar nas partidas">
                ℹ️ Escolha quais condições verificar
              </span>
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
              <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                Combinação Lógica:
                <span className="text-xs text-gray-500 italic" title="E = todos os mercados devem bater | OU = pelo menos um mercado deve bater">
                  ℹ️ Como combinar os mercados
                </span>
              </label>
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
            {/* Header */}
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

            {/* Linhas - INVERTIDAS (8 até 1) para ordem cronológica correta */}
            {[...Array(8)].map((_, rowIdx) => {
              const row = 8 - rowIdx; // Inverte: 8, 7, 6, 5, 4, 3, 2, 1
              return (
                <div key={row} className="flex">
                  <div className="w-[60px] h-[60px] flex-shrink-0 border-r border-t border-gray-800 bg-gray-950 flex items-center justify-center text-sm font-semibold text-gray-300">
                    {row}
                  </div>
                  
                  {[...Array(20)].map((_, colIdx) => {
                    const col = colIdx + 1;
                    const key = `${row}-${col}`;
                    const config = matrix[key];
                    const isSelected = selectedCells.includes(key);
                    const cellText = getCellText(config);
                    
                    return (
                      <div
                        key={col}
                        onClick={() => handleCellClick(row, col)}
                        className={`w-[70px] h-[60px] flex-shrink-0 border-r border-t cursor-pointer transition-all flex items-center justify-center p-1 ${
                          isSelected ? 'ring-4 ring-blue-400 ring-inset' :
                          config?.type === 'pattern' ? 'bg-yellow-600/40 border-yellow-500/50' :
                          config?.type === 'entry' ? 'bg-green-600/40 border-green-500/50' :
                          'border-gray-800'
                        } ${
                          !config && !isSelected ? 'bg-gray-800/30 hover:bg-gray-700/50' :
                          config?.type === 'pattern' ? 'hover:bg-yellow-600/60' :
                          config?.type === 'entry' ? 'hover:bg-green-600/60' :
                          ''
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-4 border-blue-400 rounded"></div>
            <span className="text-gray-300">Selecionada</span>
          </div>
        </div>
      </Card>

      {/* Resultados do Backtest */}
      {analysisResults && analysisResults.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800 p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Resultados do Backtest
          </h3>

          {/* Info sobre ROI */}
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-200">
              <strong>💡 Sobre o ROI:</strong> O ROI simulado considera odd média de 2.0 e stake base de 100.
              Para cada ocorrência do padrão, simula apostas com gale (stake dobrado a cada nível).
              Este é um cálculo simplificado - odds reais podem variar significativamente.
            </p>
          </div>

          <div className="space-y-6">
            {analysisResults.map((result, idx) => {
              // Usa os dados já calculados corretamente
              const totalSuccess = result.assertiveness.total.percentage;
              const failures = result.assertiveness.failures.count;
              const failurePercentage = result.assertiveness.failures.percentage;
              
              // Contadores por nível (já corretos do backend)
              const sgCount = result.assertiveness.sg.count;
              const g1Count = result.assertiveness.g1.count;
              const g2Count = result.assertiveness.g2.count;
              const g3Count = result.assertiveness.g3.count;
              const g4Count = result.assertiveness.g4.count;
              
              const sgPercent = result.assertiveness.sg.percentage;
              const g1Percent = result.assertiveness.g1.percentage;
              const g2Percent = result.assertiveness.g2.percentage;
              const g3Percent = result.assertiveness.g3.percentage;
              const g4Percent = result.assertiveness.g4.percentage;
              
              // Cálculo de ROI simulado (assumindo odd média de 2.0 e stake de 100)
              const stake = 100;
              const avgOdd = 2.0;
              const totalInvested = result.totalOccurrences * stake * (1 + 1 + 1 + 1 + 1); // SG + G1 + G2 + G3 + G4
              const totalReturned = (sgCount * stake * avgOdd) + 
                                   (g1Count * stake * 2 * avgOdd) + 
                                   (g2Count * stake * 3 * avgOdd) +
                                   (g3Count * stake * 4 * avgOdd) +
                                   (g4Count * stake * 5 * avgOdd);
              const roi = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0;
              
              return (
                <div key={idx} className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-6 border border-purple-500/30">
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-lg mb-2">
                      <span className="text-yellow-400 font-bold">🔹 Padrão:</span>
                      <span className="text-white font-semibold">{getCellText(result.patternConfig)}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-400 font-bold">Entrada:</span>
                      <span className="text-white font-semibold">{getCellText(result.entryConfig)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Padrão: Célula {result.patternPosition}</span>
                      <span>•</span>
                      <span>Entrada: Célula {result.entryPosition}</span>
                    </div>
                  </div>

                  {/* Métricas Principais */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gray-900/70 rounded-lg p-4 border border-green-500/50">
                      <p className="text-xs text-gray-400 mb-1">✅ Assertividade Total</p>
                      <p className={`text-3xl font-bold ${
                        totalSuccess >= 70 ? 'text-green-400' :
                        totalSuccess >= 50 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {totalSuccess.toFixed(1)}%
                      </p>
                    </div>

                    <div className="bg-gray-900/70 rounded-lg p-4 border border-blue-500/50">
                      <p className="text-xs text-gray-400 mb-1">🧮 Ocorrências</p>
                      <p className="text-3xl font-bold text-blue-400">{result.totalOccurrences}</p>
                    </div>

                    <div className="bg-gray-900/70 rounded-lg p-4 border border-purple-500/50">
                      <p className="text-xs text-gray-400 mb-1">🎯 Sem Gale (SG)</p>
                      <p className="text-3xl font-bold text-purple-400">{sgPercent.toFixed(0)}%</p>
                      <p className="text-xs text-gray-500 mt-1">{sgCount} jogos</p>
                    </div>

                    <div className="bg-gray-900/70 rounded-lg p-4 border border-red-500/50">
                      <p className="text-xs text-gray-400 mb-1">❌ Falhas (F)</p>
                      <p className="text-3xl font-bold text-red-400">{failurePercentage.toFixed(0)}%</p>
                      <p className="text-xs text-gray-500 mt-1">{failures} jogos</p>
                    </div>

                    <div className="bg-gray-900/70 rounded-lg p-4 border border-yellow-500/50">
                      <p className="text-xs text-gray-400 mb-1">💰 ROI Simulado</p>
                      <p className={`text-3xl font-bold ${
                        roi >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Odd 2.0, Stake 100</p>
                    </div>
                  </div>

                  {/* Distribuição Visual */}
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-white mb-3">📈 Distribuição por Gale:</p>
                    <div className="space-y-2">
                      {/* SG */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">SG (Sem Gale)</span>
                          <span className="text-sm text-gray-400">{sgCount} jogos ({sgPercent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-600 to-green-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${sgPercent}%` }}
                          >
                            {sgPercent > 5 && `${sgPercent.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      {/* G1 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">G1 (Gale 1)</span>
                          <span className="text-sm text-gray-400">{g1Count} jogos ({g1Percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${g1Percent}%` }}
                          >
                            {g1Percent > 5 && `${g1Percent.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      {/* G2 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">G2 (Gale 2)</span>
                          <span className="text-sm text-gray-400">{g2Count} jogos ({g2Percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${g2Percent}%` }}
                          >
                            {g2Percent > 5 && `${g2Percent.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      {/* G3 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">G3 (Gale 3)</span>
                          <span className="text-sm text-gray-400">{g3Count} jogos ({g3Percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${g3Percent}%` }}
                          >
                            {g3Percent > 5 && `${g3Percent.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      {/* G4 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">G4 (Gale 4)</span>
                          <span className="text-sm text-gray-400">{g4Count} jogos ({g4Percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-pink-600 to-pink-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${g4Percent}%` }}
                          >
                            {g4Percent > 5 && `${g4Percent.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>

                      {/* F (Falhas) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-semibold">F (Falhas)</span>
                          <span className="text-sm text-gray-400">{failures} jogos ({failurePercentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-red-600 to-red-400 flex items-center justify-center text-xs font-bold text-white"
                            style={{ width: `${failurePercentage}%` }}
                          >
                            {failurePercentage > 5 && `${failurePercentage.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo Textual */}
                  <div className={`p-4 rounded-lg border ${
                    totalSuccess >= 70 ? 'bg-green-900/30 border-green-500/50' :
                    totalSuccess >= 50 ? 'bg-yellow-900/30 border-yellow-500/50' :
                    'bg-red-900/30 border-red-500/50'
                  }`}>
                    <p className="text-sm text-white">
                      <strong>
                        {totalSuccess >= 70 ? '✅ Padrão Excelente!' :
                         totalSuccess >= 50 ? '⚠️ Padrão Moderado' :
                         '❌ Padrão Fraco'}
                      </strong>
                      {' - '}
                      Este padrão teve <strong>{result.totalOccurrences} ocorrências</strong> nos dados.
                      {' '}A assertividade total considerando gale é de <strong>{totalSuccess.toFixed(1)}%</strong>.
                      {' '}<strong>{sgPercent.toFixed(0)}%</strong> dos casos bateram sem gale (SG).
                      {' '}ROI simulado: <strong className={roi >= 0 ? 'text-green-400' : 'text-red-400'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</strong>.
                    </p>
                  </div>

                  {/* Análise Detalhada - Separada por GREEN e RED */}
                  <div className="mt-6 space-y-6">
                    {/* Análise dos Jogos GREEN (que bateram) */}
                    {result.greenAnalysis && result.greenAnalysis.count > 0 && (
                      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/50 rounded-lg p-6">
                        <h4 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
                          ✅ Análise dos Jogos GREEN ({result.greenAnalysis.count} jogos - {result.greenAnalysis.percentage.toFixed(1)}%)
                        </h4>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Odds GREEN */}
                          <div className="bg-gray-900/50 rounded-lg p-4">
                            <h5 className="text-sm font-bold text-green-200 mb-3">💰 Odds Mais Frequentes (GREEN)</h5>
                            {result.greenAnalysis.odds.mostCommon && result.greenAnalysis.odds.mostCommon.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.greenAnalysis.odds.mostCommon.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                                    <div className="flex flex-col">
                                      <span className="text-white font-semibold">{item.market}</span>
                                      <span className="text-green-300 text-xs">Odd: {item.odd.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">{item.count}x</span>
                                      <span className="text-xs text-gray-500">
                                        ({((item.count / result.greenAnalysis.count) * 100).toFixed(0)}%)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Sem dados de odds</p>
                            )}
                          </div>

                          {/* Placares GREEN */}
                          <div className="bg-gray-900/50 rounded-lg p-4">
                            <h5 className="text-sm font-bold text-green-200 mb-3">⚽ Placares Mais Frequentes (GREEN)</h5>
                            {result.greenAnalysis.scores.mostCommon && result.greenAnalysis.scores.mostCommon.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.greenAnalysis.scores.mostCommon.slice(0, 10).map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                                    <span className="text-white font-semibold">{item.score}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">{item.count}x</span>
                                      <span className="text-xs text-gray-500">
                                        ({((item.count / result.greenAnalysis.count) * 100).toFixed(0)}%)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Sem dados de placares</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Análise dos Jogos RED (que falharam) */}
                    {result.redAnalysis && result.redAnalysis.count > 0 && (
                      <div className="bg-gradient-to-br from-red-900/30 to-rose-900/30 border border-red-500/50 rounded-lg p-6">
                        <h4 className="text-lg font-bold text-red-300 mb-4 flex items-center gap-2">
                          ❌ Análise dos Jogos RED ({result.redAnalysis.count} jogos - {result.redAnalysis.percentage.toFixed(1)}%)
                        </h4>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Odds RED */}
                          <div className="bg-gray-900/50 rounded-lg p-4">
                            <h5 className="text-sm font-bold text-red-200 mb-3">💰 Odds Mais Frequentes (RED)</h5>
                            {result.redAnalysis.odds.mostCommon && result.redAnalysis.odds.mostCommon.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.redAnalysis.odds.mostCommon.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                                    <div className="flex flex-col">
                                      <span className="text-white font-semibold">{item.market}</span>
                                      <span className="text-red-300 text-xs">Odd: {item.odd.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">{item.count}x</span>
                                      <span className="text-xs text-gray-500">
                                        ({((item.count / result.redAnalysis.count) * 100).toFixed(0)}%)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Sem dados de odds</p>
                            )}
                          </div>

                          {/* Placares RED */}
                          <div className="bg-gray-900/50 rounded-lg p-4">
                            <h5 className="text-sm font-bold text-red-200 mb-3">⚽ Placares Mais Frequentes (RED)</h5>
                            {result.redAnalysis.scores.mostCommon && result.redAnalysis.scores.mostCommon.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.redAnalysis.scores.mostCommon.slice(0, 10).map((item, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                                    <span className="text-white font-semibold">{item.score}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">{item.count}x</span>
                                      <span className="text-xs text-gray-500">
                                        ({((item.count / result.redAnalysis.count) * 100).toFixed(0)}%)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Sem dados de placares</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabela Detalhada (colapsável) */}
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const elem = document.getElementById(`details-${idx}`);
                        if (elem) elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Ver Tabela Detalhada ▼
                    </button>
                    
                    <div id={`details-${idx}`} style={{ display: 'none' }} className="mt-3 overflow-x-auto">
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
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PatternAnalysisPage;
