import React, { useMemo, useState } from 'react';
import { Blocks, Search, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

const PatternDetector = ({ matches }) => {
  const [selectedPattern, setSelectedPattern] = useState(null);

  const analysis = useMemo(() => {
    if (!matches || matches.length === 0) return null;

    // Ordena partidas por hora e minuto
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    // ========================================
    // 1. DETECTA PADRÕES SEQUENCIAIS
    // ========================================
    const detectedPatterns = [];
    
    // Define tipos de padrões para detectar
    const patternTypes = [
      {
        name: 'Alternado (Over-Under-Over)',
        sequence: ['over', 'under', 'over'],
        minLength: 3
      },
      {
        name: 'Alternado Invertido (Under-Over-Under)',
        sequence: ['under', 'over', 'under'],
        minLength: 3
      },
      {
        name: 'Bloco de Overs (3+)',
        sequence: ['over', 'over', 'over'],
        minLength: 3
      },
      {
        name: 'Bloco de Unders (3+)',
        sequence: ['under', 'under', 'under'],
        minLength: 3
      },
      {
        name: 'Over-Under-Over Espaçado',
        sequence: ['over', 'any', 'under', 'any', 'over'],
        minLength: 5
      }
    ];

    // Função para verificar se match é over ou under
    const getOverUnder = (match) => match.totalGolsFT > 3.5 ? 'over' : 'under';

    // Busca padrões na sequência
    for (let i = 0; i < sortedMatches.length - 2; i++) {
      for (const patternType of patternTypes) {
        const sequence = [];
        let matchIndex = i;
        let valid = true;

        // Tenta construir a sequência do padrão
        for (let j = 0; j < patternType.sequence.length && matchIndex < sortedMatches.length; j++) {
          const match = sortedMatches[matchIndex];
          const expected = patternType.sequence[j];
          const actual = getOverUnder(match);

          if (expected === 'any' || expected === actual) {
            sequence.push({
              match,
              index: matchIndex,
              type: actual
            });
            matchIndex++;
          } else {
            valid = false;
            break;
          }
        }

        // Se encontrou padrão válido
        if (valid && sequence.length >= patternType.minLength) {
          // Analisa contexto ANTES do padrão começar
          const contextBefore = i > 0 ? sortedMatches.slice(Math.max(0, i - 3), i) : [];
          
          // Calcula "assinatura" do padrão
          const signature = {
            // Odds médias antes do padrão
            avgOddsBefore: contextBefore.reduce((acc, m) => 
              acc + (m.markets?.TotalGols_MaisDe_35 || 0), 0
            ) / (contextBefore.length || 1),
            
            // Times envolvidos no início do padrão
            teamsInvolved: sequence.slice(0, 3).flatMap(s => [s.match.timeCasa, s.match.timeFora]),
            
            // Padrão de HT antes
            htPattern: contextBefore.map(m => m.placarCasaHT + m.placarForaHT),
            
            // Taxa de Over nos 3 jogos anteriores
            priorOverRate: contextBefore.filter(m => m.totalGolsFT > 3.5).length / (contextBefore.length || 1),
            
            // Horário de início
            startHour: sequence[0].match.hour,
            startMinute: sequence[0].match.minute,
            
            // Sequência de placares no padrão
            scoreSequence: sequence.map(s => s.match.placarFT),
            
            // Odds médias DURANTE o padrão
            avgOddsDuring: sequence.reduce((acc, s) => 
              acc + (s.match.markets?.TotalGols_MaisDe_35 || 0), 0
            ) / sequence.length
          };

          detectedPatterns.push({
            type: patternType.name,
            sequence,
            signature,
            startTime: `${sequence[0].match.hour}:${String(sequence[0].match.minute).padStart(2, '0')}`,
            endTime: `${sequence[sequence.length - 1].match.hour}:${String(sequence[sequence.length - 1].match.minute).padStart(2, '0')}`
          });

          // Pula para depois do padrão para evitar overlap
          i = matchIndex - 1;
          break;
        }
      }
    }

    // ========================================
    // 2. AGRUPA PADRÕES POR TIPO
    // ========================================
    const patternGroups = {};
    detectedPatterns.forEach(pattern => {
      if (!patternGroups[pattern.type]) {
        patternGroups[pattern.type] = {
          patterns: [],
          signatures: []
        };
      }
      patternGroups[pattern.type].patterns.push(pattern);
      patternGroups[pattern.type].signatures.push(pattern.signature);
    });

    // ========================================
    // 3. IDENTIFICA CARACTERÍSTICAS COMUNS
    // ========================================
    const commonCharacteristics = {};
    Object.entries(patternGroups).forEach(([type, group]) => {
      const signatures = group.signatures;
      
      commonCharacteristics[type] = {
        count: signatures.length,
        
        // Odds médias antes do padrão (média de todas ocorrências)
        avgOddsBefore: signatures.reduce((acc, s) => acc + s.avgOddsBefore, 0) / signatures.length,
        
        // Odds médias durante o padrão
        avgOddsDuring: signatures.reduce((acc, s) => acc + s.avgOddsDuring, 0) / signatures.length,
        
        // Taxa média de Over antes
        avgPriorOverRate: signatures.reduce((acc, s) => acc + s.priorOverRate, 0) / signatures.length,
        
        // Horários mais comuns
        commonHours: [...new Set(signatures.map(s => s.startHour))]
          .map(hour => ({
            hour,
            frequency: signatures.filter(s => s.startHour === hour).length
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3),
        
        // Times mais frequentes
        topTeams: signatures
          .flatMap(s => s.teamsInvolved)
          .reduce((acc, team) => {
            acc[team] = (acc[team] || 0) + 1;
            return acc;
          }, {}),
        
        // Padrão de placares
        scorePatterns: signatures.map(s => s.scoreSequence.join(' → '))
      };
    });

    // ========================================
    // 4. PREVISÃO: QUANDO PRÓXIMO PADRÃO VAI OCORRER
    // ========================================
    const predictions = Object.entries(commonCharacteristics).map(([type, chars]) => {
      // Analisa últimas 3 partidas para ver se assinatura está presente
      const recentMatches = sortedMatches.slice(-3);
      const recentOdds = recentMatches.reduce((acc, m) => 
        acc + (m.markets?.TotalGols_MaisDe_35 || 0), 0
      ) / 3;
      const recentOverRate = recentMatches.filter(m => m.totalGolsFT > 3.5).length / 3;

      // Calcula "distância" entre situação atual e assinatura do padrão
      const oddsDifference = Math.abs(recentOdds - chars.avgOddsBefore);
      const overRateDifference = Math.abs(recentOverRate - chars.avgPriorOverRate);
      
      // Score de proximidade (0-100, quanto maior mais próximo)
      const proximityScore = Math.max(0, 100 - (oddsDifference * 20 + overRateDifference * 50));
      
      let likelihood = 'baixa';
      let confidence = 'baixo';
      if (proximityScore > 70) {
        likelihood = 'alta';
        confidence = 'alto';
      } else if (proximityScore > 40) {
        likelihood = 'média';
        confidence = 'médio';
      }

      return {
        type,
        characteristics: chars,
        proximityScore: proximityScore.toFixed(1),
        likelihood,
        confidence,
        suggestion: proximityScore > 70 
          ? `Condições favoráveis! Padrão pode iniciar nos próximos ${chars.commonHours[0]?.hour}h`
          : proximityScore > 40
          ? 'Monitore as próximas partidas para confirmar tendência'
          : 'Condições ainda não alinhadas para este padrão'
      };
    });

    return {
      detectedPatterns,
      patternGroups,
      commonCharacteristics,
      predictions: predictions.sort((a, b) => b.proximityScore - a.proximityScore)
    };
  }, [matches]);

  if (!analysis) {
    return (
      <div className="text-center text-gray-500 py-8">
        Selecione uma data para detectar padrões temporais
      </div>
    );
  }

  const { detectedPatterns, patternGroups, predictions } = analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Blocks className="w-7 h-7 text-pink-400 animate-pulse" />
        <div>
          <h2 className="text-3xl font-bold text-white">Detector de Padrões Temporais</h2>
          <p className="text-gray-400 mt-1">
            Análise de sequências Over/Under e previsão de blocos
          </p>
        </div>
      </div>

      {/* Resumo de Padrões Detectados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 border-pink-500/30 p-6">
          <div className="text-center">
            <Search className="w-8 h-8 text-pink-400 mx-auto mb-2" />
            <div className="text-4xl font-bold text-white mb-1">
              {detectedPatterns.length}
            </div>
            <p className="text-sm text-gray-400">Padrões Detectados</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30 p-6">
          <div className="text-center">
            <Blocks className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-4xl font-bold text-white mb-1">
              {Object.keys(patternGroups).length}
            </div>
            <p className="text-sm text-gray-400">Tipos de Padrões</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30 p-6">
          <div className="text-center">
            <Zap className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-4xl font-bold text-white mb-1">
              {predictions.filter(p => p.likelihood === 'alta').length}
            </div>
            <p className="text-sm text-gray-400">Previsões de Alta Prob.</p>
          </div>
        </Card>
      </div>

      {/* Previsões de Próximos Padrões */}
      <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-400" />
          <h3 className="text-2xl font-bold text-white">Previsão de Próximos Blocos</h3>
        </div>

        <div className="space-y-4">
          {predictions.map((pred, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-5 border-2 cursor-pointer transition-all ${
                selectedPattern === pred.type
                  ? 'bg-yellow-900/40 border-yellow-400'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setSelectedPattern(pred.type)}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-white">{pred.type}</h4>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    pred.likelihood === 'alta' ? 'bg-green-600 text-white' :
                    pred.likelihood === 'média' ? 'bg-yellow-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    Prob: {pred.likelihood}
                  </span>
                  <span className="text-2xl font-bold text-yellow-400">
                    {pred.proximityScore}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="bg-gray-900/50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Ocorrências</p>
                  <p className="text-lg font-bold text-white">{pred.characteristics.count}</p>
                </div>
                <div className="bg-gray-900/50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Odds Antes</p>
                  <p className="text-lg font-bold text-blue-400">
                    {pred.characteristics.avgOddsBefore.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Taxa Over Anterior</p>
                  <p className="text-lg font-bold text-green-400">
                    {(pred.characteristics.avgPriorOverRate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Horário Comum</p>
                  <p className="text-lg font-bold text-purple-400">
                    {pred.characteristics.commonHours[0]?.hour}h
                  </p>
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                <p className="text-sm text-yellow-200">
                  <strong>Sugestão:</strong> {pred.suggestion}
                </p>
              </div>

              {/* Detalhes expandidos */}
              {selectedPattern === pred.type && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h5 className="text-sm font-semibold text-gray-300 mb-3">
                    Condições para este padrão aparecer:
                  </h5>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between bg-gray-900/50 rounded p-2">
                      <span className="text-gray-400">Odds Over 3.5 ideais:</span>
                      <span className="text-white font-semibold">
                        {pred.characteristics.avgOddsBefore.toFixed(2)} ± 0.5
                      </span>
                    </div>
                    
                    <div className="flex justify-between bg-gray-900/50 rounded p-2">
                      <span className="text-gray-400">Taxa de Over nos 3 jogos anteriores:</span>
                      <span className="text-white font-semibold">
                        ~{(pred.characteristics.avgPriorOverRate * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex justify-between bg-gray-900/50 rounded p-2">
                      <span className="text-gray-400">Horários mais prováveis:</span>
                      <span className="text-white font-semibold">
                        {pred.characteristics.commonHours.map(h => `${h.hour}h (${h.frequency}x)`).join(', ')}
                      </span>
                    </div>

                    <div className="bg-gray-900/50 rounded p-2">
                      <span className="text-gray-400 block mb-1">Times frequentes neste padrão:</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pred.characteristics.topTeams)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([team, count]) => (
                            <span key={team} className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-xs">
                              {team} ({count})
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Lista de Padrões Detectados */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">Padrões Históricos Detectados</h3>
        </div>

        <div className="space-y-3">
          {detectedPatterns.slice(0, 10).map((pattern, idx) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white">{pattern.type}</span>
                <span className="text-sm text-gray-400">
                  {pattern.startTime} → {pattern.endTime}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {pattern.sequence.map((seq, seqIdx) => (
                  <div
                    key={seqIdx}
                    className={`px-3 py-2 rounded ${
                      seq.type === 'over' 
                        ? 'bg-green-600/30 border border-green-500 text-green-300' 
                        : 'bg-red-600/30 border border-red-500 text-red-300'
                    }`}
                  >
                    <div className="text-xs">
                      {seq.match.hour}:{String(seq.match.minute).padStart(2, '0')}
                    </div>
                    <div className="font-bold text-sm">{seq.match.placarFT}</div>
                    <div className="text-xs">{seq.type.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                <div>Odds antes: {pattern.signature.avgOddsBefore.toFixed(2)}</div>
                <div>Times: {pattern.signature.teamsInvolved.slice(0, 4).join(', ')}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PatternDetector;
