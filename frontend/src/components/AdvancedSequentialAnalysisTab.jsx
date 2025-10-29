/**
 * AdvancedSequentialAnalysisTab.jsx
 * 
 * Componente para exibir análise sequencial avançada conforme especificação:
 * - Distribuição por hora
 * - Padrões recorrentes (sequências de placares e combinações de mercados)
 * - Comportamento em blocos (clusters temporais)
 * - Recomendações
 */

import React from 'react';
import { Button } from './ui/button.jsx';

export default function AdvancedSequentialAnalysisTab({ 
  analysisData, 
  loading, 
  onAnalyze, 
  selectedMarket,
  dbConnected,
  lookbackGames,
  setLookbackGames,
  referenceDate,
  setReferenceDate,
  availableDates
}) {
  
  if (!dbConnected) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-semibold">Banco de Dados Desconectado</p>
      </div>
    );
  }

  if (!analysisData && !loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-semibold">Análise Sequencial Avançada</p>
        <div className="max-w-md mx-auto mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Janela Retroativa (N jogos anteriores)
          </label>
          <input
            type="number"
            value={lookbackGames}
            onChange={(e) => setLookbackGames(parseInt(e.target.value) || 20)}
            min="5"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
         <div className="max-w-md mx-auto mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Referência
            </label>
            <input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            min={availableDates.oldest || undefined}
            max={availableDates.newest || undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
        </div>
        <Button
          onClick={onAnalyze}
          disabled={!selectedMarket}
        >
          {!selectedMarket ? 'Selecione um mercado' : 'Executar Análise Sequencial'}
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Analisando...</div>;
  }

  const data = analysisData;

  return (
    <div className="space-y-6">
      {data ? (
        <>
            <h2 className="text-2xl font-bold">Análise Diária – {data.date}</h2>
            <p>Mercado-alvo: {data.target_market}</p>
            <p>Total de ocorrências: {data.total_occurrences}</p>
            
            <h3>Distribuição por Hora</h3>
            {data.hourly_distribution.map(item => <p key={item.hour}>{item.hour}h: {item.percentage.toFixed(1)}%</p>)}
        </>
      ) : <p>Nenhum dado de análise.</p>}
    </div>
  );
}