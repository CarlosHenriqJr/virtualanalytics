import React, { useMemo } from 'react';
import { Grid3x3, Users, TrendingUp, Clock } from 'lucide-react';
import { Card } from './ui/card';

const PatternAnalysis = ({ matches }) => {
  const patterns = useMemo(() => {
    if (!matches || matches.length === 0) return null;

    // 1. Análise de Clusters Temporais
    const hourClusters = {};
    matches.forEach(match => {
      const hour = match.hour;
      if (!hourClusters[hour]) {
        hourClusters[hour] = { total: 0, over35: 0, over45: 0 };
      }
      hourClusters[hour].total++;
      if (match.totalGolsFT > 3.5) hourClusters[hour].over35++;
      if (match.totalGolsFT > 4.5) hourClusters[hour].over45++;
    });

    const topHours = Object.entries(hourClusters)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        ...stats,
        taxaOver35: (stats.over35 / stats.total) * 100
      }))
      .sort((a, b) => b.taxaOver35 - a.taxaOver35)
      .slice(0, 5);

    // 2. Análise de Confrontos Diretos
    const confrontos = {};
    matches.forEach(match => {
      const key = [match.timeCasa, match.timeFora].sort().join(' vs ');
      if (!confrontos[key]) {
        confrontos[key] = { jogos: 0, over35: 0, gols: [] };
      }
      confrontos[key].jogos++;
      confrontos[key].gols.push(match.totalGolsFT);
      if (match.totalGolsFT > 3.5) confrontos[key].over35++;
    });

    const topConfrontos = Object.entries(confrontos)
      .filter(([_, stats]) => stats.jogos >= 2) // Mínimo 2 jogos
      .map(([confronto, stats]) => ({
        confronto,
        ...stats,
        mediaGols: stats.gols.reduce((a, b) => a + b, 0) / stats.gols.length,
        taxaOver35: (stats.over35 / stats.jogos) * 100
      }))
      .sort((a, b) => b.taxaOver35 - a.taxaOver35)
      .slice(0, 5);

    // 3. Análise de Correlação de Odds
    const oddsAnalysis = [];
    matches.forEach(match => {
      if (match.markets?.TotalGols_MaisDe_35) {
        const odd = match.markets.TotalGols_MaisDe_35;
        const bateu = match.totalGolsFT > 3.5;
        
        // Agrupa odds em faixas
        let faixa;
        if (odd < 2) faixa = '< 2.0';
        else if (odd < 3) faixa = '2.0-3.0';
        else if (odd < 4) faixa = '3.0-4.0';
        else if (odd < 5) faixa = '4.0-5.0';
        else faixa = '> 5.0';

        const existing = oddsAnalysis.find(o => o.faixa === faixa);
        if (existing) {
          existing.total++;
          if (bateu) existing.acertos++;
        } else {
          oddsAnalysis.push({
            faixa,
            total: 1,
            acertos: bateu ? 1 : 0
          });
        }
      }
    });

    oddsAnalysis.forEach(o => {
      o.taxaAcerto = (o.acertos / o.total) * 100;
    });

    // 4. Análise de Placares Específicos
    const placarPatterns = {};
    matches.forEach(match => {
      const placar = match.placarFT;
      if (!placarPatterns[placar]) {
        placarPatterns[placar] = { count: 0, over35: 0 };
      }
      placarPatterns[placar].count++;
      if (match.totalGolsFT > 3.5) placarPatterns[placar].over35++;
    });

    const topPlacares = Object.entries(placarPatterns)
      .map(([placar, stats]) => ({
        placar,
        ...stats,
        frequencia: (stats.count / matches.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 5. Análise de Sequências (Clusters tipo Tetris)
    const sequences = [];
    let currentSequence = { start: null, end: null, count: 0, matches: [] };
    
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    sortedMatches.forEach((match, index) => {
      if (match.totalGolsFT > 3.5) {
        if (currentSequence.count === 0) {
          currentSequence.start = `${match.hour}:${String(match.minute).padStart(2, '0')}`;
        }
        currentSequence.count++;
        currentSequence.end = `${match.hour}:${String(match.minute).padStart(2, '0')}`;
        currentSequence.matches.push(match);
      } else {
        if (currentSequence.count >= 2) { // Mínimo 2 jogos consecutivos
          sequences.push({ ...currentSequence });
        }
        currentSequence = { start: null, end: null, count: 0, matches: [] };
      }
    });

    // Adiciona última sequência se válida
    if (currentSequence.count >= 2) {
      sequences.push(currentSequence);
    }

    return {
      topHours,
      topConfrontos,
      oddsAnalysis: oddsAnalysis.sort((a, b) => b.taxaAcerto - a.taxaAcerto),
      topPlacares,
      sequences: sequences.sort((a, b) => b.count - a.count).slice(0, 5)
    };
  }, [matches]);

  if (!patterns) {
    return (
      <div className="text-center text-gray-500 py-8">
        Selecione uma data para ver análise de padrões
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Grid3x3 className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">Análise de Padrões</h2>
        <p className="text-sm text-gray-400">Entenda como se formam os "blocos" de Over 3.5</p>
      </div>

      {/* Clusters Temporais */}
      <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Horários com Mais Over 3.5</h3>
        </div>
        
        <div className="space-y-3">
          {patterns.topHours.map((hour, idx) => (
            <div key={hour.hour} className="flex items-center gap-4 bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-cyan-400 w-16">
                {String(hour.hour).padStart(2, '0')}h
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-300">
                    {hour.over35} de {hour.total} jogos
                  </span>
                  <span className="text-sm font-bold text-green-400">
                    {hour.taxaOver35.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${hour.taxaOver35}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-cyan-900/20 border border-cyan-500/30 rounded p-3">
          <p className="text-sm text-cyan-300">
            <strong>Insight:</strong> Partidas em certos horários têm maior probabilidade de Over 3.5.
            Isso pode estar relacionado ao algoritmo de geração das partidas virtuais.
          </p>
        </div>
      </Card>

      {/* Confrontos Diretos */}
      <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Confrontos com Padrão de Over</h3>
        </div>

        <div className="space-y-3">
          {patterns.topConfrontos.map((confronto, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-white">{confronto.confronto}</h4>
                <span className="text-lg font-bold text-orange-400">
                  {confronto.taxaOver35.toFixed(0)}%
                </span>
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <span>{confronto.jogos} jogos</span>
                <span>Média: {confronto.mediaGols.toFixed(2)} gols</span>
                <span className="text-green-400">{confronto.over35} Overs</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-orange-900/20 border border-orange-500/30 rounded p-3">
          <p className="text-sm text-orange-300">
            <strong>Insight:</strong> Certos confrontos tendem a ter mais gols. Isso pode ser devido
            a estilos de jogo complementares ou parâmetros específicos do jogo virtual.
          </p>
        </div>
      </Card>

      {/* Análise de Odds */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Correlação: Odds vs Resultado Real</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.oddsAnalysis.map((odd, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-purple-400 mb-2">
                Odd {odd.faixa}
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {odd.taxaAcerto.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">
                {odd.acertos}/{odd.total} bateram
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-purple-900/20 border border-purple-500/30 rounded p-3">
          <p className="text-sm text-purple-300">
            <strong>Insight:</strong> Odds mais baixas (&lt; 2.0) geralmente indicam maior probabilidade
            de Over 3.5. Use isso para identificar oportunidades de valor.
          </p>
        </div>
      </Card>

      {/* Sequências (Efeito Tetris) */}
      <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Grid3x3 className="w-5 h-5 text-green-400" />
          <h3 className="text-xl font-bold text-white">Clusters Temporais ("Efeito Tetris")</h3>
        </div>

        <div className="space-y-4">
          {patterns.sequences.map((seq, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-green-400 font-bold text-lg">{seq.count} Overs</span>
                  <span className="text-gray-400 text-sm ml-2">consecutivos</span>
                </div>
                <div className="text-sm text-gray-400">
                  {seq.start} → {seq.end}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {seq.matches.map((m, i) => (
                  <div
                    key={i}
                    className="bg-green-600/30 border border-green-500 rounded px-2 py-1 text-xs"
                    title={`${m.timeCasa} vs ${m.timeFora}: ${m.placarFT}`}
                  >
                    {m.placarFT} ({m.totalGolsFT})
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded p-3">
          <p className="text-sm text-green-300">
            <strong>Por que formam blocos?</strong> Possíveis causas:
          </p>
          <ul className="text-xs text-gray-300 mt-2 space-y-1 ml-4">
            <li>• <strong>Algoritmo de geração:</strong> O sistema pode gerar partidas com parâmetros similares em sequência</li>
            <li>• <strong>Horário:</strong> Certos períodos podem ter configurações diferentes</li>
            <li>• <strong>Times consecutivos:</strong> Mesmos times jogando em sequência mantêm características</li>
            <li>• <strong>Seeds/RNG:</strong> Gerador de números aleatórios pode criar padrões temporários</li>
          </ul>
        </div>
      </Card>

      {/* Placares Mais Comuns */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Placares Mais Frequentes</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {patterns.topPlacares.map((placar, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-3 text-center ${
                placar.over35 > 0 ? 'bg-green-900/30 border border-green-500' : 'bg-gray-800/50 border border-gray-700'
              }`}
            >
              <div className="text-xl font-bold text-white mb-1">
                {placar.placar}
              </div>
              <div className="text-xs text-gray-400">
                {placar.count}x ({placar.frequencia.toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PatternAnalysis;
