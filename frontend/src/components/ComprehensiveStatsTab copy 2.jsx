/**
 * ComprehensiveStatsTab.jsx
 * Componente para Análise Preditiva + Análise Diária
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// --- Componentes Internos ---

const JsonViewer = ({ data }) => (
  <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-auto max-h-[600px] shadow-inner">
    {JSON.stringify(data, null, 2)}
  </pre>
);

const MarketStatsTable = ({ stats, markets }) => {
  const [filter, setFilter] = useState('');

  const filteredMarkets = (markets || []).filter((m) =>
    m.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-2">Estatísticas por Mercado</h4>
      <input
        type="text"
        placeholder="Filtrar mercado..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-lg p-2 border border-gray-300 rounded-md mb-4 shadow-sm"
      />
      <div className="overflow-auto border border-gray-200 rounded-lg max-h-[600px] shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mercado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moda (Odd Mais Frequente)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvio Padrão (σ)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Ocorrências</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Frequência (Odd: Contagem)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMarkets.map((marketName) => {
              const data = stats[marketName];
              if (!data) return null;
              const freqString = Object.entries(data.frequency)
                .sort(([, a], [, b]) => b - a)
                .map(([odd, count]) => `${odd}: ${count}`)
                .join('; ');
              return (
                <tr key={marketName} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{marketName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-700 font-medium">
                    {Array.isArray(data.mode)
                      ? data.mode.join(', ')
                      : data.mode !== null
                      ? data.mode
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {data.std !== null ? data.std.toFixed(4) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {data.occurrences_with_data}
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-gray-600 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap"
                    title={freqString}
                  >
                    {freqString || 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredMarkets.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          Nenhum mercado encontrado para o filtro "{filter}".
        </p>
      )}
    </div>
  );
};

const PatternOccurrencesTable = ({ occurrences, targetMarket }) => {
  if (!occurrences || occurrences.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-2">
        Ocorrências do Padrão Antecessor (Total: {occurrences.length})
      </h4>
      <div className="overflow-auto border border-gray-200 rounded-lg max-h-[600px] shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Casa × Time Fora</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Padrão Identificado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Odd do {targetMarket}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mercados no Padrão</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {occurrences.map((occurrence, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {occurrence.date}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {occurrence.home_team} × {occurrence.away_team}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {occurrence.pattern_type || 'Padrão Complexo'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                  {occurrence.target_market_odds || 'N/A'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {occurrence.pattern_markets?.join(', ') || 'Analisando...'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function ComprehensiveStatsTab({ dbConnected }) {
  const [activeSection, setActiveSection] = useState('predictive-analysis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [view, setView] = useState('stats');
  const [availableDates, setAvailableDates] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [referenceDate, setReferenceDate] = useState('');
  const [targetMarket, setTargetMarket] = useState('Over_2_5');
  const [analysisDays, setAnalysisDays] = useState(30);
  const [minPatternFrequency, setMinPatternFrequency] = useState(3);

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

  const renderResult = () => {
    if (!analysisResult) return null;
    return (
      <div className="mt-6 border border-gray-200 rounded-lg p-6 bg-white shadow-lg">
        <h3 className="text-2xl font-bold text-gray-900">📈 Análise Preditiva Concluída</h3>
        {/* Renderização original do resultado */}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-gray-700">
        <button
          className={`px-4 py-2 font-medium ${
            activeSection === 'predictive-analysis'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400'
          }`}
          onClick={() => setActiveSection('predictive-analysis')}
        >
          🎯 Análise Preditiva
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeSection === 'daily-analysis'
              ? 'border-b-2 border-green-500 text-green-500'
              : 'text-gray-400'
          }`}
          onClick={() => setActiveSection('daily-analysis')}
        >
          📊 Análise Diária
        </button>
      </div>

      <div className="mt-6">
        {activeSection === 'predictive-analysis' && (
          <>
            {/* JSX original da seção preditiva aqui */}
            {renderResult()}
          </>
        )}

        {activeSection === 'daily-analysis' && <TriggerDailyAnalysis />}
      </div>
    </div>
  );
}

function TriggerDailyAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    triggerCondition: '{"IntervaloVencedor": "Visitante"}',
    targetMarket: 'Over_3_5',
    skipGames: 60,
    maxAttempts: 4,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  });

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/analysis/trigger-daily-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Erro na análise:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-800 rounded-lg">
      <h3 className="text-xl font-bold text-white">📊 Análise de Variação Diária</h3>
      {/* Formulário e resultados conforme sua sugestão original */}
    </div>
  );
}
