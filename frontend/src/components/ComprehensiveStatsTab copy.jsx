/**
 * ComprehensiveStatsTab.jsx
 * * Componente para a tela de Análise Estatística Completa (135 mercados).
 * Dispara e renderiza a análise estatística profunda de padrões.
 */
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// Componente para renderizar JSON de forma legível
const JsonViewer = ({ data }) => (
  <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-auto max-h-[600px] shadow-inner">
    {JSON.stringify(data, null, 2)}
  </pre>
);

// Componente Tabela de Estatísticas de Mercado (com filtro)
const MarketStatsTable = ({ stats, markets }) => {
  const [filter, setFilter] = useState('');
  
  const filteredMarkets = (markets || []).filter(m => 
    m.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-2">Estatísticas por Mercado</h4>
      
      <input
        type="text"
        placeholder="Filtrar mercado (ex: Over_2.5, GolsExatos_3)..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-lg p-2 border border-gray-300 rounded-md mb-4 shadow-sm"
      />
      
      <div className="overflow-auto border border-gray-200 rounded-lg max-h-[600px] shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mercado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moda</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvio Padrão (σ)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Ocorrências</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Frequência (Odd: Contagem)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMarkets.map(marketName => {
              const data = stats[marketName];
              if (!data) return null;
              
              const freqString = Object.entries(data.frequency)
                                    .sort(([,a],[,b]) => b-a) // Ordena por contagem
                                    .map(([odd, count]) => `${odd}: ${count}`)
                                    .join('; ');
              
              return (
                <tr key={marketName} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{marketName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-700 font-medium">
                    {Array.isArray(data.mode) ? data.mode.join(', ') : (data.mode !== null ? data.mode : 'N/A')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {data.std !== null ? data.std.toFixed(4) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {data.occurrences_with_data}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap" title={freqString}>
                    {freqString || 'N/A'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filteredMarkets.length === 0 && (
        <p className="text-center text-gray-500 py-4">Nenhum mercado encontrado para o filtro "{filter}".</p>
      )}
    </div>
  );
};


export default function ComprehensiveStatsTab({ dbConnected }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [view, setView] = useState('stats'); // 'stats', 'occurrences', 'correlation_json'

  // Definição do Padrão. No futuro, isso pode vir de um <select> ou formulário.
  const patternToAnalyze = {
    pattern_id: "padrao_ft_003x0",
    title: "Padrão: Placar 3x0 / 0x3 (FT)",
    description: "Gatilho: O placar final (FT) da partida é exatamente '3x0' ou '0x3'.",
    trigger_conditions: {
      "$or": [
        {"placarFT": "3x0"},
        {"placarFT": "0x3"}
      ]
    },
    action: {
      "skip_games": 14,
      "entries_count": 4
    }
  };

  const handleRunAnalysis = async () => {
    if (!dbConnected) {
      setError("Banco de dados não está conectado. Não é possível iniciar a análise.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/comprehensive-stats/analyze`, patternToAnalyze);
      setAnalysisResult(response.data);
      setView('stats');
    } catch (err) {
      console.error("Erro ao rodar análise:", err);
      setError(err.response?.data?.detail || err.message || "Erro desconhecido ao processar a análise.");
    } finally {
      setLoading(false);
    }
  };
  
  const renderResult = () => {
    if (!analysisResult) return null;

    return (
      <div className="mt-6 border border-gray-200 rounded-lg p-6 bg-white shadow-lg">
        <h3 className="text-2xl font-bold text-gray-900">{analysisResult.title}</h3>
        
        {analysisResult.notes && (
            <div className="my-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md shadow-sm">
                <p className="font-semibold text-yellow-800">Aviso: {analysisResult.notes}</p>
            </div>
        )}
        
        <p className="text-gray-600 mt-2">{analysisResult.description}</p>
        
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <span className="text-sm font-medium text-gray-700">Ação: <strong className="text-blue-600">Pular {analysisResult.action.skip_games}</strong></span>
            <span className="text-sm font-medium text-gray-700">Entradas: <strong className="text-blue-600">{analysisResult.action.entries_count}</strong></span>
            <span className="text-sm font-medium text-gray-700">Ocorrências Encontradas: <strong className="text-blue-600">{analysisResult.occurrences_count}</strong></span>
        </div>
        
        {/* Abas de Visualização do Resultado */}
        <div className="mt-6 border-b border-gray-200">
            <nav className="flex space-x-4 -mb-px">
                <button 
                  onClick={() => setView('stats')} 
                  className={`py-3 px-1 text-sm font-medium ${view === 'stats' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                >
                    📊 Estatísticas por Mercado
                </button>
                <button 
                  onClick={() => setView('occurrences')} 
                  className={`py-3 px-1 text-sm font-medium ${view === 'occurrences' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                >
                    📋 Ocorrências ({analysisResult.occurrences_count})
                </button>
                <button 
                  onClick={() => setView('correlation_json')} 
                  className={`py-3 px-1 text-sm font-medium ${view === 'correlation_json' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                >
                    🔗 Matriz de Correlação (JSON)
                </button>
            </nav>
        </div>
        
        <div className="mt-6">
            {view === 'stats' && (
                <MarketStatsTable 
                    stats={analysisResult.market_stats} 
                    markets={analysisResult.correlations?.markets} 
                />
            )}
            {view === 'occurrences' && (
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Ocorrências Detalhadas (JSON)</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Cada item na lista é um gatilho; 'entries' contém os {analysisResult.action.entries_count} jogos analisados após o gatilho.
                    </p>
                    <JsonViewer data={analysisResult.occurrences} />
                </div>
            )}
            {view === 'correlation_json' && (
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Matrizes de Correlação (JSON)</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Contém a lista de mercados (135) e as matrizes 135x135 para Pearson e Spearman. 
                      `null` indica correlação não calculada (ex: `min_periods=5`).
                    </p>
                    <JsonViewer data={analysisResult.correlations} />
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900">Estatísticas Completas de Padrões (135 Mercados)</h2>
        <p className="mt-2 text-gray-600">
          Esta análise executa uma consulta profunda no banco de dados para encontrar todas as ocorrências de um padrão,
          identificar os jogos de entrada subsequentes (ex: pular 14, entrar 4), e então
          calcular Moda, Frequência, Desvio Padrão (σ) e Correlação (Pearson/Spearman)
          para *todos os 135 mercados* nessas entradas.
        </p>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg shadow-inner">
            <p className="text-red-800 font-bold">⚠️ Atenção: Processamento Pesado</p>
            <p className="text-red-700 text-sm mt-1">
              Esta é a consulta mais pesada do sistema. Pode levar de <strong>30 segundos a vários minutos</strong>, 
              dependendo do volume de dados e da frequência do padrão.
            </p>
        </div>

        <div className="mt-6">
          <button
            onClick={handleRunAnalysis}
            disabled={loading || !dbConnected}
            className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            } ${
              !dbConnected
                ? '!bg-red-300 cursor-not-allowed'
                : ''
            }`}
          >
            {loading ? 'Processando (Isso pode demorar muito)...' : `Rodar Análise: ${patternToAnalyze.title}`}
          </button>
          {!dbConnected && <p className="text-red-600 text-sm mt-2 text-center">A análise não pode ser executada pois o banco de dados está desconectado.</p>}
        </div>
      </div>

      {loading && (
        <div className="text-center p-12 bg-white rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold text-lg">Calculando Estatísticas...</p>
          <p className="mt-2 text-gray-500">Buscando ocorrências, coletando dados de 135 mercados e calculando correlações.</p>
        </div>
      )}
      
      {error && (
         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md" role="alert">
            <p className="font-bold text-lg">Erro na Análise</p>
            <p className="mt-2 text-base">{error}</p>
         </div>
      )}

      {renderResult()}
    </div>
  );
}