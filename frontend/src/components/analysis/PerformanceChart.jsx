import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';

const PerformanceChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500">
        Nenhum dado disponível para exibir o gráfico
      </div>
    );
  }

  // Preparar dados para o gráfico
  const chartData = data.map((day) => ({
    date: day.date.slice(5), // "2024-01-15" -> "01-15"
    taxa: (day.success_rate * 100).toFixed(1),
    entradas: day.total_matches,
    greens: day.green_count,
    reds: day.red_count,
    sg: day.gale_breakdown.SG || 0,
    g1: day.gale_breakdown.G0 || 0,
    g2: day.gale_breakdown.G1 || 0,
    g3: day.gale_breakdown.G2 || 0,
  }));

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600 font-semibold">Taxa: {data.taxa}%</p>
            <p className="text-gray-700">Entradas: {data.entradas}</p>
            <p className="text-green-600">✅ Greens: {data.greens}</p>
            <p className="text-red-600">❌ Reds: {data.reds}</p>
            <div className="border-t pt-1 mt-1">
              <p className="text-xs text-gray-600">SG: {data.sg} | G1: {data.g1} | G2: {data.g2} | G3: {data.g3}</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Gráfico 1: Linha de Taxa de Sucesso */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Taxa de Acerto ao Longo do Tempo</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Taxa (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="taxa"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
              name="Taxa de Acerto (%)"
            />
            {/* Linha de referência em 70% */}
            <Line
              type="monotone"
              dataKey={() => 70}
              stroke="#22c55e"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Meta 70%"
            />
            {/* Linha de referência em 50% */}
            <Line
              type="monotone"
              dataKey={() => 50}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Limite 50%"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 2: Greens vs Reds */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Distribuição de Greens e Reds</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="greens" fill="#22c55e" name="Greens ✅" />
            <Bar dataKey="reds" fill="#ef4444" name="Reds ❌" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 3: Distribuição de Gales */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Distribuição de Gales (SG, G1, G2, G3)</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="sg" stackId="a" fill="#10b981" name="SG (Sem Gale)" />
            <Bar dataKey="g1" stackId="a" fill="#3b82f6" name="G1 (1º Gale)" />
            <Bar dataKey="g2" stackId="a" fill="#f59e0b" name="G2 (2º Gale)" />
            <Bar dataKey="g3" stackId="a" fill="#ef4444" name="G3 (3º Gale)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 4: Composição (Taxa + Volume) */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Taxa de Acerto + Volume de Entradas</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="right" dataKey="entradas" fill="#94a3b8" name="Volume de Entradas" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="taxa"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Taxa de Acerto (%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;