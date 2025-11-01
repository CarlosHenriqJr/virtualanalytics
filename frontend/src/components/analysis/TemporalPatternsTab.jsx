import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const TemporalPatternsTab = ({ results }) => {
  if (!results?.daily_performance) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800 font-semibold">Execute uma análise primeiro para ver os padrões temporais</p>
      </div>
    );
  }

  // ========================================
  // 1. DETECÇÃO DE SEQUÊNCIAS
  // ========================================
  const detectSequences = () => {
    let currentStreak = { type: null, count: 0, start: null };
    const streaks = [];
    const sortedDays = [...results.daily_performance].sort((a, b) => a.date.localeCompare(b.date));

    sortedDays.forEach((day, index) => {
      const type = day.success_rate >= 0.7 ? 'good' : day.success_rate < 0.5 ? 'bad' : 'neutral';

      if (type === currentStreak.type) {
        currentStreak.count++;
      } else {
        if (currentStreak.count >= 2) {
          streaks.push({ ...currentStreak });
        }
        currentStreak = { type, count: 1, start: day.date };
      }
    });

    if (currentStreak.count >= 2) {
      streaks.push(currentStreak);
    }

    return streaks;
  };

  // ========================================
  // 2. ANÁLISE DE TENDÊNCIA (Regressão Linear Simples)
  // ========================================
  const calculateTrend = () => {
    const sortedDays = [...results.daily_performance].sort((a, b) => a.date.localeCompare(b.date));
    const n = sortedDays.length;
    
    const x = sortedDays.map((_, i) => i);
    const y = sortedDays.map(d => d.success_rate * 100);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      slope,
      intercept,
      trend: slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
      projection: sortedDays.map((_, i) => ({
        index: i,
        value: (slope * i + intercept).toFixed(1)
      }))
    };
  };

  // ========================================
  // 3. ANÁLISE SEMANAL (Dia 1-7, Dia 8-14, etc)
  // ========================================
  const analyzeWeeklyPerformance = () => {
    const sortedDays = [...results.daily_performance].sort((a, b) => a.date.localeCompare(b.date));
    const weeks = [];
    let currentWeek = { week: 1, days: [] };

    sortedDays.forEach((day, index) => {
      currentWeek.days.push(day);

      if ((index + 1) % 7 === 0 || index === sortedDays.length - 1) {
        const avgRate = currentWeek.days.reduce((sum, d) => sum + d.success_rate, 0) / currentWeek.days.length;
        const totalOps = currentWeek.days.reduce((sum, d) => sum + d.green_count + d.red_count, 0);
        
        weeks.push({
          week: `Semana ${currentWeek.week}`,
          avgRate: (avgRate * 100).toFixed(1),
          totalOps,
          days: currentWeek.days.length
        });

        currentWeek = { week: currentWeek.week + 1, days: [] };
      }
    });

    return weeks;
  };

  // ========================================
  // 4. HEATMAP (Performance por Semana do Mês)
  // ========================================
  const analyzeByWeekOfMonth = () => {
    const stats = { 1: [], 2: [], 3: [], 4: [] };

    results.daily_performance.forEach(day => {
      const date = new Date(day.date);
      const dayOfMonth = date.getDate();
      const week = Math.ceil(dayOfMonth / 7);

      if (week >= 1 && week <= 4) {
        stats[week].push(day.success_rate);
      }
    });

    return Object.entries(stats).map(([week, rates]) => ({
      week: `Semana ${week}`,
      avgRate: rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length * 100).toFixed(1) : 0,
      days: rates.length
    }));
  };

  // ========================================
  // 5. ANÁLISE DE CICLOS (Autocorrelação Simples)
  // ========================================
  const detectCycles = () => {
    const sortedDays = [...results.daily_performance].sort((a, b) => a.date.localeCompare(b.date));
    const rates = sortedDays.map(d => d.success_rate);
    
    // Testar ciclos de 7, 14 e 30 dias
    const cycleLengths = [7, 14, 30];
    const results_cycles = [];

    cycleLengths.forEach(cycle => {
      if (rates.length >= cycle * 2) {
        let correlation = 0;
        const comparisons = rates.length - cycle;

        for (let i = 0; i < comparisons; i++) {
          correlation += (rates[i] - 0.5) * (rates[i + cycle] - 0.5);
        }

        correlation = correlation / comparisons;

        results_cycles.push({
          cycle: `${cycle} dias`,
          correlation: correlation.toFixed(3),
          strength: Math.abs(correlation) > 0.1 ? 'Detectado' : 'Não detectado'
        });
      }
    });

    return results_cycles;
  };

  // ========================================
  // DADOS PROCESSADOS
  // ========================================
  const sequences = detectSequences();
  const trend = calculateTrend();
  const weeklyData = analyzeWeeklyPerformance();
  const weekOfMonthData = analyzeByWeekOfMonth();
  const cycles = detectCycles();

  // Dados para gráfico de tendência
  const trendChartData = [...results.daily_performance]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day, index) => ({
      date: day.date.slice(5),
      real: (day.success_rate * 100).toFixed(1),
      trend: trend.projection[index]?.value || 0
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
        <h3 className="font-semibold text-purple-900 mb-2">⏰ Análise de Padrões Temporais</h3>
        <p className="text-sm text-purple-800">
          Identifica ciclos, tendências e padrões de quando o gatilho funciona melhor
        </p>
      </div>

      {/* Análise de Tendência */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📈 Tendência ao Longo do Tempo</h4>
        <div className="mb-4 p-4 rounded" style={{ 
          backgroundColor: trend.trend === 'improving' ? '#dcfce7' : trend.trend === 'declining' ? '#fee2e2' : '#f3f4f6' 
        }}>
          <div className="flex items-center gap-3">
            <div className="text-4xl">
              {trend.trend === 'improving' && '📈'}
              {trend.trend === 'declining' && '📉'}
              {trend.trend === 'stable' && '➡️'}
            </div>
            <div>
              <p className="font-bold text-lg">
                {trend.trend === 'improving' && 'Tendência de MELHORA'}
                {trend.trend === 'declining' && 'Tendência de PIORA'}
                {trend.trend === 'stable' && 'Tendência ESTÁVEL'}
              </p>
              <p className="text-sm text-gray-600">
                Inclinação: {trend.slope > 0 ? '+' : ''}{trend.slope.toFixed(3)} pontos/dia
              </p>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="real" stroke="#3b82f6" fill="#93c5fd" name="Taxa Real (%)" />
            <Line type="monotone" dataKey="trend" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Linha de Tendência" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sequências Detectadas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">🔄 Sequências Detectadas</h4>
        {sequences.length > 0 ? (
          <div className="space-y-2">
            {sequences.map((seq, idx) => (
              <div key={idx} className={`p-3 rounded flex items-center justify-between ${
                seq.type === 'good' ? 'bg-green-50 border border-green-200' : 
                seq.type === 'bad' ? 'bg-red-50 border border-red-200' : 
                'bg-gray-50 border border-gray-200'
              }`}>
                <div>
                  <p className="font-medium">
                    {seq.type === 'good' && '✅ Sequência BOA'}
                    {seq.type === 'bad' && '❌ Sequência RUIM'}
                    {seq.type === 'neutral' && '⚪ Sequência NEUTRA'}
                  </p>
                  <p className="text-sm text-gray-600">Início: {seq.start}</p>
                </div>
                <div className="text-2xl font-bold">
                  {seq.count} dias
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-4">Nenhuma sequência significativa detectada</p>
        )}
      </div>

      {/* Performance Semanal */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📊 Performance por Semana</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="avgRate" stroke="#8b5cf6" strokeWidth={2} name="Taxa Média (%)" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {weeklyData.map((week, idx) => (
            <div key={idx} className="bg-gray-50 p-2 rounded">
              <p className="font-semibold">{week.week}</p>
              <p>Taxa: {week.avgRate}%</p>
              <p className="text-gray-600">Ops: {week.totalOps}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Análise por Semana do Mês */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">📅 Performance por Semana do Mês</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {weekOfMonthData.map((data, idx) => (
            <div key={idx} className={`p-4 rounded text-center ${
              parseFloat(data.avgRate) >= 70 ? 'bg-green-50 border border-green-200' :
              parseFloat(data.avgRate) >= 50 ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm text-gray-600 mb-1">{data.week}</p>
              <p className="text-3xl font-bold">{data.avgRate}%</p>
              <p className="text-xs text-gray-600 mt-1">{data.days} dias</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detecção de Ciclos */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold mb-3">🔄 Detecção de Ciclos</h4>
        <p className="text-sm text-gray-600 mb-4">
          Testa se existe repetição de padrões em intervalos regulares (7, 14 ou 30 dias)
        </p>
        <div className="space-y-2">
          {cycles.map((cycle, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">Ciclo de {cycle.cycle}</p>
                <p className="text-xs text-gray-600">Correlação: {cycle.correlation}</p>
              </div>
              <div className={`px-3 py-1 rounded text-sm font-semibold ${
                cycle.strength === 'Detectado' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {cycle.strength}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights Temporais */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <h4 className="font-semibold text-purple-900 mb-3">💡 Insights Temporais</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-purple-500">•</span>
            <span>
              Performance está em <strong>{
                trend.trend === 'improving' ? 'MELHORA' : 
                trend.trend === 'declining' ? 'PIORA' : 
                'ESTABILIDADE'
              }</strong> ao longo do tempo
            </span>
          </li>
          {sequences.filter(s => s.type === 'good').length > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                Maior sequência boa: <strong>{Math.max(...sequences.filter(s => s.type === 'good').map(s => s.count))} dias consecutivos</strong>
              </span>
            </li>
          )}
          {sequences.filter(s => s.type === 'bad').length > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                Maior sequência ruim: <strong>{Math.max(...sequences.filter(s => s.type === 'bad').map(s => s.count))} dias consecutivos</strong>
              </span>
            </li>
          )}
          {cycles.some(c => c.strength === 'Detectado') && (
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span>
                <strong>Ciclos detectados:</strong> {cycles.filter(c => c.strength === 'Detectado').map(c => c.cycle).join(', ')}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default TemporalPatternsTab;