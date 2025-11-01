import React, { useState } from 'react';
import PerformanceChart from './PerformanceChart';

const API_BASE_URL = 'http://localhost:8000';

const TriggerDailyAnalysis = ({ dbConnected, availableMarkets = [], onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const [triggerCondition, setTriggerCondition] = useState('{"IntervaloVencedor": "Visitante"}');
  const [targetMarket, setTargetMarket] = useState('TotalGols_MaisDe_35');
  const [skipGames, setSkipGames] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(4);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [jsonError, setJsonError] = useState(null);

  console.log('🔧 [TriggerDailyAnalysis] Componente renderizado');
  console.log('   - onAnalysisComplete existe?', typeof onAnalysisComplete === 'function');
  console.log('   - dbConnected:', dbConnected);

  const handleTriggerChange = (value) => {
    setTriggerCondition(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (err) {
      setJsonError('JSON inválido');
    }
  };

  const runAnalysis = async () => {
    if (!dbConnected) {
      setError('Banco de dados não conectado');
      return;
    }

    if (jsonError) {
      setError('Corrija o JSON do gatilho antes de continuar');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 [TriggerDailyAnalysis] INICIANDO ANÁLISE');
    console.log('═══════════════════════════════════════════════════════════');

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const triggerParsed = JSON.parse(triggerCondition);
      console.log('📝 Parâmetros da análise:');
      console.log('   - Trigger:', triggerParsed);
      console.log('   - Market:', targetMarket);
      console.log('   - Skip:', skipGames);
      console.log('   - Attempts:', maxAttempts);
      console.log('   - Período:', startDate, 'a', endDate);

      const requestBody = {
        trigger_condition: triggerParsed,
        target_market: targetMarket,
        skip_games: parseInt(skipGames, 10),
        max_attempts: parseInt(maxAttempts, 10),
        start_date: startDate,
        end_date: endDate,
      };

      console.log('📤 Enviando requisição para:', `${API_BASE_URL}/analysis/trigger-performance`);
      console.log('📦 Body:', requestBody);

      const response = await fetch(`${API_BASE_URL}/analysis/trigger-performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Resposta recebida. Status:', response.status);

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ [TriggerDailyAnalysis] DADOS RECEBIDOS DO BACKEND');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 Estrutura dos dados:');
      console.log('   - Keys:', Object.keys(data));
      console.log('   - daily_performance?', !!data?.daily_performance);
      console.log('   - daily_performance length:', data?.daily_performance?.length);
      console.log('   - overall_performance?', !!data?.overall_performance);
      
      if (data?.daily_performance) {
        console.log('📊 Amostra dos dados diários:');
        console.log('   - Primeiro dia:', data.daily_performance[0]);
        console.log('   - Último dia:', data.daily_performance[data.daily_performance.length - 1]);
      }
      
      console.log('');
      console.log('💾 Salvando no estado local...');
      setResults(data);
      console.log('✅ Estado local atualizado!');
      
      console.log('');
      console.log('📞 Chamando callback onAnalysisComplete...');
      console.log('   - Callback existe?', typeof onAnalysisComplete === 'function');
      
      if (onAnalysisComplete) {
        console.log('✅ Executando callback...');
        onAnalysisComplete(data);
        console.log('✅ Callback executado com sucesso!');
      } else {
        console.error('❌ onAnalysisComplete NÃO EXISTE!');
        console.error('❌ O componente pai não passou o callback!');
      }
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

    } catch (err) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('❌ [TriggerDailyAnalysis] ERRO NA ANÁLISE');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('Erro:', err);
      console.error('Message:', err.message);
      console.error('═══════════════════════════════════════════════════════════');
      console.error('');
      setError(err.message || 'Erro ao executar análise');
    } finally {
      setLoading(false);
    }
  };

  const calculateVariationInsights = () => {
    if (!results?.daily_performance) return null;

    const successRates = results.daily_performance.map(d => d.success_rate);
    const avg = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const stdDev = Math.sqrt(
      successRates.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / successRates.length
    );

    const goodDays = successRates.filter(r => r >= 0.7).length;
    const badDays = successRates.filter(r => r < 0.5).length;
    const totalDays = results.daily_performance.length;
    const totalOperations = results.daily_performance.reduce((sum, d) => sum + d.green_count + d.red_count, 0);

    return { avgSuccessRate: avg, volatility: stdDev, goodDays, badDays, totalDays, totalOperations };
  };

  const insights = results ? calculateVariationInsights() : null;

  return (
    <div className="space-y-6">
      {/* Card Explicativo */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como Funciona</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Gatilho:</strong> Condição que você monitora</p>
          <p><strong>Pulos:</strong> Quantos jogos esperar após detectar o gatilho</p>
          <p><strong>Operação:</strong> Uma sequência de até 4 tentativas (gales)</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Análise de Variação Diária de Gatilho</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gatilho (JSON)</label>
            <textarea
              rows="3"
              value={triggerCondition}
              onChange={(e) => handleTriggerChange(e.target.value)}
              className={`w-full p-2 border rounded font-mono text-sm ${jsonError ? 'border-red-500' : 'border-gray-300'}`}
            />
            {jsonError && <p className="text-red-500 text-xs mt-1">{jsonError}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mercado</label>
              <select value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} className="w-full p-2 border rounded">
                {availableMarkets.length > 0 ? (
                  availableMarkets.map((m) => <option key={m} value={m}>{m}</option>)
                ) : (
                  <option>TotalGols_MaisDe_35</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pulos</label>
              <input type="number" value={skipGames} onChange={(e) => setSkipGames(e.target.value)} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tiros</label>
              <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data Inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data Final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading || !dbConnected}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Analisando...' : 'Analisar Variação Diária'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {results && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {(results.overall_performance.overall_success_rate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-2">Taxa Geral</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{results.overall_performance.total_operations}</div>
              <div className="text-sm text-gray-600 mt-2">Operações Totais</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{insights?.goodDays || 0}</div>
              <div className="text-sm text-gray-600 mt-2">Dias Bons</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-red-600">{insights?.badDays || 0}</div>
              <div className="text-sm text-gray-600 mt-2">Dias Ruins</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{insights?.volatility.toFixed(2) || 0}</div>
              <div className="text-sm text-gray-600 mt-2">Volatilidade</div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold mb-4">📈 Evolução Temporal</h3>
            <PerformanceChart data={results.daily_performance} />
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold mb-4">📊 Performance Diária</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-100">
                    <th className="text-left p-2">Data</th>
                    <th className="text-center p-2">Ops</th>
                    <th className="text-center p-2">Greens</th>
                    <th className="text-center p-2">Reds</th>
                    <th className="text-center p-2">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {results.daily_performance.map((day, index) => {
                    const totalOps = day.green_count + day.red_count;
                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{day.date}</td>
                        <td className="text-center p-2">{totalOps}</td>
                        <td className="text-center p-2 text-green-600">{day.green_count}</td>
                        <td className="text-center p-2 text-red-600">{day.red_count}</td>
                        <td className="text-center p-2">{(day.success_rate * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TriggerDailyAnalysis;