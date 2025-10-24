/**
 * AdvancedSequentialAnalysisTab.jsx
 * 
 * Componente para exibir análise sequencial avançada conforme especificação:
 * - Distribuição por hora
 * - Padrões recorrentes (sequências de placares e combinações de mercados)
 * - Comportamento em blocos (clusters temporais)
 * - Recomendações
 */

import React from 'react';

export default function AdvancedSequentialAnalysisTab({ 
  analysisData, 
  loading, 
  onAnalyze, 
  selectedMarket,
  dbConnected,
  lookbackGames,
  setLookbackGames
}) {
  
  if (!dbConnected) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-lg font-semibold">Banco de Dados Desconectado</p>
        <p className="text-sm mt-2">Conecte-se ao banco de dados para usar esta funcionalidade</p>
      </div>
    );
  }

  if (!analysisData && !loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-lg font-semibold">Análise Sequencial Avançada</p>
        <p className="text-sm mt-2 mb-4">Identifica padrões sequenciais, clusters temporais e combinações de mercados</p>
        
        {/* Configuração de N jogos */}
        <div className="max-w-md mx-auto mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Janela Retroativa (N jogos anteriores)
          </label>
          <input
            type="number"
            value={lookbackGames}
            onChange={(e) => setLookbackGames(parseInt(e.target.value) || 20)}
            min="5"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Quantos jogos anteriores analisar antes de cada ocorrência do mercado-alvo
          </p>
        </div>
        
        <button
          onClick={onAnalyze}
          disabled={!selectedMarket}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {!selectedMarket ? 'Selecione um mercado primeiro' : 'Executar Análise Sequencial'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Analisando padrões sequenciais...</p>
        <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  const data = analysisData;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-indigo-900 mb-2">
          Análise Diária – {data.date}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Mercado-alvo</p>
            <p className="text-lg font-semibold text-gray-900">{data.target_market}</p>
            {data.target_market_odd && (
              <p className="text-sm text-indigo-600">Odd fixa: {data.target_market_odd.toFixed(2)}</p>
            )}
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Total de ocorrências</p>
            <p className="text-3xl font-bold text-indigo-600">{data.total_occurrences}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Janela retroativa</p>
            <p className="text-lg font-semibold text-gray-900">{lookbackGames} jogos anteriores</p>
          </div>
        </div>
      </div>

      {/* Distribuição por Hora */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">🕒</span>
          Distribuição por Hora
        </h3>
        {data.hourly_distribution && data.hourly_distribution.length > 0 ? (
          <div className="space-y-2">
            {data.hourly_distribution.map((item, index) => (
              <div key={index} className="flex items-center">
                <span className="w-16 text-sm font-medium text-gray-700">{item.hour}h:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 ml-4 relative">
                  <div
                    className="bg-indigo-600 h-6 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${item.percentage}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {item.occurrences}x ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum dado disponível</p>
        )}
      </div>

      {/* Padrões Recorrentes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">🔍</span>
          Padrões Recorrentes (N={lookbackGames} jogos anteriores)
        </h3>

        {/* Sequências de Placares HT */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Sequência de placares mais comum antes do {data.target_market} (HT)
          </h4>
          {data.top_score_sequences_ht && data.top_score_sequences_ht.length > 0 ? (
            <div className="space-y-2">
              {data.top_score_sequences_ht.slice(0, 5).map((seq, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex-1">
                    <code className="text-sm font-mono text-indigo-700">
                      [{seq.sequence.slice(-5).join(', ')}]
                    </code>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      seq.percentage >= 50 ? 'bg-green-100 text-green-800' :
                      seq.percentage >= 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {seq.percentage.toFixed(1)}% ({seq.frequency}x)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma sequência encontrada</p>
          )}
        </div>

        {/* Sequências de Placares FT */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Sequência de placares mais comum antes do {data.target_market} (FT)
          </h4>
          {data.top_score_sequences_ft && data.top_score_sequences_ft.length > 0 ? (
            <div className="space-y-2">
              {data.top_score_sequences_ft.slice(0, 5).map((seq, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex-1">
                    <code className="text-sm font-mono text-purple-700">
                      [{seq.sequence.slice(-5).join(', ')}]
                    </code>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      seq.percentage >= 50 ? 'bg-green-100 text-green-800' :
                      seq.percentage >= 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {seq.percentage.toFixed(1)}% ({seq.frequency}x)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma sequência encontrada</p>
          )}
        </div>

        {/* Combinação de Mercados Fixos */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Combinação de mercados fixos nos jogos anteriores
          </h4>
          {data.top_market_combinations && data.top_market_combinations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.top_market_combinations.slice(0, 10).map((market, index) => (
                <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">{market.market_name}</span>
                    <span className="text-lg font-bold text-indigo-600">@ {market.odd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Presente em {market.percentage.toFixed(1)}%</span>
                    <span className="text-gray-500">({market.frequency}x)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma combinação encontrada</p>
          )}
        </div>
      </div>

      {/* Comportamento em Blocos (Clusters Temporais) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">🧱</span>
          Comportamento em Blocos (Clusters Temporais)
        </h3>
        {data.temporal_clusters && data.temporal_clusters.length > 0 ? (
          <div className="space-y-4">
            {data.temporal_clusters.map((cluster, index) => (
              <div key={index} className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Cluster {index + 1}: {cluster.start_time} - {cluster.end_time}
                  </h4>
                  <span className="text-sm text-gray-600">{cluster.games.length} jogos</span>
                </div>
                
                {/* Jogos do cluster */}
                <div className="space-y-2 mb-3">
                  {cluster.games.slice(0, 5).map((game, gIndex) => (
                    <div key={gIndex} className="flex items-center text-sm bg-white rounded p-2">
                      <span className="font-mono text-indigo-600 w-16">{game.hour}</span>
                      <span className="mx-2">→</span>
                      <span className="font-semibold">{game.placarFT}</span>
                      <span className="text-gray-500 ml-2">({game.timeCasa} vs {game.timeFora})</span>
                    </div>
                  ))}
                  {cluster.games.length > 5 && (
                    <p className="text-xs text-gray-500 italic">... e mais {cluster.games.length - 5} jogos</p>
                  )}
                </div>

                {/* Mercados frequentes no cluster */}
                {cluster.market_frequency && Object.keys(cluster.market_frequency).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Mercados frequentes neste cluster:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(cluster.market_frequency)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([market, freq], mIndex) => (
                          <span key={mIndex} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {market} ({freq}x)
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Observação */}
                <div className="mt-3 p-3 bg-white rounded border-l-4 border-amber-500">
                  <p className="text-sm text-gray-700">
                    <strong>Observação:</strong> Quando 2+ jogos com mercados similares ocorrem em sequência (até 2h), 
                    há maior probabilidade do mercado-alvo {data.target_market} ocorrer no próximo jogo.
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum cluster temporal detectado</p>
            <p className="text-sm mt-2">Clusters são formados quando 2+ jogos ocorrem em sequência (até 2 horas)</p>
          </div>
        )}
      </div>

      {/* Recomendações */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">🤖</span>
            Recomendações
          </h3>
          <ul className="space-y-3">
            {data.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-green-500">
            <p className="text-sm text-gray-700">
              <strong>💡 Dica:</strong> Os padrões sequenciais e a presença de mercados específicos com odds fixas 
              são fortes indicadores contextuais. Ideal para alimentar um modelo preditivo baseado em sequência de eventos + odds fixas.
            </p>
          </div>
        </div>
      )}

      {/* Padrões Sequenciais Detalhados */}
      {data.sequential_patterns && data.sequential_patterns.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">📊</span>
            Padrões Sequenciais Detalhados
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Mostrando os {Math.min(5, data.sequential_patterns.length)} primeiros padrões de {data.sequential_patterns.length} total
          </p>
          <div className="space-y-4">
            {data.sequential_patterns.slice(0, 5).map((pattern, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">{pattern.pattern_description}</h4>
                
                {/* Jogos anteriores */}
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Últimos 5 jogos antes:</p>
                  <div className="space-y-1">
                    {pattern.games_before.map((game, gIndex) => (
                      <div key={gIndex} className="text-xs font-mono text-gray-600 bg-white rounded p-2">
                        {game.hour} | {game.timeCasa} vs {game.timeFora} | HT: {game.placarHT} | FT: {game.placarFT}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Jogo alvo */}
                <div className="mb-3 p-3 bg-indigo-100 rounded border-l-4 border-indigo-500">
                  <p className="text-sm font-semibold text-indigo-900 mb-1">→ Jogo onde {data.target_market} ocorreu:</p>
                  <p className="text-xs font-mono text-indigo-700">
                    {pattern.target_game.hour} | {pattern.target_game.timeCasa} vs {pattern.target_game.timeFora} | 
                    HT: {pattern.target_game.placarHT} | FT: {pattern.target_game.placarFT}
                  </p>
                </div>

                {/* Top mercados neste padrão */}
                {pattern.market_combinations && pattern.market_combinations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Top mercados nos jogos anteriores:</p>
                    <div className="flex flex-wrap gap-2">
                      {pattern.market_combinations.map((market, mIndex) => (
                        <span key={mIndex} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {market.market_name} @ {market.odd.toFixed(2)} ({market.frequency}x)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

