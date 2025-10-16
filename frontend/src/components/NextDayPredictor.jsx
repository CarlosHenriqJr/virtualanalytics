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
    // 1. ANÁLISE DE FREQUÊNCIA DE ODDS
    // ========================================
    const oddsAnalysis = {};

    historicalMatches.forEach(match => {
      if (!match.markets) return;

      Object.entries(match.markets).forEach(([market, odd]) => {
        if (typeof odd !== 'number') return;

        // Arredonda odd para 2 casas decimais para agrupamento
        const oddKey = odd.toFixed(2);
        
        if (!oddsAnalysis[oddKey]) {
          oddsAnalysis[oddKey] = {
            odd: parseFloat(oddKey),
            frequency: 0,
            markets: {}
          };
        }

        oddsAnalysis[oddKey].frequency++;

        // Registra o mercado e se pagou
        if (!oddsAnalysis[oddKey].markets[market]) {
          oddsAnalysis[oddKey].markets[market] = {
            count: 0,
            paid: 0,
            taxa: 0
          };
        }

        oddsAnalysis[oddKey].markets[market].count++;

        // Verifica se o mercado pagou
        const paid = checkIfMarketPaid(match, market);
        if (paid) {
          oddsAnalysis[oddKey].markets[market].paid++;
        }
      });
    });

    // Calcula taxas de pagamento
    Object.values(oddsAnalysis).forEach(oddData => {
      Object.values(oddData.markets).forEach(marketData => {
        marketData.taxa = (marketData.paid / marketData.count) * 100;
      });
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
    const nextDayOfWeek = format(nextDate, 'EEEE', { locale: ptBR });
    const historicalPattern = dayOfWeekPatterns[nextDayOfWeek];

    // Top 5 odds mais prováveis para o próximo dia
    const predictedOdds = Object.entries(oddsAnalysis)
      .map(([oddKey, data]) => {
        // Score baseado em:
        // 1. Frequência histórica geral (40%)
        // 2. Se apareceu no dia anterior (30%)
        // 3. Se é comum nesse dia da semana (30%)
        
        const generalFreqScore = Math.min(data.frequency / 10, 1) * 40;
        const previousDayScore = previousDayAnalysis.oddsUsed[oddKey] ? 30 : 0;
        const dayOfWeekScore = historicalPattern?.oddsFrequency?.[oddKey] 
          ? Math.min(historicalPattern.oddsFrequency[oddKey] / 5, 1) * 30 
          : 0;

        const totalScore = generalFreqScore + previousDayScore + dayOfWeekScore;

        // Melhor mercado para essa odd
        const bestMarket = Object.entries(data.markets)
          .sort((a, b) => b[1].taxa - a[1].taxa)[0];

        return {
          odd: data.odd,
          frequency: data.frequency,
          score: totalScore,
          bestMarket: bestMarket ? {
            name: bestMarket[0],
            taxa: bestMarket[1].taxa,
            paid: bestMarket[1].paid,
            total: bestMarket[1].count
          } : null,
          appearedYesterday: !!previousDayAnalysis.oddsUsed[oddKey],
          commonOnThisDay: !!historicalPattern?.oddsFrequency?.[oddKey]
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Mercados com maior taxa de pagamento
    const topPayingMarkets = {};
    Object.values(oddsAnalysis).forEach(oddData => {
      Object.entries(oddData.markets).forEach(([market, data]) => {
        if (!topPayingMarkets[market]) {
          topPayingMarkets[market] = {
            totalCount: 0,
            totalPaid: 0,
            byOdd: []
          };
        }
        topPayingMarkets[market].totalCount += data.count;
        topPayingMarkets[market].totalPaid += data.paid;
        topPayingMarkets[market].byOdd.push({
          odd: oddData.odd,
          taxa: data.taxa
        });
      });
    });

    const topMarkets = Object.entries(topPayingMarkets)
      .map(([market, data]) => ({
        market,
        taxa: (data.totalPaid / data.totalCount) * 100,
        total: data.totalCount,
        paid: data.totalPaid,
        bestOdds: data.byOdd.sort((a, b) => b.taxa - a.taxa).slice(0, 3)
      }))
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 10);

    // ========================================
    // 6. PREVISÃO PARA O PRÓXIMO DIA
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
        predictedOdds,
        topMarkets,
        previousDayAnalysis
      )
    };

    // Se o próximo dia já existe nos dados, valida a previsão
    let validation = null;
    if (nextDayMatches.length > 0) {
      validation = validatePrediction(
        nextDayMatches,
        predictedOdds,
        nextDayPrediction
      );
    }

    return {
      oddsAnalysis: Object.values(oddsAnalysis).sort((a, b) => b.frequency - a.frequency),
      previousDayAnalysis,
      historicalPattern,
      predictedOdds,
      topMarkets,
      nextDayPrediction,
      validation,
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

  function generateRecommendations(odds, markets, previousDay) {
    const recommendations = [];

    // Recomendação 1: Odd mais provável
    if (odds[0] && odds[0].score > 50) {
      recommendations.push({
        type: 'Odd Prioritária',
        text: `Foque na odd ${odds[0].odd} - apareceu ${odds[0].frequency}x historicamente${
          odds[0].appearedYesterday ? ' e ONTEM' : ''
        }`,
        confidence: odds[0].score > 70 ? 'alto' : 'médio'
      });
    }

    // Recomendação 2: Melhor mercado
    if (markets[0] && markets[0].taxa > 50) {
      recommendations.push({
        type: 'Mercado Mais Confiável',
        text: `${markets[0].market} tem ${markets[0].taxa.toFixed(1)}% de taxa de pagamento (${markets[0].paid}/${markets[0].total})`,
        confidence: markets[0].taxa > 70 ? 'alto' : 'médio'
      });
    }

    // Recomendação 3: Baseado no dia anterior
    if (previousDay.taxaOver35 > 50) {
      recommendations.push({
        type: 'Tendência de Ontem',
        text: `Ontem teve ${previousDay.taxaOver35.toFixed(1)}% de Over 3.5 - possível continuidade`,
        confidence: 'médio'
      });
    } else if (previousDay.taxaOver35 < 30) {
      recommendations.push({
        type: 'Inversão de Tendência',
        text: `Ontem teve baixo Over 3.5 (${previousDay.taxaOver35.toFixed(1)}%) - possível aumento hoje`,
        confidence: 'baixo'
      });
    }

    return recommendations;
  }

  function validatePrediction(actualMatches, predictedOdds, prediction) {
    const actualOddsUsed = {};
    actualMatches.forEach(m => {
      if (m.markets?.TotalGols_MaisDe_35) {
        const oddKey = m.markets.TotalGols_MaisDe_35.toFixed(2);
        actualOddsUsed[oddKey] = (actualOddsUsed[oddKey] || 0) + 1;
      }
    });

    const actualOver35Rate = (actualMatches.filter(m => m.totalGolsFT > 3.5).length / actualMatches.length) * 100;

    const predictedOddsKeys = predictedOdds.slice(0, 5).map(o => o.odd.toFixed(2));
    const correctPredictions = predictedOddsKeys.filter(odd => actualOddsUsed[odd]).length;

    const accuracy = (correctPredictions / 5) * 100;

    return {
      actualOddsUsed,
      actualOver35Rate,
      predictedOver35Rate: prediction.expectedOver35Rate,
      accuracy: accuracy.toFixed(1),
      correctOdds: correctPredictions
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
    predictedOdds, 
    topMarkets, 
    nextDayPrediction,
    validation,
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

      {/* Odds Previstas */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-400" />
          <h3 className="text-2xl font-bold text-white">Odds Mais Prováveis para Amanhã</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predictedOdds.map((odd, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-green-400">{odd.odd}</span>
                  {odd.appearedYesterday && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      ONTEM
                    </span>
                  )}
                  {odd.commonOnThisDay && (
                    <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                      COMUM
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-400">{odd.score.toFixed(0)}%</div>
                  <div className="text-xs text-gray-400">probabilidade</div>
                </div>
              </div>

              <div className="text-sm text-gray-400 mb-2">
                Apareceu <span className="text-white font-semibold">{odd.frequency}x</span> no histórico
              </div>

              {odd.bestMarket && (
                <div className="bg-gray-900/50 rounded p-3 mt-2">
                  <div className="text-xs text-gray-500 mb-1">Melhor Mercado:</div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-sm">
                      {odd.bestMarket.name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-green-400 font-bold">
                      {odd.bestMarket.taxa.toFixed(1)}% pagou
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {odd.bestMarket.paid}/{odd.bestMarket.total} jogos
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Mercados com Maior Taxa de Pagamento */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-blue-400" />
          <h3 className="text-2xl font-bold text-white">Top Mercados por Taxa de Pagamento</h3>
        </div>
        <div className="space-y-3">
          {topMarkets.map((market, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold text-lg">{idx + 1}º</span>
                  <span className="font-semibold text-white">
                    {market.market.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    {market.taxa.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {market.paid}/{market.total} pagou
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <span className="text-xs text-gray-400">Melhores odds:</span>
                {market.bestOdds.slice(0, 3).map((odd, oidx) => (
                  <span key={oidx} className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                    {odd.odd} ({odd.taxa.toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
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
