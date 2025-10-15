import React, { useMemo } from 'react';
import { Brain, Calendar, Clock, TrendingUp, AlertTriangle, Target, Sparkles } from 'lucide-react';
import { Card } from './ui/card';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdvancedPrediction = ({ allMatches, currentDate }) => {
  const prediction = useMemo(() => {
    if (!allMatches || allMatches.length === 0 || !currentDate) return null;

    // Agrupa partidas por data
    const matchesByDate = {};
    allMatches.forEach(match => {
      if (!matchesByDate[match.date]) {
        matchesByDate[match.date] = [];
      }
      matchesByDate[match.date].push(match);
    });

    const allDates = Object.keys(matchesByDate).sort();
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const currentIndex = allDates.indexOf(currentDateStr);
    
    // Próximo dia (se existir nos dados)
    const nextDateStr = allDates[currentIndex + 1];
    const nextDate = nextDateStr ? parseISO(nextDateStr) : addDays(currentDate, 1);

    // Últimos 3 dias (ou menos se não houver)
    const recentDates = allDates.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
    const recentMatches = recentDates.flatMap(date => matchesByDate[date] || []);

    // ========================================
    // 1. ANÁLISE DE PADRÕES RECENTES
    // ========================================
    const recentPatterns = {
      timeStats: {},
      hourStats: {},
      leagueStats: {},
      totalOver35: 0,
      totalMatches: recentMatches.length
    };

    recentMatches.forEach(match => {
      const { timeCasa, timeFora, hour, totalGolsFT, date } = match;
      const isOver35 = totalGolsFT > 3.5;

      // Times
      [timeCasa, timeFora].forEach(team => {
        if (!recentPatterns.timeStats[team]) {
          recentPatterns.timeStats[team] = { jogos: 0, over35: 0, lastDays: [] };
        }
        recentPatterns.timeStats[team].jogos++;
        if (isOver35) recentPatterns.timeStats[team].over35++;
        recentPatterns.timeStats[team].lastDays.push({ date, over35: isOver35 });
      });

      // Horários
      if (!recentPatterns.hourStats[hour]) {
        recentPatterns.hourStats[hour] = { jogos: 0, over35: 0 };
      }
      recentPatterns.hourStats[hour].jogos++;
      if (isOver35) recentPatterns.hourStats[hour].over35++;

      if (isOver35) recentPatterns.totalOver35++;
    });

    // Top times recentes
    const topTimesRecent = Object.entries(recentPatterns.timeStats)
      .map(([team, stats]) => ({
        team,
        ...stats,
        taxa: (stats.over35 / stats.jogos) * 100,
        momentum: stats.lastDays.filter(d => d.over35).length / stats.lastDays.length
      }))
      .filter(t => t.jogos >= 2)
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 5);

    // Top horários recentes
    const topHoursRecent = Object.entries(recentPatterns.hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        ...stats,
        taxa: (stats.over35 / stats.jogos) * 100
      }))
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 5);

    // ========================================
    // 2. ANÁLISE DE TIMES E CONFRONTOS
    // ========================================
    const currentDayMatches = matchesByDate[currentDateStr] || [];
    const topTeamAnalysis = topTimesRecent[0];
    
    let topTeamJustification = null;
    if (topTeamAnalysis) {
      const teamMatches = currentDayMatches.filter(m => 
        m.timeCasa === topTeamAnalysis.team || m.timeFora === topTeamAnalysis.team
      );

      const avgOdds = teamMatches.reduce((acc, m) => 
        acc + (m.markets?.TotalGols_MaisDe_35 || 0), 0
      ) / (teamMatches.length || 1);

      const htFtCorrelation = teamMatches.filter(m => {
        const htGoals = m.placarCasaHT + m.placarForaHT;
        return htGoals >= 2 && m.totalGolsFT > 3.5;
      }).length / (teamMatches.length || 1);

      topTeamJustification = {
        team: topTeamAnalysis.team,
        taxa: topTeamAnalysis.taxa,
        avgOdds: avgOdds.toFixed(2),
        htFtCorrelation: (htFtCorrelation * 100).toFixed(1),
        matches: teamMatches.length,
        characteristics: avgOdds < 3 ? 'Favorecido pelas odds' : 
                        htFtCorrelation > 0.6 ? 'Padrão de HT alto' : 
                        'Características próprias'
      };
    }

    // ========================================
    // 3. ANÁLISE DE RNG E VIESES DIÁRIOS
    // ========================================
    const dailyBias = {};
    recentDates.forEach(date => {
      const dayMatches = matchesByDate[date] || [];
      const over35Count = dayMatches.filter(m => m.totalGolsFT > 3.5).length;
      const taxa = (over35Count / dayMatches.length) * 100;
      
      dailyBias[date] = {
        taxa,
        over35Count,
        total: dayMatches.length,
        dominantHour: null
      };

      // Horário dominante do dia
      const hourCounts = {};
      dayMatches.forEach(m => {
        if (m.totalGolsFT > 3.5) {
          hourCounts[m.hour] = (hourCounts[m.hour] || 0) + 1;
        }
      });
      
      if (Object.keys(hourCounts).length > 0) {
        dailyBias[date].dominantHour = parseInt(
          Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0]
        );
      }
    });

    // Detecta padrão de viés
    const biasPattern = recentDates.map(date => ({
      date,
      taxa: dailyBias[date].taxa,
      hour: dailyBias[date].dominantHour
    }));

    // ========================================
    // 4. CORRELAÇÃO TEMPORAL
    // ========================================
    let temporalCorrelation = null;
    if (currentIndex > 0) {
      const previousDateStr = allDates[currentIndex - 1];
      const previousMatches = matchesByDate[previousDateStr] || [];
      
      const prevHourStats = {};
      previousMatches.forEach(m => {
        if (!prevHourStats[m.hour]) prevHourStats[m.hour] = { over35: 0, total: 0 };
        prevHourStats[m.hour].total++;
        if (m.totalGolsFT > 3.5) prevHourStats[m.hour].over35++;
      });

      const currHourStats = {};
      currentDayMatches.forEach(m => {
        if (!currHourStats[m.hour]) currHourStats[m.hour] = { over35: 0, total: 0 };
        currHourStats[m.hour].total++;
        if (m.totalGolsFT > 3.5) currHourStats[m.hour].over35++;
      });

      // Verifica se horários com Over se mantêm, invertem ou migram
      const maintained = [];
      const inverted = [];
      const migrated = [];

      Object.keys(prevHourStats).forEach(hour => {
        const prevTaxa = (prevHourStats[hour].over35 / prevHourStats[hour].total);
        const currTaxa = currHourStats[hour] ? 
          (currHourStats[hour].over35 / currHourStats[hour].total) : 0;

        if (prevTaxa > 0.5 && currTaxa > 0.5) maintained.push(parseInt(hour));
        else if (prevTaxa > 0.5 && currTaxa < 0.3) inverted.push(parseInt(hour));
      });

      temporalCorrelation = {
        maintained,
        inverted,
        pattern: maintained.length > inverted.length ? 'Mantém' : 'Inverte'
      };
    }

    // ========================================
    // 5. EVENTOS RAROS E ANOMALIAS
    // ========================================
    const rareEvents = {
      highScoreAway: { count: 0, lastOccurrence: null, daysSince: 0 },
      draw33: { count: 0, lastOccurrence: null, daysSince: 0 },
      over60: { count: 0, lastOccurrence: null, daysSince: 0 }
    };

    const sortedDates = allDates.sort();
    sortedDates.forEach(date => {
      const dayMatches = matchesByDate[date] || [];
      dayMatches.forEach(m => {
        // Visitante com 5+ gols
        if (m.placarForaFT >= 5) {
          rareEvents.highScoreAway.count++;
          rareEvents.highScoreAway.lastOccurrence = date;
        }
        // Empate 3-3
        if (m.placarFT === '3-3') {
          rareEvents.draw33.count++;
          rareEvents.draw33.lastOccurrence = date;
        }
        // Over 6.0
        if (m.totalGolsFT > 6) {
          rareEvents.over60.count++;
          rareEvents.over60.lastOccurrence = date;
        }
      });
    });

    // Calcula dias desde última ocorrência
    Object.keys(rareEvents).forEach(event => {
      if (rareEvents[event].lastOccurrence) {
        const lastDate = parseISO(rareEvents[event].lastOccurrence);
        const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        rareEvents[event].daysSince = daysDiff;
      }
    });

    // Probabilidade de evento raro
    const rareEventProbability = Object.entries(rareEvents).map(([event, data]) => {
      let probability = 'baixa';
      let confidence = 'baixo';
      
      if (data.daysSince > 7 && data.count > 0) {
        probability = 'média';
        confidence = 'médio';
      }
      if (data.daysSince > 14) {
        probability = 'alta';
        confidence = 'alto';
      }

      return {
        event,
        ...data,
        probability,
        confidence
      };
    });

    // ========================================
    // 6. PREVISÃO FINAL PARA O PRÓXIMO DIA
    // ========================================
    const nextDayPrediction = {
      date: nextDate,
      predictions: []
    };

    // Previsão 1: Faixas horárias
    const predictedHours = topHoursRecent.slice(0, 3).map(h => ({
      hour: h.hour,
      confidence: h.taxa > 60 ? 'alto' : h.taxa > 40 ? 'médio' : 'baixo',
      reason: `${h.taxa.toFixed(0)}% de Over 3.5 nos últimos dias`
    }));

    nextDayPrediction.predictions.push({
      type: 'Horários Quentes',
      items: predictedHours,
      icon: Clock
    });

    // Previsão 2: Times/Ligas
    const predictedTeams = topTimesRecent.slice(0, 3).map(t => ({
      team: t.team,
      confidence: t.taxa > 70 ? 'alto' : t.taxa > 50 ? 'médio' : 'baixo',
      reason: `${t.over35}/${t.jogos} jogos com Over 3.5 (${t.taxa.toFixed(0)}%)`
    }));

    nextDayPrediction.predictions.push({
      type: 'Times Promissores',
      items: predictedTeams,
      icon: Target
    });

    // Previsão 3: Sequências
    const sequencePrediction = temporalCorrelation?.pattern === 'Mantém' ? {
      type: 'Padrão de Continuidade',
      items: [{
        description: 'Horários com Over tendem a manter padrão',
        hours: temporalCorrelation.maintained.join('h, ') + 'h',
        confidence: 'médio',
        reason: 'Correlação temporal detectada'
      }],
      icon: TrendingUp
    } : {
      type: 'Padrão de Inversão',
      items: [{
        description: 'Possível inversão de horários quentes',
        hours: temporalCorrelation?.inverted.join('h, ') + 'h' || 'A definir',
        confidence: 'baixo',
        reason: 'Histórico mostra alternância'
      }],
      icon: TrendingUp
    };

    nextDayPrediction.predictions.push(sequencePrediction);

    // Previsão 4: Eventos Raros
    const significantRareEvents = rareEventProbability.filter(e => 
      e.daysSince >= 7 || e.probability !== 'baixa'
    );

    if (significantRareEvents.length > 0) {
      nextDayPrediction.predictions.push({
        type: 'Alertas de Eventos Raros',
        items: significantRareEvents.map(e => ({
          event: e.event === 'highScoreAway' ? 'Visitante 5+ gols' :
                 e.event === 'draw33' ? 'Empate 3-3' : 'Over 6.0',
          daysSince: e.daysSince,
          probability: e.probability,
          confidence: e.confidence,
          reason: `${e.daysSince} dias desde última ocorrência`
        })),
        icon: AlertTriangle
      });
    }

    return {
      recentPatterns,
      topTimesRecent,
      topHoursRecent,
      topTeamJustification,
      biasPattern,
      temporalCorrelation,
      rareEvents: rareEventProbability,
      nextDayPrediction,
      confidenceScore: calculateOverallConfidence(predictedHours, predictedTeams)
    };
  }, [allMatches, currentDate]);

  // Função auxiliar para calcular confiança geral
  function calculateOverallConfidence(hours, teams) {
    const highConfCount = [...hours, ...teams].filter(i => i.confidence === 'alto').length;
    const total = hours.length + teams.length;
    const ratio = highConfCount / total;
    
    if (ratio > 0.6) return { level: 'alto', color: 'text-green-400', bgColor: 'bg-green-900/20' };
    if (ratio > 0.3) return { level: 'médio', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20' };
    return { level: 'baixo', color: 'text-red-400', bgColor: 'bg-red-900/20' };
  }

  if (!prediction) {
    return (
      <div className="text-center text-gray-500 py-8">
        Carregue mais dados históricos para previsões avançadas
      </div>
    );
  }

  const { nextDayPrediction, topTeamJustification, biasPattern, temporalCorrelation, confidenceScore } = prediction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-7 h-7 text-yellow-400 animate-pulse" />
        <div>
          <h2 className="text-3xl font-bold text-white">Previsão para o Próximo Dia</h2>
          <p className="text-gray-400 mt-1">
            {format(nextDayPrediction.date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Score de Confiança Geral */}
      <Card className={`${confidenceScore.bgColor} border-2 p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Nível de Confiança da Previsão</h3>
            <p className="text-sm text-gray-300">Baseado em padrões históricos e correlações detectadas</p>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${confidenceScore.color}`}>
              {confidenceScore.level.toUpperCase()}
            </div>
          </div>
        </div>
      </Card>

      {/* Previsões por Categoria */}
      {nextDayPrediction.predictions.map((pred, idx) => {
        const Icon = pred.icon;
        return (
          <Card key={idx} className="bg-gray-900/50 border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon className="w-6 h-6 text-blue-400" />
              <h3 className="text-xl font-bold text-white">{pred.type}</h3>
            </div>

            <div className="space-y-3">
              {pred.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white">
                      {item.hour !== undefined && `${String(item.hour).padStart(2, '0')}:00`}
                      {item.team && item.team}
                      {item.description && item.description}
                      {item.event && item.event}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.confidence === 'alto' || item.probability === 'alta' ? 'bg-green-600 text-white' :
                      item.confidence === 'médio' || item.probability === 'média' ? 'bg-yellow-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {item.confidence ? `Confiança: ${item.confidence}` : 
                       item.probability ? `Prob: ${item.probability}` : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {item.reason}
                    {item.hours && ` (${item.hours})`}
                    {item.daysSince !== undefined && ` | Há ${item.daysSince} dias`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Análise do Time Top 1 */}
      {topTeamJustification && (
        <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold text-white">Por que {topTeamJustification.team} está no topo?</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Taxa de Over 3.5</p>
              <p className="text-2xl font-bold text-yellow-400">{topTeamJustification.taxa.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Odds Média</p>
              <p className="text-2xl font-bold text-blue-400">{topTeamJustification.avgOdds}</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Correlação HT/FT</p>
              <p className="text-2xl font-bold text-green-400">{topTeamJustification.htFtCorrelation}%</p>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Partidas</p>
              <p className="text-2xl font-bold text-white">{topTeamJustification.matches}</p>
            </div>
          </div>

          <p className="text-sm text-yellow-300">
            <strong>Justificativa:</strong> {topTeamJustification.characteristics}
            {parseFloat(topTeamJustification.htFtCorrelation) > 60 && ' - Quando marca 2+ no HT, tende a bater Over 3.5'}
          </p>
        </Card>
      )}

      {/* Viés de RNG Detectado */}
      {biasPattern.length > 0 && (
        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Viés de RNG e Padrões Diários</h3>
          </div>

          <div className="space-y-2">
            {biasPattern.map((bias, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded p-3">
                <span className="text-gray-300">{format(parseISO(bias.date), "dd/MM", { locale: ptBR })}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">Taxa: {bias.taxa.toFixed(1)}%</span>
                  {bias.hour && (
                    <span className="text-sm text-purple-400">Hora dominante: {bias.hour}h</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-purple-300 mt-4">
            <strong>Padrão detectado:</strong> {
              biasPattern.every(b => b.hour === biasPattern[0].hour) 
                ? `Horário ${biasPattern[0].hour}h consistentemente favorecido`
                : 'Horários variam dia a dia - padrão não determinístico'
            }
          </p>
        </Card>
      )}

      {/* Correlação Temporal */}
      {temporalCorrelation && (
        <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">Correlação com Dia Anterior</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded p-4">
              <p className="text-sm text-gray-400 mb-2">Horários que Mantiveram Over</p>
              <p className="text-lg font-bold text-green-400">
                {temporalCorrelation.maintained.length > 0 
                  ? temporalCorrelation.maintained.map(h => `${h}h`).join(', ')
                  : 'Nenhum'}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded p-4">
              <p className="text-sm text-gray-400 mb-2">Horários que Inverteram</p>
              <p className="text-lg font-bold text-red-400">
                {temporalCorrelation.inverted.length > 0 
                  ? temporalCorrelation.inverted.map(h => `${h}h`).join(', ')
                  : 'Nenhum'}
              </p>
            </div>
          </div>

          <p className="text-sm text-cyan-300 mt-4">
            <strong>Previsão:</strong> {temporalCorrelation.pattern === 'Mantém' 
              ? 'Horários com Over tendem a se manter no próximo dia'
              : 'Provável inversão - horários com Over podem esfriar'}
          </p>
        </Card>
      )}
    </div>
  );
};

export default AdvancedPrediction;
