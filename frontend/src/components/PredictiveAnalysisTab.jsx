/**
 * PredictiveAnalysisTab.jsx - Componente de Análise Preditiva
 * 
 * Exibe padrões preditivos identificados para um mercado específico,
 * mostrando placares HT/FT e mercados/odds mais frequentes antes do mercado ganhar.
 */

import React from 'react';
import { Button } from './ui/button.jsx';

export default function PredictiveAnalysisTab({ 
  predictiveAnalysis, 
  loading,
  onAnalyze,
  selectedMarket,
  dbConnected 
}) {
  
  if (!predictiveAnalysis) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium mb-2">Análise Preditiva</p>
        <p className="text-sm mb-4">Descubra gatilhos para prever quando um mercado vai ganhar.</p>
        <Button
          onClick={onAnalyze}
          disabled={!dbConnected || loading || !selectedMarket}
        >
          {loading ? 'Analisando...' : 'Iniciar Análise Preditiva'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {predictiveAnalysis && predictiveAnalysis.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mt-6 mb-4">Análise Diária de Padrões</h3>
          <div className="space-y-4">
            {predictiveAnalysis.map((daily, index) => (
              <div key={index} className="border p-4 rounded-lg">
                <h4 className="font-semibold">{daily.date}</h4>
                <p>Taxa de Sucesso: {(daily.success_rate * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}