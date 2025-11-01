import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';

const CorrelationAnalysisTab = ({ results }) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 [CorrelationAnalysisTab] COMPONENTE RENDERIZADO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Props recebidas:', results);
  console.log('📊 results é null?', results === null);
  console.log('📊 results é undefined?', results === undefined);
  console.log('📊 daily_performance existe?', !!results?.daily_performance);
  
  if (results?.daily_performance) {
    console.log('📊 Quantidade de dias:', results.daily_performance.length);
    console.log('📊 Primeiro dia:', results.daily_performance[0]);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  if (!results?.daily_performance) {
    console.warn('⚠️ [CorrelationAnalysisTab] SEM DADOS - Mostrando placeholder');
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800 font-semibold">📊 Execute uma análise na primeira aba primeiro</p>
        <p className="text-xs text-gray-600 mt-2">Debug: results = {JSON.stringify(results)}</p>
      </div>
    );
  }
  
  console.log('✅ [CorrelationAnalysisTab] PROCESSANDO DADOS...');

  // ========================================
  // 1. ANÁLISE POR DIA DA SEMANA
  // ========================================
  const analyzeByWeekday = () => {
    const weekdayStats = {};
    const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    results.daily_performance.forEach(day => {
      const date = new Date(day.date);
      const weekday = weekdayNames[date.getDay()];

      if (!weekdayStats[weekday]) {
        weekdayStats[weekday] = {
          weekday,
          operations: 0,
          greens: 0,
          reds: 0,
          rates: []
        };
      }

      const ops = day.green_count + day.red_count;
      weekdayStats[weekday].operations += ops;
      weekdayStats[weekday].greens += day.green_count;
      weekdayStats[weekday].reds += day.red_count;
      weekdayStats[weekday].rates.push(day.success_rate);
    });

    return Object.values(weekdayStats).map(stat => ({
      weekday: stat.weekday,
      avgRate: (stat.rates.reduce((a, b) => a + b, 0) / stat.rates.length * 100).toFixed(1),
      operations: stat.operations,
      greens: stat.greens,
      reds: stat.reds
    }));
  };

  // ========================================
  // 2. ANÁLISE POR VOLUME DE OPERAÇÕES
  // ========================================
  const analyzeByVolume = () => {
    const volumeRanges = [
      { range: '1-2', min: 1, max: 2, data: [] },
      { range: '3-5', min: 3, max: 5, data: [] },
      { range: '6-10', min: 6, max: 10, data: [] },
      { range: '11-20', min: 11, max: 20, data: [] },
      { range: '20+', min: 21, max: Infinity, data: [] }
    ];

    results.daily_performance.forEach(day => {
      const ops = day.green_count + day.red_count;
      const range = volumeRanges.find(r => ops >= r.min && ops <= r.max);
      if (range) {
        range.data.push(day.success_rate);
      }
    });

    return volumeRanges
      .filter(r => r.data.length > 0)
      .map(r => ({
        range: r.range,
        avgRate: (r.data.reduce((a, b) => a + b, 0) / r.data.length * 100).toFixed(1),
        days: r.data.length
      }));
  };

  // ========================================
  // 3. SCATTER PLOT: VOLUME vs PERFORMANCE
  // ========================================
  const getScatterData = () => {
    return results.daily_performance.map(day => {
      const ops = day.green_count + day.red_count;
      return {
        operations: ops,
        successRate: (day.success_rate * 100).toFixed(1),
        date: day.date,
        greens: day.green_count,
        reds: day.red_count
      };
    });
  };

  // ========================================
  // 4. ANÁLISE DE LIGAS
  // ========================================
  const analyzeByLeagues = () => {
    const leagueStats = {};

    results.daily_performance.forEach(day => {
      const leagues = day.leagues.join('+');
      if (!leagueStats[leagues]) {
        leagueStats[leagues] = {
          leagues,
          rates: [],
          operations: 0
        };
      }
      const ops = day.green_count + day.red_count;
      leagueStats[leagues].operations += ops;
      leagueStats[leagues].rates.push(day.success_rate);
    });

    return Object.values(leagueStats)
      .map(stat => ({
        leagues: stat.leagues,
        avgRate: (stat.rates.reduce((a, b) => a + b, 0) / stat.rates.length * 100).toFixed(1),
        operations: stat.operations,
        days: stat.rates.length
      }))
      .sort((a, b) => b.avgRate - a.avgRate)
      .slice(0, 10);
  };

  // ========================================
  // 5. COEFICIENTE DE CORRELAÇÃO (Volume vs Performance)
  // ========================================
  const calculateCorrelation = () => {
    const data = results.daily_performance.map(d => ({
      x: d.green_count + d.red_count,
      y: d.success_rate
    }));

    const n = data.length;
    const sumX = data.reduce((sum, p) => sum + p.x, 0);
    const sumY = data.reduce((sum, p) => sum + p.y, 0);
    const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumY2 = data.reduce((sum, p) => sum + p.y * p.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  // ========================================
  // DADOS PROCESSADOS
  // ========================================
  const weekdayData = analyzeByWeekday();
  const volumeData = analyzeByVolume();
  const scatterData = getScatterData();
  const leagueData = analyzeByLeagues();
  const correlation = calculateCorrelation();

  // ========================================
  // CUSTOM TOOLTIP
  // ========================================
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg text-sm">
          <p className="font-bold">{data.date}</p>
          <p>Operações: {data.operations}</p>
          <p>Taxa: {data.successRate}%</p>
          <p className="text-green-600">Greens: {data.greens}</p>
          <p className="text-red-600">Reds: {data.reds}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header Explicativo */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">🔍 Análise de Correlações</h3>
        <p className="text-sm text-blue-800">
          Identifica quais fatores influenciam a performance do gatilho (dia da semana, volume, ligas, etc.)
        </p>
      </div>

      {/* Coeficiente de Correlação */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📊 Correlação: Volume de Operações × Taxa de Acerto</h4>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold" style={{ color: correlation > 0 ? '#22c55e' : '#ef4444' }}>
            {correlation.toFixed(3)}
          </div>
          <div className="text-sm text-gray-600">
            {Math.abs(correlation) < 0.3 && <p>⚪ Correlação FRACA - Volume não influencia muito</p>}
            {Math.abs(correlation) >= 0.3 && Math.abs(correlation) < 0.7 && <p>🟡 Correlação MODERADA</p>}
            {Math.abs(correlation) >= 0.7 && <p>🔴 Correlação FORTE</p>}
            {correlation > 0 && <p className="text-green-600">✅ Mais operações = Melhor performance</p>}
            {correlation < 0 && <p className="text-red-600">⚠️ Mais operações = Pior performance</p>}
          </div>
        </div>
      </div>

      {/* Gráfico de Dispersão */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📈 Dispersão: Volume × Performance</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="operations" name="Operações" />
            <YAxis type="number" dataKey="successRate" name="Taxa (%)" />
            <ZAxis range={[50, 200]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={scatterData} fill="#3b82f6">
              {scatterData.map((entry, index) => (
                <Cell key={index} fill={entry.successRate >= 70 ? '#22c55e' : entry.successRate >= 50 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Análise por Dia da Semana */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📅 Performance por Dia da Semana</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weekdayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="weekday" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avgRate" fill="#3b82f6" name="Taxa Média (%)">
              {weekdayData.map((entry, index) => (
                <Cell key={index} fill={entry.avgRate >= 70 ? '#22c55e' : entry.avgRate >= 50 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {weekdayData.map((day, idx) => (
            <div key={idx} className="bg-gray-50 p-2 rounded">
              <p className="font-semibold">{day.weekday}</p>
              <p>Taxa: {day.avgRate}%</p>
              <p className="text-gray-600">Ops: {day.operations}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Análise por Volume */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📊 Performance por Volume de Operações</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgRate" fill="#8b5cf6" name="Taxa Média (%)">
              {volumeData.map((entry, index) => (
                <Cell key={index} fill={entry.avgRate >= 70 ? '#22c55e' : entry.avgRate >= 50 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Ligas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">🏆 Top 10 Combinações de Ligas</h4>
        <div className="space-y-2">
          {leagueData.map((league, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
              <div className="flex-1">
                <p className="font-medium text-sm">{league.leagues}</p>
                <p className="text-xs text-gray-600">{league.days} dias • {league.operations} operações</p>
              </div>
              <div className={`text-lg font-bold ${league.avgRate >= 70 ? 'text-green-600' : league.avgRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {league.avgRate}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights Automáticos */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <h4 className="font-semibold text-purple-900 mb-3">💡 Insights Automáticos</h4>
        <ul className="space-y-2 text-sm">
          {weekdayData.length > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                <strong>Melhor dia:</strong> {weekdayData.reduce((best, day) => parseFloat(day.avgRate) > parseFloat(best.avgRate) ? day : best).weekday} ({weekdayData.reduce((best, day) => parseFloat(day.avgRate) > parseFloat(best.avgRate) ? day : best).avgRate}%)
              </span>
            </li>
          )}
          {correlation !== 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                {Math.abs(correlation) >= 0.5 
                  ? `Volume de operações ${correlation > 0 ? 'aumenta' : 'diminui'} significativamente a performance` 
                  : 'Volume de operações tem baixa influência na performance'}
              </span>
            </li>
          )}
          {leagueData.length > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                <strong>Melhor combinação:</strong> {leagueData[0].leagues} ({leagueData[0].avgRate}% de acerto)
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CorrelationAnalysisTab;