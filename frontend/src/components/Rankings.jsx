import React from 'react';
import { Trophy, TrendingUp, Target } from 'lucide-react';

const Rankings = ({ matches }) => {
  // Calcula rankings baseados nas partidas do dia
  const calculateRankings = () => {
    const teamStats = {};

    matches.forEach(match => {
      const { timeCasa, timeFora, totalGolsFT } = match;

      // Inicializa stats dos times
      if (!teamStats[timeCasa]) {
        teamStats[timeCasa] = { team: timeCasa, over35: 0, over45: 0, total: 0, scores: [] };
      }
      if (!teamStats[timeFora]) {
        teamStats[timeFora] = { team: timeFora, over35: 0, over45: 0, total: 0, scores: [] };
      }

      // Incrementa contadores
      teamStats[timeCasa].total++;
      teamStats[timeFora].total++;

      if (totalGolsFT > 3.5) {
        teamStats[timeCasa].over35++;
        teamStats[timeFora].over35++;
        teamStats[timeCasa].scores.push(match.placarFT);
        teamStats[timeFora].scores.push(match.placarFT);
      }

      if (totalGolsFT > 4.5) {
        teamStats[timeCasa].over45++;
        teamStats[timeFora].over45++;
      }
    });

    const teams = Object.values(teamStats);

    // Top 10 Over 3.5
    const top10Over35 = teams
      .filter(t => t.over35 > 0)
      .sort((a, b) => b.over35 - a.over35)
      .slice(0, 10)
      .map(t => ({
        ...t,
        percentage: ((t.over35 / t.total) * 100).toFixed(1)
      }));

    // Top 10 Over 4.5
    const top10Over45 = teams
      .filter(t => t.over45 > 0)
      .sort((a, b) => b.over45 - a.over45)
      .slice(0, 10)
      .map(t => ({
        ...t,
        percentage: ((t.over45 / t.total) * 100).toFixed(1)
      }));

    // Top 5 com mais Over 3.5
    const top5MostOver = teams
      .filter(t => t.over35 > 0)
      .sort((a, b) => b.over35 - a.over35)
      .slice(0, 5);

    return { top10Over35, top10Over45, top5MostOver };
  };

  const { top10Over35, top10Over45, top5MostOver } = calculateRankings();

  const RankingCard = ({ title, icon: Icon, data, type }) => (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum dado disponível para esta data</p>
      ) : (
        <div className="space-y-2">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-gray-800 rounded hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 font-bold text-lg w-6">
                  {idx + 1}º
                </span>
                <span className="font-medium text-white">{item.team}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {type === 'mostOver' ? (
                  <>
                    <span className="text-green-400 font-semibold">
                      {item.over35} jogos
                    </span>
                    <span className="text-gray-400">
                      ({item.scores.join(', ')})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-green-400 font-semibold">
                      {type === 'over35' ? item.over35 : item.over45} overs
                    </span>
                    <span className="text-gray-400">
                      ({item.percentage}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Rankings do Dia</h2>
      
      {/* Top 5 com Mais Over 3.5 - Destaque */}
      <RankingCard
        title="Top 5 com Mais Over 3.5"
        icon={Target}
        data={top5MostOver}
        type="mostOver"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Over 3.5 */}
        <RankingCard
          title="Top 10 Over 3.5"
          icon={Trophy}
          data={top10Over35}
          type="over35"
        />

        {/* Top 10 Over 4.5 */}
        <RankingCard
          title="Top 10 Over 4.5"
          icon={TrendingUp}
          data={top10Over45}
          type="over45"
        />
      </div>
    </div>
  );
};

export default Rankings;