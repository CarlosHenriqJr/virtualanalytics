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
import AdvancedSequentialAnalysisTab from '../components/AdvancedSequentialAnalysisTab.jsx';
import PatternDiscoveryTab from '../components/PatternDiscoveryTab.jsx';
import EfficientPatternTab from '../components/EfficientPatternTab.jsx';
import AdaptiveLearningTab from '../components/AdaptiveLearningTab.jsx';
import Over35CompleteAnalysis from '../components/Over35CompleteAnalysis.jsx';
import DeepAnalysisTab from '../components/DeepAnalysisTab.jsx';

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
          </div>
        </div>
      </div>
    </div>
  );
}