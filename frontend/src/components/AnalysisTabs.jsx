import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TriggerDailyAnalysis from './analysis/TriggerDailyAnalysis';

const API_BASE_URL = 'http://localhost:8000';

const AnalysisTabs = ({ dbConnected, availableMarkets = [] }) => {
  const [activeTab, setActiveTab] = useState('daily-variation');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [referenceDate, setReferenceDate] = useState('');
  const [targetMarket, setTargetMarket] = useState('Over_2_5');
  const [analysisDays, setAnalysisDays] = useState(30);
  const [minPatternFrequency, setMinPatternFrequency] = useState(3);
  const [view, setView] = useState('stats');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const datesResponse = await axios.get(`${API_BASE_URL}/analysis/available-dates`);
        const dates = datesResponse.data.dates || [];
        setAvailableDates(dates);
        if (dates.length > 0) setReferenceDate(dates[dates.length - 1]);

        const marketsResponse = await axios.get(`${API_BASE_URL}/analysis/available-markets`);
        setMarkets(marketsResponse.data.markets || []);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };
    if (dbConnected) loadInitialData();
  }, [dbConnected]);

  const handleRunPredictiveAnalysis = async () => {
    if (!dbConnected) {
      setError('Banco de dados não está conectado.');
      return;
    }
    if (!referenceDate) {
      setError('Selecione uma data de referência.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    const analysisRequest = {
      reference_date: referenceDate,
      target_market: targetMarket,
      analysis_days: parseInt(analysisDays, 10),
      min_pattern_frequency: parseInt(minPatternFrequency, 10),
      analysis_type: 'predictive_patterns',
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/comprehensive-stats/predictive-analysis`, analysisRequest);
      setAnalysisResult(response.data);
      setView('stats');
    } catch (err) {
      console.error('Erro na análise preditiva:', err);
      setError(err.response?.data?.detail || err.message || 'Erro na análise preditiva.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'daily-variation', label: '📊 Variação Diária', icon: '📈' },
    { id: 'correlation', label: '🔍 Correlações', icon: '🔗' },
    { id: 'patterns', label: '🎯 Padrões Temporais', icon: '⏰' },
    { id: 'predictive', label: '🔮 Análise Preditiva', icon: '🔮' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Navegação das Abas */}
      <div className="border-b border-gray-200 bg-gray-50">
        <nav className="flex space-x-4 p-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="p-6">
        {activeTab === 'daily-variation' && (
          <TriggerDailyAnalysis dbConnected={dbConnected} availableMarkets={availableMarkets} />
        )}

        {activeTab === 'correlation' && <CorrelationAnalysisTab />}

        {activeTab === 'patterns' && <TemporalPatternsTab />}

        {activeTab === 'predictive' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-900">🔮 Análise Preditiva de Padrões</h2>
              <p className="mt-2 text-gray-600">
                Identifique padrões que <strong>antecedem</strong> um mercado específico a partir de uma data de referência.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="referenceDate" className="block text-sm font-medium text-gray-700">
                      📅 Data de Referência *
                    </label>
                    <select
                      id="referenceDate"
                      value={referenceDate}
                      onChange={(e) => setReferenceDate(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">Selecione uma data</option>
                      {availableDates.map((date) => (
                        <option key={date} value={date}>
                          {date}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="targetMarket" className="block text-sm font-medium text-gray-700">
                      🎯 Mercado Alvo *
                    </label>
                    <select
                      id="targetMarket"
                      value={targetMarket}
                      onChange={(e) => setTargetMarket(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {markets.map((market) => (
                        <option key={market} value={market}>
                          {market}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="analysisDays" className="block text-sm font-medium text-gray-700">
                      📆 Período de Análise (dias)
                    </label>
                    <input
                      type="number"
                      id="analysisDays"
                      value={analysisDays}
                      onChange={(e) => setAnalysisDays(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      min="1"
                      max="365"
                    />
                  </div>

                  <div>
                    <label htmlFor="minPatternFrequency" className="block text-sm font-medium text-gray-700">
                      🔢 Frequência Mínima do Padrão
                    </label>
                    <input
                      type="number"
                      id="minPatternFrequency"
                      value={minPatternFrequency}
                      onChange={(e) => setMinPatternFrequency(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleRunPredictiveAnalysis}
                  disabled={loading || !dbConnected || !referenceDate}
                  className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white transition-colors ${
                    loading
                      ? 'bg-gray-400 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  } ${!dbConnected || !referenceDate ? '!bg-red-300 cursor-not-allowed' : ''}`}
                >
                  {loading ? '🔍 Analisando Padrões...' : '🚀 Executar Análise Preditiva'}
                </button>
                {!dbConnected && (
                  <p className="text-red-600 text-sm mt-2 text-center">Banco de dados desconectado.</p>
                )}
                {!referenceDate && (
                  <p className="text-red-600 text-sm mt-2 text-center">Selecione uma data de referência.</p>
                )}
              </div>
            </div>

            {loading && (
              <div className="text-center p-12 bg-white rounded-lg shadow-md">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-700 font-semibold text-lg">Buscando Padrões Antecessores...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md" role="alert">
                <p className="font-bold text-lg">Erro na Análise</p>
                <p className="mt-2 text-base">{error}</p>
              </div>
            )}

            {analysisResult && (
              <div className="mt-6 border border-gray-200 rounded-lg p-6 bg-white shadow-lg">
                <h3 className="text-2xl font-bold text-gray-900">📈 Resultados</h3>
                <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-auto max-h-[600px]">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Aba de Correlações
const CorrelationAnalysisTab = () => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-blue-700 mb-3">🔍 Análise de Correlações</h3>
      <p className="text-gray-700 mb-4">Esta aba irá analisar correlações entre fatores externos e a performance do gatilho:</p>
      <ul className="space-y-2 text-sm">
        <li>• Dia da semana</li>
        <li>• Volume de jogos</li>
        <li>• Mix de ligas</li>
        <li>• Horários</li>
      </ul>
    </div>
  </div>
);

// Aba de Padrões Temporais
const TemporalPatternsTab = () => (
  <div className="space-y-6">
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-purple-700 mb-3">⏰ Padrões Temporais</h3>
      <p className="text-gray-700 mb-4">Esta aba irá identificar padrões temporais na performance do gatilho:</p>
      <ul className="space-y-2 text-sm">
        <li>• Ciclos semanais</li>
        <li>• Sequências de resultados</li>
        <li>• Tendências e sazonalidade</li>
      </ul>
    </div>
  </div>
);

export default AnalysisTabs;