import React, { useMemo } from 'react';
import { TrendingUp, Target, Award, Brain } from 'lucide-react';
import { Card } from './ui/card';

const PredictiveAnalysis = ({ allMatches, currentDate }) => {
  const analysis = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return null;

    // Agrupa por time e calcula estatísticas
    const teamStats = {};

    allMatches.forEach(match => {
      const { timeCasa, timeFora, totalGolsFT, date } = match;

      // Inicializa stats
      [timeCasa, timeFora].forEach(team => {
        if (!teamStats[team]) {
          teamStats[team] = {
            team,
            jogos: 0,
            gols: 0,
            over35: 0,
            over45: 0,
            jogosRecentes: [],
            mediaGols: 0,
            tendencia: 0,
            score: 0
          };
        }
      });

      // Atualiza contadores
      teamStats[timeCasa].jogos++;
      teamStats[timeFora].jogos++;
      teamStats[timeCasa].gols += match.placarCasaFT;
      teamStats[timeFora].gols += match.placarForaFT;

      if (totalGolsFT > 3.5) {
        teamStats[timeCasa].over35++;
        teamStats[timeFora].over35++;
      }

      if (totalGolsFT > 4.5) {
        teamStats[timeCasa].over45++;
        teamStats[timeFora].over45++;
      }

      // Armazena jogos recentes (últimos 10)
      [timeCasa, timeFora].forEach(team => {
        teamStats[team].jogosRecentes.push({
          date,
          gols: totalGolsFT,
          over35: totalGolsFT > 3.5
        });
      });
    });

    // Calcula métricas avançadas
    Object.values(teamStats).forEach(stats => {
      // Média de gols
      stats.mediaGols = stats.gols / stats.jogos;

      // Taxa de Over 3.5
      stats.taxaOver35 = (stats.over35 / stats.jogos) * 100;

      // Mantém apenas últimos 10 jogos
      stats.jogosRecentes = stats.jogosRecentes
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      // Calcula tendência (últimos 5 vs primeiros 5 dos recentes)
      if (stats.jogosRecentes.length >= 10) {
        const ultimos5 = stats.jogosRecentes.slice(0, 5);
        const primeiros5 = stats.jogosRecentes.slice(5, 10);
        
        const mediaUltimos = ultimos5.reduce((acc, j) => acc + j.gols, 0) / 5;
        const mediaPrimeiros = primeiros5.reduce((acc, j) => acc + j.gols, 0) / 5;
        
        stats.tendencia = ((mediaUltimos - mediaPrimeiros) / mediaPrimeiros) * 100;
      }

      // Score preditivo (0-100)
      stats.score = (
        (stats.mediaGols / 6) * 30 + // 30% peso média de gols
        (stats.taxaOver35 / 100) * 40 + // 40% peso taxa over
        (Math.max(0, stats.tendencia) / 100) * 30 // 30% peso tendência
      ) * 100;
    });

    // Top 3 previsões para próximos jogos
    const predictions = Object.values(teamStats)
      .filter(s => s.jogos >= 5) // Mínimo de 5 jogos
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      teamStats: Object.values(teamStats),
      predictions,
      totalGames: allMatches.length
    };
  }, [allMatches]);

  if (!analysis) {
    return (
      <div className="text-center text-gray-500 py-8">
        Carregue dados para ver análises preditivas
      </div>
    );
  }

  const { predictions } = analysis;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Brain className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-white">Análise Preditiva</h2>
      </div>

      {/* Top 3 Previsões */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-purple-400" />
          <h3 className="text-xl font-bold text-white">
            Top 3 Times com Maior Probabilidade de Over 3.5
          </h3>
        </div>

        <div className="space-y-4">
          {predictions.map((pred, idx) => (
            <div
              key={pred.team}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-lg">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{pred.team}</h4>
                    <p className="text-sm text-gray-400">
                      {pred.jogos} jogos analisados
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400">
                    {pred.score.toFixed(1)}
                  </div>
                  <p className="text-xs text-gray-400">Score Preditivo</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Média de Gols</p>
                  <p className="text-lg font-bold text-green-400">
                    {pred.mediaGols.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Taxa Over 3.5</p>
                  <p className="text-lg font-bold text-blue-400">
                    {pred.taxaOver35.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Tendência</p>
                  <p className={`text-lg font-bold ${
                    pred.tendencia > 0 ? 'text-green-400' : 
                    pred.tendencia < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {pred.tendencia > 0 ? '↑' : pred.tendencia < 0 ? '↓' : '→'} 
                    {Math.abs(pred.tendencia).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Últimos 5 jogos */}
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Últimos 5 Jogos:</p>
                <div className="flex gap-1">
                  {pred.jogosRecentes.slice(0, 5).map((jogo, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        jogo.over35 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 text-gray-400'
                      }`}
                      title={`${jogo.gols} gols`}
                    >
                      {jogo.gols}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recomendação */}
              <div className="mt-4 bg-purple-900/20 border border-purple-500/30 rounded p-3">
                <p className="text-sm text-purple-300">
                  <strong>Recomendação:</strong>{' '}
                  {pred.score > 70 ? (
                    <span className="text-green-400">Alta probabilidade de Over 3.5 nos próximos jogos</span>
                  ) : pred.score > 50 ? (
                    <span className="text-yellow-400">Probabilidade moderada de Over 3.5</span>
                  ) : (
                    <span className="text-gray-400">Probabilidade baixa de Over 3.5</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Metodologia */}
      <Card className="bg-gray-900/50 border-gray-800 p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">
          📊 Metodologia da Análise
        </h4>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• <strong>Score Preditivo:</strong> Combinação de média de gols (30%), taxa de Over 3.5 (40%) e tendência recente (30%)</p>
          <p>• <strong>Tendência:</strong> Compara últimos 5 jogos vs jogos anteriores para identificar mudanças de performance</p>
          <p>• <strong>Mínimo:</strong> Apenas times com 5+ jogos são incluídos para maior confiabilidade</p>
        </div>
      </Card>
    </div>
  );
};

export default PredictiveAnalysis;
