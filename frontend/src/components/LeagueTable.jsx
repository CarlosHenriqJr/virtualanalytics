import React, { useMemo, useState } from 'react';
import { Trophy, TrendingUp, Target } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

const LeagueTable = ({ matches }) => {
  const [sortBy, setSortBy] = useState('points');

  const standings = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    const teams = {};

    matches.forEach(match => {
      const { timeCasa, timeFora, placarCasaFT, placarForaFT, totalGolsFT } = match;

      // Inicializa times
      if (!teams[timeCasa]) {
        teams[timeCasa] = {
          team: timeCasa,
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          over35: 0,
          over45: 0
        };
      }
      if (!teams[timeFora]) {
        teams[timeFora] = {
          team: timeFora,
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          over35: 0,
          over45: 0
        };
      }

      // Atualiza estatísticas
      teams[timeCasa].played++;
      teams[timeFora].played++;

      teams[timeCasa].goalsFor += placarCasaFT;
      teams[timeCasa].goalsAgainst += placarForaFT;
      teams[timeFora].goalsFor += placarForaFT;
      teams[timeFora].goalsAgainst += placarCasaFT;

      // Resultado
      if (placarCasaFT > placarForaFT) {
        teams[timeCasa].wins++;
        teams[timeCasa].points += 3;
        teams[timeFora].losses++;
      } else if (placarCasaFT < placarForaFT) {
        teams[timeFora].wins++;
        teams[timeFora].points += 3;
        teams[timeCasa].losses++;
      } else {
        teams[timeCasa].draws++;
        teams[timeFora].draws++;
        teams[timeCasa].points += 1;
        teams[timeFora].points += 1;
      }

      // Over 3.5 e 4.5
      if (totalGolsFT > 3.5) {
        teams[timeCasa].over35++;
        teams[timeFora].over35++;
      }
      if (totalGolsFT > 4.5) {
        teams[timeCasa].over45++;
        teams[timeFora].over45++;
      }

      // Saldo de gols
      teams[timeCasa].goalDiff = teams[timeCasa].goalsFor - teams[timeCasa].goalsAgainst;
      teams[timeFora].goalDiff = teams[timeFora].goalsFor - teams[timeFora].goalsAgainst;
    });

    // Converte para array e ordena
    let standingsArray = Object.values(teams);

    // Ordenação
    switch (sortBy) {
      case 'points':
        standingsArray.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
          return b.goalsFor - a.goalsFor;
        });
        break;
      case 'over35':
        standingsArray.sort((a, b) => b.over35 - a.over35);
        break;
      case 'over45':
        standingsArray.sort((a, b) => b.over45 - a.over45);
        break;
      case 'goalDiff':
        standingsArray.sort((a, b) => b.goalDiff - a.goalDiff);
        break;
      case 'goalsFor':
        standingsArray.sort((a, b) => b.goalsFor - a.goalsFor);
        break;
      default:
        break;
    }

    return standingsArray;
  }, [matches, sortBy]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-7 h-7 text-yellow-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Tabela de Classificação</h2>
            <p className="text-sm text-gray-400">Estatísticas completas por time no dia selecionado</p>
          </div>
        </div>

        {/* Filtros de Ordenação */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-400 mr-2">Ordenar por:</span>
          <Button
            onClick={() => setSortBy('points')}
            size="sm"
            className={sortBy === 'points' ? 'bg-yellow-600' : 'bg-gray-700'}
          >
            Pontos
          </Button>
          <Button
            onClick={() => setSortBy('over35')}
            size="sm"
            className={sortBy === 'over35' ? 'bg-green-600' : 'bg-gray-700'}
          >
            Over 3.5
          </Button>
          <Button
            onClick={() => setSortBy('over45')}
            size="sm"
            className={sortBy === 'over45' ? 'bg-blue-600' : 'bg-gray-700'}
          >
            Over 4.5
          </Button>
          <Button
            onClick={() => setSortBy('goalDiff')}
            size="sm"
            className={sortBy === 'goalDiff' ? 'bg-purple-600' : 'bg-gray-700'}
          >
            Saldo de Gols
          </Button>
          <Button
            onClick={() => setSortBy('goalsFor')}
            size="sm"
            className={sortBy === 'goalsFor' ? 'bg-orange-600' : 'bg-gray-700'}
          >
            Gols Marcados
          </Button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-3 text-gray-400 font-semibold">#</th>
                <th className="text-left p-3 text-gray-400 font-semibold">Time</th>
                <th className="text-center p-3 text-gray-400 font-semibold">PTS</th>
                <th className="text-center p-3 text-gray-400 font-semibold">J</th>
                <th className="text-center p-3 text-gray-400 font-semibold">V</th>
                <th className="text-center p-3 text-gray-400 font-semibold">E</th>
                <th className="text-center p-3 text-gray-400 font-semibold">D</th>
                <th className="text-center p-3 text-gray-400 font-semibold">GP</th>
                <th className="text-center p-3 text-gray-400 font-semibold">GC</th>
                <th className="text-center p-3 text-gray-400 font-semibold">SG</th>
                <th className="text-center p-3 text-gray-400 font-semibold">O3.5</th>
                <th className="text-center p-3 text-gray-400 font-semibold">O4.5</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, idx) => (
                <tr
                  key={team.team}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    idx < 3 ? 'bg-green-900/10' : 
                    idx >= standings.length - 3 ? 'bg-red-900/10' : ''
                  }`}
                >
                  <td className="p-3">
                    <span className={`font-bold ${
                      idx === 0 ? 'text-yellow-400' :
                      idx === 1 ? 'text-gray-300' :
                      idx === 2 ? 'text-orange-400' :
                      'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                      <span className="font-semibold text-white">{team.team}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-bold text-yellow-400 text-base">{team.points}</span>
                  </td>
                  <td className="p-3 text-center text-gray-300">{team.played}</td>
                  <td className="p-3 text-center text-green-400">{team.wins}</td>
                  <td className="p-3 text-center text-gray-400">{team.draws}</td>
                  <td className="p-3 text-center text-red-400">{team.losses}</td>
                  <td className="p-3 text-center text-blue-400">{team.goalsFor}</td>
                  <td className="p-3 text-center text-red-300">{team.goalsAgainst}</td>
                  <td className="p-3 text-center">
                    <span className={`font-semibold ${
                      team.goalDiff > 0 ? 'text-green-400' :
                      team.goalDiff < 0 ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {team.goalDiff > 0 ? '+' : ''}{team.goalDiff}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-bold text-green-500">{team.over35}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({((team.over35 / team.played) * 100).toFixed(0)}%)
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-bold text-blue-500">{team.over45}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({((team.over45 / team.played) * 100).toFixed(0)}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {standings.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Nenhum dado disponível para criar tabela
          </div>
        )}
      </Card>

      {/* Top 5 em Categorias */}
      {standings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Melhor Ataque */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-orange-400" />
              <h3 className="font-bold text-white">Melhor Ataque</h3>
            </div>
            <div className="space-y-2">
              {[...standings]
                .sort((a, b) => b.goalsFor - a.goalsFor)
                .slice(0, 5)
                .map((team, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{idx + 1}. {team.team}</span>
                    <span className="font-bold text-orange-400">{team.goalsFor}</span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Mais Over 3.5 */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="font-bold text-white">Mais Over 3.5</h3>
            </div>
            <div className="space-y-2">
              {[...standings]
                .sort((a, b) => b.over35 - a.over35)
                .slice(0, 5)
                .map((team, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{idx + 1}. {team.team}</span>
                    <span className="font-bold text-green-400">
                      {team.over35} ({((team.over35/team.played)*100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Mais Over 4.5 */}
          <Card className="bg-gray-900/50 border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white">Mais Over 4.5</h3>
            </div>
            <div className="space-y-2">
              {[...standings]
                .sort((a, b) => b.over45 - a.over45)
                .slice(0, 5)
                .map((team, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{idx + 1}. {team.team}</span>
                    <span className="font-bold text-blue-400">
                      {team.over45} ({((team.over45/team.played)*100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LeagueTable;
