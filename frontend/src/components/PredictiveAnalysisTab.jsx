/**
 * PredictiveAnalysisTab.jsx - Componente de Análise Preditiva
 * 
 * Exibe padrões preditivos identificados para um mercado específico,
 * mostrando placares HT/FT e mercados/odds mais frequentes antes do mercado ganhar.
 */

import React from 'react';

export default function PredictiveAnalysisTab({ 
  predictiveAnalysis, 
  predictiveSummary,
  loading,
  onAnalyze,
  selectedMarket,
  dbConnected 
}) {
  
  if (!predictiveAnalysis && !predictiveSummary) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-lg font-medium mb-2">Análise Preditiva</p>
        <p className="text-sm mb-4">Descubra os melhores gatilhos para prever quando um mercado vai ganhar</p>
        <button
          onClick={onAnalyze}
          disabled={!dbConnected || loading || !selectedMarket}
          className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analisando...' : 'Iniciar Análise Preditiva'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Consolidado */}
      {predictiveSummary && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-900 mb-4">
            📊 Resumo Consolidado - {selectedMarket}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Total de Jogos</p>
              <p className="text-2xl font-bold text-gray-900">{predictiveSummary.total_matches}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Jogos Bem-Sucedidos</p>
              <p className="text-2xl font-bold text-green-600">{predictiveSummary.successful_matches}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-purple-600">
                {(predictiveSummary.success_rate * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Placares HT */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="text-blue-600 mr-2">⚽</span>
                Top Placares HT
              </h4>
              <div className="space-y-2">
                {predictiveSummary.top_placar_ht && predictiveSummary.top_placar_ht.length > 0 ? (
                  predictiveSummary.top_placar_ht.map((pattern, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="font-medium text-gray-900">{pattern.pattern_value}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-blue-600">
                          {(pattern.success_rate * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500 ml-2">({pattern.frequency}x)</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhum padrão encontrado</p>
                )}
              </div>
            </div>

            {/* Top Placares FT */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="text-green-600 mr-2">🎯</span>
                Top Placares FT
              </h4>
              <div className="space-y-2">
                {predictiveSummary.top_placar_ft && predictiveSummary.top_placar_ft.length > 0 ? (
                  predictiveSummary.top_placar_ft.map((pattern, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="font-medium text-gray-900">{pattern.pattern_value}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-green-600">
                          {(pattern.success_rate * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500 ml-2">({pattern.frequency}x)</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhum padrão encontrado</p>
                )}
              </div>
            </div>

            {/* Top Mercados/Odds */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="text-purple-600 mr-2">💰</span>
                Top Mercados/Odds
              </h4>
              <div className="space-y-2">
                {predictiveSummary.top_markets_odds && predictiveSummary.top_markets_odds.length > 0 ? (
                  predictiveSummary.top_markets_odds.map((pattern, index) => (
                    <div key={index} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900 flex-1 mr-2">
                          {pattern.pattern_value.split(' (')[0]}
                        </span>
                        <span className="text-sm font-semibold text-purple-600">
                          {(pattern.success_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{pattern.frequency}x</span>
                        {pattern.avg_odd && (
                          <span>Odd média: {pattern.avg_odd.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhum padrão encontrado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Análise Diária */}
      {predictiveAnalysis && predictiveAnalysis.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            📅 Análise Diária de Padrões
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Padrões identificados dia a dia para entender como os gatilhos variam ao longo do tempo
          </p>

          <div className="space-y-4">
            {predictiveAnalysis.map((daily, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                {/* Cabeçalho do Dia */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{daily.date}</h4>
                    <p className="text-sm text-gray-600">
                      {daily.successful_matches} de {daily.total_matches} jogos ({(daily.success_rate * 100).toFixed(1)}%)
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    daily.success_rate >= 0.7 ? 'bg-green-100 text-green-800' :
                    daily.success_rate >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {(daily.success_rate * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Padrões do Dia */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Placares HT */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Placares HT</h5>
                    <div className="space-y-1">
                      {daily.top_placar_ht && daily.top_placar_ht.length > 0 ? (
                        daily.top_placar_ht.slice(0, 3).map((pattern, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-900">{pattern.pattern_value}</span>
                            <span className="text-blue-600 font-medium">{pattern.frequency}x</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sem dados</p>
                      )}
                    </div>
                  </div>

                  {/* Placares FT */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Placares FT</h5>
                    <div className="space-y-1">
                      {daily.top_placar_ft && daily.top_placar_ft.length > 0 ? (
                        daily.top_placar_ft.slice(0, 3).map((pattern, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-900">{pattern.pattern_value}</span>
                            <span className="text-green-600 font-medium">{pattern.frequency}x</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sem dados</p>
                      )}
                    </div>
                  </div>

                  {/* Mercados/Odds */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Top Mercados</h5>
                    <div className="space-y-1">
                      {daily.top_markets_odds && daily.top_markets_odds.length > 0 ? (
                        daily.top_markets_odds.slice(0, 2).map((pattern, idx) => (
                          <div key={idx} className="text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-900 text-xs truncate mr-1">
                                {pattern.pattern_value.split(' (')[0]}
                              </span>
                              <span className="text-purple-600 font-medium">{pattern.frequency}x</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sem dados</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {predictiveAnalysis && predictiveAnalysis.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg">Nenhum padrão preditivo encontrado</p>
          <p className="text-sm mt-2">Tente aumentar o período de análise ou selecionar outro mercado</p>
        </div>
      )}
    </div>
  );
}

