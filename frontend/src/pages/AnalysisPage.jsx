/**
 * AnalysisPage.jsx - Versão Final com Análise Profunda
 * 
 * Inclui todas as funcionalidades:
 * - Análise Profunda (NOVO)
 * - Análise Preditiva
 * - Análise Sequencial Avançada
 * - Descoberta de Padrões
 * - Análise Eficiente
 * - Aprendizado Adaptativo
 * - Análise Completa Over 3.5
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
<<<<<<< HEAD
import AdvancedSequentialAnalysisTab from '../components/AdvancedSequentialAnalysisTab.jsx';
import PatternDiscoveryTab from '../components/PatternDiscoveryTab.jsx';
import EfficientPatternTab from '../components/EfficientPatternTab.jsx';
import AdaptiveLearningTab from '../components/AdaptiveLearningTab.jsx';
import Over35CompleteAnalysis from '../components/Over35CompleteAnalysis.jsx';
import DeepAnalysisTab from '../components/DeepAnalysisTab.jsx';
=======
import PredictiveAnalysisTab from '../components/PredictiveAnalysisTab';
import AdvancedSequentialAnalysisTab from '../components/AdvancedSequentialAnalysisTab';
import PatternDiscoveryTab from '../components/PatternDiscoveryTab';
import EfficientPatternTab from '../components/EfficientPatternTab';
import AdaptiveLearningTab from '../components/AdaptiveLearningTab';
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746

const API_BASE_URL = 'http://localhost:8000';

export default function AnalysisPage() {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [availableDates, setAvailableDates] = useState({ oldest: null, newest: null });
  const [activeTab, setActiveTab] = useState('deep-analysis');
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    checking: true,
    totalMatches: 0,
    error: null
  });

  useEffect(() => {
    const initialize = async () => {
      await checkDatabaseStatus();
      await loadMarkets();
      await loadAvailableDates();
    };
    initialize();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      setDbStatus(prev => ({ ...prev, checking: true, error: null }));
      const response = await axios.get(`${API_BASE_URL}/analysis/health`);
      setDbStatus({
        connected: true,
        checking: false,
        totalMatches: response.data.total_matches || 0,
        error: null
      });
    } catch (err) {
      setDbStatus({
        connected: false,
        checking: false,
        totalMatches: 0,
        error: err.response?.data?.detail || err.message || 'Erro ao conectar ao banco de dados'
      });
    }
  };

  const loadMarkets = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/markets`);
      const marketsList = response.data.markets || [];
      setMarkets(marketsList);
      if (marketsList.includes('TotalGols_MaisDe_35')) {
        setSelectedMarket('TotalGols_MaisDe_35');
      } else if (marketsList.length > 0) {
        setSelectedMarket(marketsList[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar mercados:', err);
    }
  };

  const loadAvailableDates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/dates`);
      setAvailableDates({
        oldest: response.data.oldest_date,
        newest: response.data.newest_date
      });
    } catch (err) {
      console.error('Erro ao carregar datas:', err);
    }
  };
  
  const DatabaseStatusBanner = () => {
    if (dbStatus.checking) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 font-medium">Verificando conexão...</p>
        </div>
      );
    }
    if (dbStatus.connected) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-semibold">✓ Banco de Dados Conectado ({dbStatus.totalMatches.toLocaleString('pt-BR')} jogos)</p>
        </div>
      );
    }
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800 font-semibold">✗ Erro na Conexão: {dbStatus.error}</p>
      </div>
    );
  };

  const tabs = [
    { id: 'deep-analysis', label: '🔎 Análise Profunda' },
    { id: 'adaptive-learning', label: '🧠 Aprendizado Adaptativo' },
    { id: 'over35-complete', label: '⚽ Over 3.5 Completo' },
    { id: 'efficient-pattern', label: '📊 Análise Eficiente' },
    { id: 'pattern-discovery', label: '🤖 Descoberta de Padrões' },
    { id: 'sequential', label: '🔁 Análise Sequencial' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Análise de Futebol Virtual</h1>
          <p className="mt-2 text-gray-600">
            Ferramentas avançadas para identificar padrões e gatilhos em dados históricos.
          </p>
        </div>

        <DatabaseStatusBanner />

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
<<<<<<< HEAD
            <nav className="flex space-x-2 overflow-x-auto p-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
=======
<nav className="flex space-x-2 border-b">
  <button
    onClick={() => setActiveTab('overview')}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === 'overview'
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    📊 Visão Geral
  </button>

  <button
    onClick={() => setActiveTab('advanced')}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === 'advanced'
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    ⚙️ Análise Avançada
  </button>

  <button
    onClick={() => setActiveTab('sequential')}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === 'sequential'
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    🔁 Análise Sequencial
  </button>

  <button
    onClick={() => setActiveTab('pattern-discovery')}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === 'pattern-discovery'
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    🤖 Descoberta de Padrões
  </button>

  <button
  onClick={() => setActiveTab('efficient-pattern')}
  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
    activeTab === 'efficient-pattern'
      ? 'border-blue-500 text-blue-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  📊 Análise Eficiente
</button>

  <button
  onClick={() => setActiveTab('adaptive-learning')}
  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
    activeTab === 'adaptive-learning'
      ? 'border-purple-500 text-purple-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  🧠 Aprendizado Adaptativo
</button>
</nav>

>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
          </div>

          <div className="p-6">
            {activeTab === 'deep-analysis' && <DeepAnalysisTab availableDates={availableDates} dbConnected={dbStatus.connected} />}
            {activeTab === 'adaptive-learning' && <AdaptiveLearningTab />}
            {activeTab === 'over35-complete' && <Over35CompleteAnalysis dbConnected={dbStatus.connected} availableDates={availableDates} />}
            {activeTab === 'efficient-pattern' && <EfficientPatternTab selectedMarket={selectedMarket} dbConnected={dbStatus.connected} availableDates={availableDates} />}
            {activeTab === 'pattern-discovery' && <PatternDiscoveryTab selectedMarket={selectedMarket} dbConnected={dbStatus.connected} availableDates={availableDates} />}
            {activeTab === 'sequential' && (
              <AdvancedSequentialAnalysisTab
                selectedMarket={selectedMarket}
                dbConnected={dbStatus.connected}
                availableDates={availableDates}
              />
            )}
<<<<<<< HEAD
=======

            {/* Tab: Análise Preditiva */}
            {activeTab === 'predictive' && (
              <PredictiveAnalysisTab
                predictiveAnalysis={predictiveAnalysis}
                predictiveSummary={predictiveSummary}
                loading={loading}
                onAnalyze={handlePredictiveAnalysis}
                selectedMarket={selectedMarket}
                dbConnected={dbStatus.connected}
              />
            )}

            {/* Tab: Análise Histórica */}
            {activeTab === 'historical' && (
              <div>
                {historicalAnalysis === null ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p className="text-lg">Selecione um mercado e clique em "Análise Histórica"</p>
                    <p className="text-sm mt-2">A efetividade ao longo do tempo será exibida aqui</p>
                  </div>
                ) : historicalAnalysis.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-lg">Nenhum dado histórico encontrado</p>
                    <p className="text-sm mt-2">Verifique o período selecionado</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Efetividade Histórica de {selectedMarket}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Período
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Taxa de Sucesso
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total de Jogos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sucessos
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historicalAnalysis.map((period, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {period.period}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  period.success_rate >= 0.7 ? 'bg-green-100 text-green-800' :
                                  period.success_rate >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {(period.success_rate * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {period.total_matches}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {period.successful_matches}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Descoberta de Padrões */}
{activeTab === 'pattern-discovery' && (
  <PatternDiscoveryTab
    selectedMarket={selectedMarket}
    dbConnected={dbStatus.connected}
    availableDates={availableDates}
  />
)}

{activeTab === 'efficient-pattern' && (
  <EfficientPatternTab
    selectedMarket={selectedMarket}
    dbConnected={dbStatus.connected}
    availableDates={availableDates}
  />
)}

{activeTab === 'adaptive-learning' && (
  <AdaptiveLearningTab />
)}

            {/* Tab: Lista de Jogos */}
            {activeTab === 'matches' && (
              <div>
                {matchesList.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">Clique em "Lista de Jogos" para carregar</p>
                    <p className="text-sm mt-2">Os jogos do período selecionado serão exibidos aqui</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Jogos Encontrados ({matchesList.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Data
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Jogo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Placar HT
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Placar FT
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Gols
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {matchesList.map((match, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {match.date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {match.timeCasa} vs {match.timeFora}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.placarHT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.placarFT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.totalGolsFT}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
          </div>
        </div>
      </div>
    </div>
  );
}