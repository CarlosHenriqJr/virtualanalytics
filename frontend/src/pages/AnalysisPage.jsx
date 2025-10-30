/**
 * AnalysisPage.jsx - Página Principal de Análise
 * * Centraliza todas as abas de análise do sistema.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Importação de todos os componentes das abas
import AdvancedSequentialAnalysisTab from '../components/AdvancedSequentialAnalysisTab.jsx';
import PatternDiscoveryTab from '../components/PatternDiscoveryTab.jsx'; // A nova tela
import EfficientPatternTab from '../components/EfficientPatternTab.jsx';
import AdaptiveLearningTab from '../components/AdaptiveLearningTab.jsx';
import Over35CompleteAnalysis from '../components/Over35CompleteAnalysis.jsx';
import DeepAnalysisTab from '../components/DeepAnalysisTab.jsx';
import ComprehensiveStatsTab from '../components/ComprehensiveStatsTab.jsx'; 

const API_BASE_URL = 'http://localhost:8000';

/**
 * Banner que mostra o status da conexão com o banco de dados.
 */
const DatabaseStatusBanner = ({ status }) => {
  if (status.checking) {
    return (
      <div className="w-full p-3 bg-blue-100 text-blue-800 text-center font-medium">
        Verificando conexão com o banco de dados...
      </div>
    );
  }
  if (!status.connected) {
    return (
      <div className="w-full p-3 bg-red-100 text-red-800 text-center font-bold">
        ⚠️ Erro de Conexão: Não foi possível conectar ao banco de dados. ({status.error})
      </div>
    );
  }
  return (
    <div className="w-full p-3 bg-green-100 text-green-800 text-center font-medium">
      ✅ Conexão com o Banco de Dados estabelecida. (Total de partidas: {status.totalMatches || 0})
    </div>
  );
};

export default function AnalysisPage() {
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, error: null, totalMatches: 0 });
  const [availableDates, setAvailableDates] = useState([]);
  const [markets, setMarkets] = useState([]); // <-- O ESTADO QUE VAMOS PASSAR
  const [selectedMarket, setSelectedMarket] = useState('TotalGols_MaisDe_25'); 
  const [activeTab, setActiveTab] = useState('pattern-discovery'); 

  /**
   * Verifica a saúde do banco de dados ao carregar a página.
   * (Esta função busca /health, que foi corrigido no server.py)
   */
  const checkDatabaseStatus = async () => {
    setDbStatus({ checking: true, connected: false, error: null, totalMatches: 0 });
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      if (response.data.status === 'healthy') {
        setDbStatus({
          checking: false,
          connected: true,
          error: null,
          totalMatches: response.data.total_matches 
        });
      } else {
        throw new Error(response.data.detail || "Status não saudável");
      }
    } catch (error) {
      console.error("Erro ao verificar saúde do DB:", error);
      setDbStatus({
        checking: false,
        connected: false,
        error: error.response?.data?.detail || error.message || "Erro desconhecido",
        totalMatches: 0
      });
    }
  };

  /**
   * Carrega a lista de mercados disponíveis.
   * (Esta função busca /analysis/markets, que foi corrigido no analysis_routes.py)
   */
  const loadMarkets = async () => {
    try {
      console.log("Carregando mercados disponíveis de /analysis/markets...");
      const response = await axios.get(`${API_BASE_URL}/analysis/markets`);
      const marketsData = response.data.markets || [];

      if (marketsData.length > 0) {
        setMarkets(marketsData); // <-- OS DADOS SÃO SALVOS AQUI
        
        if (!marketsData.includes(selectedMarket)) {
          setSelectedMarket(marketsData[0]);
        }
      } else {
         console.warn("Nenhum mercado retornado da API.");
         setMarkets(['Nenhum mercado encontrado']);
      }
      
    } catch (error) {
      console.error("Erro crítico ao carregar mercados:", error);
      setMarkets(['Erro ao carregar mercados']);
    }
  };


  /**
   * Carrega as datas disponíveis para os filtros.
   * (Esta função busca /analysis/dates)
   */
  const loadAvailableDates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/dates`);
      setAvailableDates(response.data.dates || []);
    } catch (error) {
      console.error("Erro ao carregar datas disponíveis:", error);
    }
  };

  // Carrega os dados iniciais (status do DB, mercados, datas)
  useEffect(() => {
    checkDatabaseStatus();
    loadMarkets();
    loadAvailableDates();
  }, []);

  // Definição das abas
  const tabs = [
    { id: 'pattern-discovery', label: '🤖 Criar Robô (Descoberta)' }, 
    { id: 'comprehensive-stats', label: '📈 Estatísticas Completas' },
    { id: 'deep-analysis', label: '🔎 Análise Profunda' },
    { id: 'adaptive-learning', label: '🧠 Aprendizado Adaptativo' },
    { id: 'over35-complete', label: '⚽ Over 3.5 Completo' },
    { id: 'efficient-pattern', label: '📊 Análise Eficiente' },
    { id: 'sequential', label: '🔁 Análise Sequencial' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <DatabaseStatusBanner status={dbStatus} />

      <div className="max-w-7xl mx-auto mt-4">
        {/* Seletor de Mercado (usado por várias abas) */}
        <div className="mb-4 p-4 bg-white rounded-lg shadow">
          <label htmlFor="market-select" className="block text-sm font-medium text-gray-700 mb-2">
            Mercado de Referência Principal
          </label>
          <select
            id="market-select"
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={markets.length === 0}
          >
            {markets.length > 0 ? (
              markets.map((market) => (
                <option key={market} value={market}>{market}</option>
              ))
            ) : (
              <option disabled>Carregando mercados...</option>
            )}
          </select>
        </div>

        {/* Container das Abas */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Navegação das Abas */}
          <nav className="flex space-x-2 border-b border-gray-200 bg-gray-50 p-3 overflow-x-auto">
            {tabs.map((tab, index) => (
              <button
                key={`${tab.id}-${index}`} 
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors
                  ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Conteúdo da Aba Ativa */}
          <div className="p-4 sm:p-6">
            
            {/* ================================================================== */}
            {/* MUDANÇA PRINCIPAL AQUI */}
            {/* ================================================================== */}
            {activeTab === 'pattern-discovery' && (
              <PatternDiscoveryTab 
                dbConnected={dbStatus.connected}
                availableMarkets={markets} // <-- PROP ADICIONADA AQUI
                selectedMarket={selectedMarket} // (Prop opcional, não usada por esta aba ainda)
                availableDates={availableDates} // (Prop opcional)
              />
            )}
            {/* ================================================================== */}

            
            {activeTab === 'comprehensive-stats' && (
              <ComprehensiveStatsTab 
                dbConnected={dbStatus.connected} 
              />
            )}

            {activeTab === 'deep-analysis' && (
              <DeepAnalysisTab 
                availableDates={availableDates} 
                dbConnected={dbStatus.connected} 
              />
            )}
            
            {activeTab === 'adaptive-learning' && (
              <AdaptiveLearningTab 
                dbConnected={dbStatus.connected}
              />
            )}

            {activeTab === 'over35-complete' && (
              <Over35CompleteAnalysis 
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