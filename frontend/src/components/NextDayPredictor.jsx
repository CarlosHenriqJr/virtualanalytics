import React, { useMemo } from 'react';
import { Calendar, Target, TrendingUp, Award, DollarSign, CheckCircle } from 'lucide-react';
import { Card } from './ui/card';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NextDayPredictor = ({ allMatches, currentDate }) => {
  const prediction = useMemo(() => {
    if (!allMatches || allMatches.length === 0 || !currentDate) return null;

    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const nextDate = addDays(currentDate, 1);
    const nextDateStr = format(nextDate, 'yyyy-MM-dd');

    // Filtra apenas jogos até a data atual
    const historicalMatches = allMatches.filter(m => m.date <= currentDateStr);
    const currentDayMatches = allMatches.filter(m => m.date === currentDateStr);
    const nextDayMatches = allMatches.filter(m => m.date === nextDateStr); // Para validar previsão se existir

    if (historicalMatches.length === 0) return null;

    // ========================================
    // 1. ANÁLISE DE ODDS QUE ANTECEDEM OVER 3.5
    // ========================================
    const oddsBeforeOver35 = {};
    const scenariosBeforeOver35 = [];

    historicalMatches.forEach((match, index) => {
      const isOver35 = match.totalGolsFT > 3.5;
      
      if (isOver35 && match.markets?.TotalGols_MaisDe_35) {
        const odd = match.markets.TotalGols_MaisDe_35;
        const oddKey = odd.toFixed(2);

        // Registra a odd que apareceu ANTES de um Over 3.5
        if (!oddsBeforeOver35[oddKey]) {
          oddsBeforeOver35[oddKey] = {
            odd: parseFloat(oddKey),
            frequency: 0,
            over35Count: 0,
            taxa: 0,
            scenarios: []
          };
        }

        oddsBeforeOver35[oddKey].frequency++;
        oddsBeforeOver35[oddKey].over35Count++;

        // Analisa cenário que antecede este Over 3.5
        const previousMatches = historicalMatches.slice(Math.max(0, index - 3), index);
        const scenario = {
          odd: parseFloat(oddKey),
          times: [match.timeCasa, match.timeFora],
          hour: match.hour,
          minute: match.minute,
          placarHT: match.placarHT,
          placarFT: match.placarFT,
          
          // Contexto dos 3 jogos anteriores
          previous3: previousMatches.map(m => ({
            over35: m.totalGolsFT > 3.5,
            gols: m.totalGolsFT,
            odd: m.markets?.TotalGols_MaisDe_35
          })),
          
          // Padrão dos 3 anteriores
          previousOver35Count: previousMatches.filter(m => m.totalGolsFT > 3.5).length,
          previousAvgGols: previousMatches.reduce((acc, m) => acc + m.totalGolsFT, 0) / (previousMatches.length || 1),
          previousAvgOdd: previousMatches.reduce((acc, m) => acc + (m.markets?.TotalGols_MaisDe_35 || 0), 0) / (previousMatches.length || 1)
        };

        oddsBeforeOver35[oddKey].scenarios.push(scenario);
        scenariosBeforeOver35.push(scenario);
      }
    });

    // Calcula taxas de acerto para odds que geraram Over 3.5
    Object.values(oddsBeforeOver35).forEach(oddData => {
      oddData.taxa = 100; // São todas odds que geraram Over 3.5
      
      // Identifica padrões comuns nos cenários
      const scenarios = oddData.scenarios;
      
      // Horários mais comuns
      const hourFreq = {};
      scenarios.forEach(s => {
        hourFreq[s.hour] = (hourFreq[s.hour] || 0) + 1;
      });
      oddData.commonHours = Object.entries(hourFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h, f]) => ({ hour: parseInt(h), freq: f }));

      // Padrão médio dos 3 anteriores
      oddData.avgPreviousOver35 = scenarios.reduce((acc, s) => 
        acc + s.previousOver35Count, 0
      ) / scenarios.length;

      oddData.avgPreviousGols = scenarios.reduce((acc, s) => 
        acc + s.previousAvgGols, 0
      ) / scenarios.length;

      oddData.avgPreviousOdd = scenarios.reduce((acc, s) => 
        acc + s.previousAvgOdd, 0
      ) / scenarios.length;

      // Times mais frequentes
      const teamFreq = {};
      scenarios.forEach(s => {
        s.times.forEach(team => {
          teamFreq[team] = (teamFreq[team] || 0) + 1;
        });
      });
      oddData.topTeams = Object.entries(teamFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([team, freq]) => ({ team, freq }));
    });

    // ========================================
    // 2. ANÁLISE DO DIA ANTERIOR
    // ========================================
    const previousDayAnalysis = {
      totalMatches: currentDayMatches.length,
      over35: currentDayMatches.filter(m => m.totalGolsFT > 3.5).length,
      over45: currentDayMatches.filter(m => m.totalGolsFT > 4.5).length,
      oddsUsed: {},
      topTeams: {},
      dominantHours: {}
    };

    currentDayMatches.forEach(match => {
      // Odds usadas no dia anterior
      if (match.markets?.TotalGols_MaisDe_35) {
        const oddKey = match.markets.TotalGols_MaisDe_35.toFixed(2);
        previousDayAnalysis.oddsUsed[oddKey] = 
          (previousDayAnalysis.oddsUsed[oddKey] || 0) + 1;
      }

      // Times do dia anterior
      [match.timeCasa, match.timeFora].forEach(team => {
        previousDayAnalysis.topTeams[team] = 
          (previousDayAnalysis.topTeams[team] || 0) + 1;
      });

      // Horários do dia anterior
      previousDayAnalysis.dominantHours[match.hour] = 
        (previousDayAnalysis.dominantHours[match.hour] || 0) + 1;
    });

    previousDayAnalysis.taxaOver35 = 
      (previousDayAnalysis.over35 / previousDayAnalysis.totalMatches) * 100;

    // ========================================
    // 3. PADRÕES HISTÓRICOS POR DIA DA SEMANA
    // ========================================
    const dayOfWeekPatterns = {};
    
    historicalMatches.forEach(match => {
      const date = parseISO(match.date);
      const dayOfWeek = format(date, 'EEEE', { locale: ptBR });

      if (!dayOfWeekPatterns[dayOfWeek]) {
        dayOfWeekPatterns[dayOfWeek] = {
          matches: 0,
          over35: 0,
          over45: 0,
          oddsFrequency: {}
        };
      }

      dayOfWeekPatterns[dayOfWeek].matches++;
      if (match.totalGolsFT > 3.5) dayOfWeekPatterns[dayOfWeek].over35++;
      if (match.totalGolsFT > 4.5) dayOfWeekPatterns[dayOfWeek].over45++;

      // Odds mais comuns nesse dia da semana
      if (match.markets?.TotalGols_MaisDe_35) {
        const oddKey = match.markets.TotalGols_MaisDe_35.toFixed(2);
        dayOfWeekPatterns[dayOfWeek].oddsFrequency[oddKey] = 
          (dayOfWeekPatterns[dayOfWeek].oddsFrequency[oddKey] || 0) + 1;
      }
    });

    // Calcula taxas
    Object.values(dayOfWeekPatterns).forEach(pattern => {
      pattern.taxaOver35 = (pattern.over35 / pattern.matches) * 100;
      pattern.taxaOver45 = (pattern.over45 / pattern.matches) * 100;
    });

    const nextDayOfWeek = format(nextDate, 'EEEE', { locale: ptBR });
    const historicalPattern = dayOfWeekPatterns[nextDayOfWeek];

    // ========================================
    // 4. ANÁLISE DE TIMES INVIESADOS
    // ========================================
    const teamBiasAnalysis = {};

    // Agrupa por data para identificar times "quentes" por dia
    const matchesByDate = {};
    historicalMatches.forEach(match => {
      if (!matchesByDate[match.date]) {
        matchesByDate[match.date] = [];
      }
      matchesByDate[match.date].push(match);
    });

    // Para cada time, analisa desempenho por dia
    historicalMatches.forEach(match => {
      [match.timeCasa, match.timeFora].forEach(team => {
        if (!teamBiasAnalysis[team]) {
          teamBiasAnalysis[team] = {
            team,
            totalGames: 0,
            over35Games: 0,
            byDate: {},
            hotDays: 0, // Dias onde teve alta taxa de Over
            lastAppearance: null,
            momentum: []
          };
        }

        const teamData = teamBiasAnalysis[team];
        teamData.totalGames++;
        teamData.lastAppearance = match.date;

        if (!teamData.byDate[match.date]) {
          teamData.byDate[match.date] = { games: 0, over35: 0 };
        }

        teamData.byDate[match.date].games++;
        if (match.totalGolsFT > 3.5) {
          teamData.over35Games++;
          teamData.byDate[match.date].over35++;
        }
      });
    });

    // Calcula dias "quentes" e momentum
    Object.values(teamBiasAnalysis).forEach(teamData => {
      teamData.overallRate = (teamData.over35Games / teamData.totalGames) * 100;
      
      // Conta quantos dias teve alta taxa de Over (acima de 60%)
      Object.values(teamData.byDate).forEach(dayData => {
        const dayRate = (dayData.over35 / dayData.games) * 100;
        if (dayRate >= 60) teamData.hotDays++;
      });

      // Calcula momentum recente (últimos 3 jogos)
      const recentGames = historicalMatches
        .filter(m => m.timeCasa === teamData.team || m.timeFora === teamData.team)
        .slice(-3);
      
      const recentOver = recentGames.filter(m => m.totalGolsFT > 3.5).length;
      teamData.momentum = (recentOver / Math.max(recentGames.length, 1)) * 100;

      // Verifica se jogou ontem
      teamData.playedYesterday = teamData.lastAppearance === currentDateStr;

      // Padrão de rotação (aparece a cada X dias)
      const appearances = Object.keys(teamData.byDate).sort();
      if (appearances.length >= 2) {
        const gaps = [];
        for (let i = 1; i < appearances.length; i++) {
          const gap = differenceInDays(
            parseISO(appearances[i]), 
            parseISO(appearances[i-1])
          );
          gaps.push(gap);
        }
        teamData.avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        
        // Dias desde última aparição
        teamData.daysSinceLastAppearance = differenceInDays(
          currentDate,
          parseISO(teamData.lastAppearance)
        );

        // Probabilidade de aparecer amanhã baseado no padrão
        teamData.appearanceProbability = teamData.avgGap 
          ? Math.max(0, 100 - Math.abs(teamData.daysSinceLastAppearance - teamData.avgGap) * 20)
          : 30;
      } else {
        teamData.appearanceProbability = 20;
      }
    });

    // Top 3 times previstos para estar inviesados amanhã
    const predictedBiasedTeams = Object.values(teamBiasAnalysis)
      .filter(t => t.totalGames >= 2)
      .map(t => {
        // Score preditivo baseado em:
        // - Taxa geral de Over (30%)
        // - Momentum recente (25%)
        // - Frequência de dias quentes (20%)
        // - Probabilidade de aparecer amanhã (25%)
        
        const score = (
          (t.overallRate / 100) * 30 +
          (t.momentum / 100) * 25 +
          (t.hotDays / Math.max(Object.keys(t.byDate).length, 1)) * 20 +
          (t.appearanceProbability / 100) * 25
        ) * 100;

        return {
          ...t,
          biasScore: score
        };
      })
      .sort((a, b) => b.biasScore - a.biasScore)
      .slice(0, 3);

    // ========================================
    // 5. PREVISÃO DE OVER 3.5 PARA O PRÓXIMO DIA
    // ========================================
    const over35Prediction = {
      // Baseado no padrão do dia da semana
      historicalDayRate: historicalPattern?.taxaOver35 || 0,
      
      // Baseado no dia anterior
      yesterdayRate: previousDayAnalysis.taxaOver35,
      
      // Média geral
      overallRate: (historicalMatches.filter(m => m.totalGolsFT > 3.5).length / 
                    historicalMatches.length) * 100,
      
      // Se times inviesados jogarem, aumenta probabilidade
      biasBonus: predictedBiasedTeams.length > 0 ? 
        (predictedBiasedTeams[0].overallRate * 0.3) : 0,
    };

    // Previsão final de Over 3.5 com pesos ajustados
    over35Prediction.predicted = (
      over35Prediction.historicalDayRate * 0.35 +  // 35% peso do padrão do dia
      over35Prediction.yesterdayRate * 0.25 +      // 25% peso do dia anterior
      over35Prediction.overallRate * 0.20 +        // 20% peso da média geral
      over35Prediction.biasBonus * 0.20            // 20% peso dos times inviesados
    );

    // Confiança na previsão
    let over35Confidence = 'baixa';
    if (historicalPattern && historicalPattern.matches > 5) {
      if (Math.abs(over35Prediction.predicted - over35Prediction.yesterdayRate) < 15) {
        over35Confidence = 'alta';
      } else {
        over35Confidence = 'média';
      }
    }

    over35Prediction.confidence = over35Confidence;

    // ========================================
    // 6. PREVISÃO PARA O PRÓXIMO DIA (FOCO EM OVER 3.5)
    // ========================================
    
    // Analisa situação atual (últimos 3 jogos do dia anterior)
    const recent3Matches = currentDayMatches.slice(-3);
    const currentContext = {
      over35Count: recent3Matches.filter(m => m.totalGolsFT > 3.5).length,
      avgGols: recent3Matches.reduce((acc, m) => acc + m.totalGolsFT, 0) / (recent3Matches.length || 1),
      avgOdd: recent3Matches.reduce((acc, m) => acc + (m.markets?.TotalGols_MaisDe_35 || 0), 0) / (recent3Matches.length || 1),
      lastOdd: currentDayMatches.length > 0 
        ? currentDayMatches[currentDayMatches.length - 1].markets?.TotalGols_MaisDe_35 
        : null
    };

    // Compara contexto atual com cenários históricos que geraram Over 3.5
    const predictedOddsForOver35 = Object.values(oddsBeforeOver35)
      .map(oddData => {
        // Score baseado em:
        // 1. Similaridade do contexto atual com cenários históricos (40%)
        // 2. Frequência desta odd gerar Over 3.5 (30%)
        // 3. Se apareceu recentemente (20%)
        // 4. Padrão do dia da semana (10%)

        // Similaridade de contexto
        const contextSimilarity = 100 - (
          Math.abs(currentContext.over35Count - oddData.avgPreviousOver35) * 20 +
          Math.abs(currentContext.avgGols - oddData.avgPreviousGols) * 10 +
          Math.abs((currentContext.avgOdd || oddData.odd) - oddData.avgPreviousOdd) * 5
        );

        const contextScore = Math.max(0, contextSimilarity) * 0.4;

        // Frequência
        const freqScore = Math.min(oddData.frequency / 5, 1) * 30;

        // Apareceu recentemente
        const recentScore = previousDayAnalysis.oddsUsed?.[oddData.odd.toFixed(2)] ? 20 : 0;

        // Dia da semana
        const dayScore = historicalPattern?.oddsFrequency?.[oddData.odd.toFixed(2)] 
          ? Math.min(historicalPattern.oddsFrequency[oddData.odd.toFixed(2)] / 3, 1) * 10 
          : 0;

        const totalScore = contextScore + freqScore + recentScore + dayScore;

        return {
          ...oddData,
          score: totalScore,
          contextSimilarity: Math.max(0, contextSimilarity),
          appearedYesterday: !!previousDayAnalysis.oddsUsed?.[oddData.odd.toFixed(2)]
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // ========================================
    // 7. CARACTERÍSTICAS DO PRÓXIMO DIA
    // ========================================
    const nextDayPrediction = {
      date: nextDate,
      dayOfWeek: nextDayOfWeek,
      expectedOver35Rate: historicalPattern?.taxaOver35 || 
        (previousDayAnalysis.taxaOver35 * 0.7 + 
         (Object.values(dayOfWeekPatterns).reduce((acc, p) => acc + p.taxaOver35, 0) / 
          Object.keys(dayOfWeekPatterns).length) * 0.3),
      
      confidence: calculateConfidence(
        historicalPattern,
        previousDayAnalysis,
        historicalMatches.length
      ),

      recommendations: generateRecommendations(
        predictedOddsForOver35,
        previousDayAnalysis,
        currentContext
      )
    };

    // Se o próximo dia já existe nos dados, valida a previsão
    let validation = null;
    if (nextDayMatches.length > 0) {
      validation = validatePrediction(
        nextDayMatches,
        predictedOddsForOver35,
        nextDayPrediction
      );
    }

    return {
      oddsBeforeOver35: Object.values(oddsBeforeOver35).sort((a, b) => b.frequency - a.frequency),
      scenariosBeforeOver35,
      previousDayAnalysis,
      historicalPattern,
      predictedOddsForOver35,
      predictedBiasedTeams,
      over35Prediction,
      nextDayPrediction,
      validation,
      currentContext,
      totalHistoricalDays: new Set(historicalMatches.map(m => m.date)).size
    };
  }, [allMatches, currentDate]);

  // Função para verificar se mercado pagou
  function checkIfMarketPaid(match, marketName) {
    const { totalGolsFT, placarCasaFT, placarForaFT } = match;

    if (marketName.includes('MaisDe_35')) return totalGolsFT > 3.5;
    if (marketName.includes('MaisDe_45')) return totalGolsFT > 4.5;
    if (marketName.includes('MaisDe_25')) return totalGolsFT > 2.5;
    if (marketName.includes('AmbasMarcam')) return placarCasaFT > 0 && placarForaFT > 0;
    if (marketName.includes('Casa')) return placarCasaFT > placarForaFT;
    if (marketName.includes('Empate')) return placarCasaFT === placarForaFT;
    if (marketName.includes('Visitante')) return placarForaFT > placarCasaFT;
    
    return false;
  }

  function calculateConfidence(historicalPattern, previousDay, totalDays) {
    let score = 0;

    // Mais dias históricos = mais confiança
    if (totalDays > 60) score += 30;
    else if (totalDays > 30) score += 20;
    else score += 10;

    // Padrão do dia da semana existe
    if (historicalPattern && historicalPattern.matches > 3) score += 40;
    else if (historicalPattern) score += 20;

    // Dia anterior tem dados
    if (previousDay.totalMatches > 10) score += 30;
    else if (previousDay.totalMatches > 5) score += 20;
    else score += 10;

    if (score > 70) return { level: 'alto', color: 'text-green-400', bg: 'bg-green-900/20' };
    if (score > 40) return { level: 'médio', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
    return { level: 'baixo', color: 'text-red-400', bg: 'bg-red-900/20' };
  }

  function generateRecommendations(oddsForOver35, previousDay, currentCtx) {
    const recommendations = [];

    // Recomendação 1: Odd com melhor score para Over 3.5
    if (oddsForOver35[0] && oddsForOver35[0].score > 40) {
      recommendations.push({
        type: 'Odd Ideal para Over 3.5',
        text: `Foque na odd ${oddsForOver35[0].odd} - gerou Over 3.5 em ${oddsForOver35[0].frequency} jogos (${oddsForOver35[0].contextSimilarity.toFixed(0)}% similar ao contexto atual)`,
        confidence: oddsForOver35[0].score > 70 ? 'alto' : 'médio'
      });
    }

    // Recomendação 2: Baseado no contexto
    if (currentCtx.over35Count >= 2) {
      recommendations.push({
        type: 'Contexto Favorável',
        text: `Últimos 3 jogos tiveram ${currentCtx.over35Count} Overs - contexto quente para continuar`,
        confidence: 'alto'
      });
    } else if (currentCtx.over35Count === 0) {
      recommendations.push({
        type: 'Padrão de Inversão',
        text: `Últimos 3 jogos sem Over - alta probabilidade de reversão para Over 3.5`,
        confidence: 'médio'
      });
    }

    // Recomendação 3: Baseado no dia anterior
    if (previousDay.taxaOver35 > 50) {
      recommendations.push({
        type: 'Continuidade',
        text: `Ontem teve ${previousDay.taxaOver35.toFixed(1)}% de Over 3.5 - tendência pode continuar`,
        confidence: 'médio'
      });
    }

    return recommendations;
  }

  function validatePrediction(actualMatches, predictedOddsForOver, prediction) {
    const actualOddsUsed = {};
    const actualOver35Matches = actualMatches.filter(m => m.totalGolsFT > 3.5);
    
    actualOver35Matches.forEach(m => {
      if (m.markets?.TotalGols_MaisDe_35) {
        const oddKey = m.markets.TotalGols_MaisDe_35.toFixed(2);
        actualOddsUsed[oddKey] = (actualOddsUsed[oddKey] || 0) + 1;
      }
    });

    const actualOver35Rate = (actualOver35Matches.length / actualMatches.length) * 100;

    const predictedOddsKeys = predictedOddsForOver.slice(0, 5).map(o => o.odd.toFixed(2));
    const correctPredictions = predictedOddsKeys.filter(odd => actualOddsUsed[odd]).length;

    const accuracy = (correctPredictions / 5) * 100;

    return {
      actualOddsUsed,
      actualOver35Rate,
      predictedOver35Rate: prediction.expectedOver35Rate,
      accuracy: accuracy.toFixed(1),
      correctOdds: correctPredictions,
      actualOver35Count: actualOver35Matches.length,
      totalMatches: actualMatches.length
    };
  }

  if (!prediction) {
    return (
      <div className="text-center text-gray-500 py-8">
        Carregue dados históricos para previsão do próximo dia
      </div>
    );
  }

  const { 
    previousDayAnalysis,
    predictedOddsForOver35,
    predictedBiasedTeams,
    over35Prediction,
    nextDayPrediction,
    validation,
    currentContext,
    scenariosBeforeOver35,
    totalHistoricalDays
  } = prediction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8" />
              <h2 className="text-3xl font-bold">
                Previsão para {format(nextDayPrediction.date, "dd/MM/yyyy")}
              </h2>
            </div>
            <p className="text-blue-100">
              {nextDayPrediction.dayOfWeek} • Baseado em {totalHistoricalDays} dias de histórico
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Nível de Confiança</div>
            <div className={`text-4xl font-bold ${nextDayPrediction.confidence.color}`}>
              {nextDayPrediction.confidence.level.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* DESTAQUE: Probabilidade de Over 3.5 */}
      <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/50 border-2 p-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Target className="w-10 h-10 text-green-400" />
            <h2 className="text-3xl font-bold text-white">Probabilidade de Over 3.5</h2>
          </div>
          
          <div className="mb-6">
            <div className="text-7xl font-bold text-green-400 mb-2">
              {over35Prediction.predicted.toFixed(1)}%
            </div>
            <div className={`text-lg font-semibold ${
              over35Prediction.confidence === 'alta' ? 'text-green-300' :
              over35Prediction.confidence === 'média' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              Confiança: {over35Prediction.confidence.toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Padrão deste Dia</p>
              <p className="text-2xl font-bold text-blue-400">
                {over35Prediction.historicalDayRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Ontem</p>
              <p className="text-2xl font-bold text-purple-400">
                {over35Prediction.yesterdayRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Média Geral</p>
              <p className="text-2xl font-bold text-yellow-400">
                {over35Prediction.overallRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Bônus Times</p>
              <p className="text-2xl font-bold text-orange-400">
                +{over35Prediction.biasBonus.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <p className="text-sm text-green-200">
              <strong>Interpretação:</strong> {
                over35Prediction.predicted > 60 
                  ? "Alta probabilidade de jogos com Over 3.5 amanhã! Foque em odds baixas."
                  : over35Prediction.predicted > 40
                  ? "Probabilidade moderada. Selecione jogos com times inviesados."
                  : "Baixa probabilidade de Over 3.5. Considere Under ou outros mercados."
              }
            </p>
          </div>
        </div>
      </Card>

      {/* Top 3 Times Inviesados Previstos */}
      <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-7 h-7 text-orange-400" />
          <div>
            <h3 className="text-2xl font-bold text-white">Top 3 Times Inviesados Previstos</h3>
            <p className="text-sm text-gray-400">Times com maior probabilidade de Over 3.5 amanhã</p>
          </div>
        </div>

        <div className="space-y-4">
          {predictedBiasedTeams.map((team, idx) => (
            <div
              key={idx}
              className="bg-gray-800/50 rounded-lg p-5 border-l-4 border-orange-500"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold text-2xl">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-white">{team.team}</h4>
                    {team.playedYesterday && (
                      <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded mt-1">
                        JOGOU ONTEM
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-orange-400">
                    {team.biasScore.toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-400">Score de Viés</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Taxa Over 3.5</p>
                  <p className="text-xl font-bold text-green-400">
                    {team.overallRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">{team.over35Games}/{team.totalGames} jogos</p>
                </div>
                
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Momentum</p>
                  <p className="text-xl font-bold text-yellow-400">
                    {team.momentum.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500">Últimos 3 jogos</p>
                </div>

                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Dias Quentes</p>
                  <p className="text-xl font-bold text-red-400">
                    {team.hotDays}
                  </p>
                  <p className="text-xs text-gray-500">de {Object.keys(team.byDate).length} dias</p>
                </div>

                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Prob. Aparecer</p>
                  <p className="text-xl font-bold text-purple-400">
                    {team.appearanceProbability.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Média a cada {team.avgGap?.toFixed(0) || '?'} dias
                  </p>
                </div>
              </div>

              <div className="bg-orange-900/20 border border-orange-500/30 rounded p-3">
                <p className="text-sm text-orange-200">
                  <strong>Por que está inviesado?</strong>{' '}
                  {team.momentum > 60 && "Momentum forte nos últimos jogos. "}
                  {team.hotDays >= 2 && `Teve ${team.hotDays} dias com alta taxa de Over. `}
                  {team.overallRate > 50 && "Taxa geral acima de 50%. "}
                  {team.daysSinceLastAppearance <= 1 && "Jogou recentemente e pode continuar. "}
                  {team.appearanceProbability > 70 && "Padrão de rotação indica que deve jogar amanhã."}
                </p>
              </div>
            </div>
          ))}
        </div>

        {predictedBiasedTeams.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Dados insuficientes para prever times inviesados
          </div>
        )}
      </Card>

      {/* Validação (se próximo dia já existe) */}
      {validation && (
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Validação da Previsão</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Acurácia das Odds</p>
              <p className="text-3xl font-bold text-green-400">{validation.accuracy}%</p>
              <p className="text-xs text-gray-500 mt-1">{validation.correctOdds}/5 odds corretas</p>
            </div>
            <div className="bg-gray-800/50 rounded p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Over 3.5 Previsto</p>
              <p className="text-3xl font-bold text-yellow-400">
                {validation.predictedOver35Rate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800/50 rounded p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">Over 3.5 Real</p>
              <p className="text-3xl font-bold text-blue-400">
                {validation.actualOver35Rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Recomendações */}
      <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-yellow-400" />
          <h3 className="text-2xl font-bold text-white">Recomendações Principais</h3>
        </div>
        <div className="space-y-3">
          {nextDayPrediction.recommendations.map((rec, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-yellow-400">{rec.type}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  rec.confidence === 'alto' ? 'bg-green-600' :
                  rec.confidence === 'médio' ? 'bg-yellow-600' :
                  'bg-gray-600'
                } text-white`}>
                  {rec.confidence}
                </span>
              </div>
              <p className="text-white">{rec.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Odds que Geram Over 3.5 */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-400" />
          <div>
            <h3 className="text-2xl font-bold text-white">Odds Que Geram Over 3.5</h3>
            <p className="text-sm text-gray-400">Baseado em {scenariosBeforeOver35.length} cenários históricos</p>
          </div>
        </div>
        
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-200">
            <strong>Contexto Atual (últimos 3 jogos):</strong>{' '}
            {currentContext.over35Count}/3 com Over 3.5 • 
            Média {currentContext.avgGols.toFixed(1)} gols • 
            Odd média {(currentContext.avgOdd || 0).toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predictedOddsForOver35.map((odd, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-5 border border-gray-700 hover:border-green-500 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-green-400">{odd.odd}</span>
                  {odd.appearedYesterday && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      ONTEM
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-yellow-400">{odd.score.toFixed(0)}%</div>
                  <div className="text-xs text-gray-400">probabilidade</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between bg-gray-900/50 rounded p-2">
                  <span className="text-gray-400">Frequência Over 3.5:</span>
                  <span className="text-white font-semibold">{odd.frequency}x</span>
                </div>
                
                <div className="flex justify-between bg-gray-900/50 rounded p-2">
                  <span className="text-gray-400">Similaridade Contexto:</span>
                  <span className={`font-semibold ${
                    odd.contextSimilarity > 70 ? 'text-green-400' :
                    odd.contextSimilarity > 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {odd.contextSimilarity.toFixed(0)}%
                  </span>
                </div>

                {odd.commonHours && odd.commonHours.length > 0 && (
                  <div className="bg-gray-900/50 rounded p-2">
                    <span className="text-gray-400 text-xs block mb-1">Horários comuns:</span>
                    <div className="flex gap-1">
                      {odd.commonHours.map((h, hidx) => (
                        <span key={hidx} className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded">
                          {h.hour}h ({h.freq}x)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {odd.topTeams && odd.topTeams.length > 0 && (
                  <div className="bg-gray-900/50 rounded p-2">
                    <span className="text-gray-400 text-xs block mb-1">Times frequentes:</span>
                    <div className="flex flex-wrap gap-1">
                      {odd.topTeams.slice(0, 3).map((t, tidx) => (
                        <span key={tidx} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                          {t.team}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-green-900/20 border border-green-500/30 rounded p-2 mt-2">
                  <p className="text-xs text-green-200">
                    <strong>Cenário típico:</strong> Média de {odd.avgPreviousOver35.toFixed(1)} Overs nos 3 jogos anteriores, {odd.avgPreviousGols.toFixed(1)} gols médios
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {predictedOddsForOver35.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Dados insuficientes. Carregue mais histórico de jogos com Over 3.5
          </div>
        )}
      </Card>

      {/* Resumo do Dia Anterior */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Análise do Dia Anterior</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Partidas</p>
            <p className="text-2xl font-bold text-white">{previousDayAnalysis.totalMatches}</p>
          </div>
          <div className="bg-gray-800/50 rounded p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Over 3.5</p>
            <p className="text-2xl font-bold text-green-400">
              {previousDayAnalysis.taxaOver35.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-800/50 rounded p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Odds Diferentes</p>
            <p className="text-2xl font-bold text-blue-400">
              {Object.keys(previousDayAnalysis.oddsUsed).length}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Times Únicos</p>
            <p className="text-2xl font-bold text-purple-400">
              {Object.keys(previousDayAnalysis.topTeams).length}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NextDayPredictor;
