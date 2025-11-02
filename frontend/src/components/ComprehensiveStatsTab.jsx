/**
 * ComprehensiveStatsTab.jsx - VERSÃO COM LOGS DE DEBUG
 * Integração completa com Correlações e Padrões Temporais
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TriggerDailyAnalysis from './analysis/TriggerDailyAnalysis';
import CorrelationAnalysisTab from './analysis/CorrelationAnalysisTab';
import TemporalPatternsTab from './analysis/TemporalPatternsTab';

const API_BASE_URL = 'http://localhost:8000';

export default function ComprehensiveStatsTab({ dbConnected }) {
  // const [activeSection, setActiveSection] = useState('daily-analysis');
  const [analysisResults, setAnalysisResults] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [activeSection, setActiveSection] = useState('test-trigger');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const datesResponse = await axios.get(`${API_BASE_URL}/analysis/dates`);
        const dates = datesResponse.data.dates || [];
        setAvailableDates(dates);

        const marketsResponse = await axios.get(`${API_BASE_URL}/analysis/markets`);
        setMarkets(marketsResponse.data.markets || []);
        
        console.log('📦 [ComprehensiveStatsTab] Dados iniciais carregados');
        console.log('   - Mercados:', marketsResponse.data.markets?.length);
        console.log('   - Datas:', dates.length);
      } catch (error) {
        console.error('❌ [ComprehensiveStatsTab] Erro ao carregar dados iniciais:', error);
      }
    };
    if (dbConnected) {
      console.log('🔌 [ComprehensiveStatsTab] DB conectado, carregando dados...');
      loadInitialData();
    }
  }, [dbConnected]);

  // ✅ CALLBACK COM LOGS DETALHADOS
  const handleAnalysisComplete = (results) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ [ComprehensiveStatsTab] CALLBACK EXECUTADO!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Resultados recebidos:', results);
    console.log('📊 Estrutura:');
    console.log('   - daily_performance existe?', !!results?.daily_performance);
    console.log('   - daily_performance length:', results?.daily_performance?.length);
    console.log('   - overall_performance existe?', !!results?.overall_performance);
    console.log('   - Keys do objeto:', Object.keys(results || {}));
    
    if (results?.daily_performance) {
      console.log('📊 Primeiro dia:', results.daily_performance[0]);
      console.log('📊 Último dia:', results.daily_performance[results.daily_performance.length - 1]);
    }
    
    console.log('');
    console.log('💾 Salvando no estado...');
    setAnalysisResults(results);
    console.log('✅ Estado atualizado com sucesso!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  };

  // LOG ANTES DE RENDERIZAR
  console.log('🎨 [ComprehensiveStatsTab] Renderizando componente');
  console.log('   - Aba ativa:', activeSection);
  console.log('   - analysisResults é null?', analysisResults === null);
  console.log('   - analysisResults tem daily_performance?', !!analysisResults?.daily_performance);
  if (analysisResults?.daily_performance) {
    console.log('   - Quantidade de dias:', analysisResults.daily_performance.length);
  }

  return (
    <div className="space-y-6">
      {/* Navegação das Abas */}
      <div className="flex space-x-4 border-b border-gray-700">
        <button
          className={`px-4 py-2 font-medium ${
            activeSection === 'daily-analysis'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => {
            console.log('🔘 [ComprehensiveStatsTab] Clicou em: Variação Diária');
            setActiveSection('daily-analysis');
          }}
        >
          📊 Análise de Variação Diária
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeSection === 'correlation'
              ? 'border-b-2 border-green-500 text-green-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => {
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🔘 [ComprehensiveStatsTab] CLICOU EM: CORRELAÇÕES');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('📊 analysisResults atual:', analysisResults);
            console.log('📊 Tem dados?', !!analysisResults?.daily_performance);
            if (analysisResults?.daily_performance) {
              console.log('📊 Quantidade de dias:', analysisResults.daily_performance.length);
            }
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            setActiveSection('correlation');
          }}
        >
          🔍 Correlações
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeSection === 'temporal-patterns'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => {
            console.log('🔘 [ComprehensiveStatsTab] Clicou em: Padrões Temporais');
            setActiveSection('temporal-patterns');
          }}
        >
          ⏰ Padrões Temporais
        </button>
      </div>

      <div className="flex space-x-4 border-b">
        <button onClick={() => setActiveSection('test-trigger')}>
          🧪 Testar Gatilho
        </button>
        <button onClick={() => setActiveSection('saved-triggers')}>
          💾 Gatilhos Salvos
        </button>
        <button onClick={() => setActiveSection('cross-analysis')}>
          🔄 Análise Cruzada
        </button>
      </div>

{/* Conteúdo das Abas - SEMPRE MONTADAS */}
<div className="mt-6">
  <div style={{ display: activeSection === 'daily-analysis' ? 'block' : 'none' }}>
    {console.log('🎨 Renderizando TriggerDailyAnalysis')}
    <TriggerDailyAnalysis 
      dbConnected={dbConnected}
      availableMarkets={markets}
      onAnalysisComplete={handleAnalysisComplete}
    />
  </div>

  <div style={{ display: activeSection === 'correlation' ? 'block' : 'none' }}>
    {console.log('🎨 Renderizando CorrelationAnalysisTab')}
    <CorrelationAnalysisTab 
      dbConnected={dbConnected}
      availableDates={availableDates}
      selectedMarket="TotalGols_MaisDe_35"
    />
  </div>

  <div style={{ display: activeSection === 'temporal-patterns' ? 'block' : 'none' }}>
    {console.log('🎨 Renderizando TemporalPatternsTab')}
    <TemporalPatternsTab 
      dbConnected={dbConnected}
      availableDates={availableDates}
      selectedMarket="TotalGols_MaisDe_35"
    />
  </div>
</div>
    </div>
  );
}