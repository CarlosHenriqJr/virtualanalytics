import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  // Use APP_LOGO (as image src) and APP_TITLE if needed
  const APP_TITLE = "Futebol Virtual Analytics";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="text-center space-y-8 p-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            {APP_TITLE}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Ferramenta de análise de dados de futebol virtual para identificar gatilhos e padrões em dados históricos.
          </p>
        </div>
        
        <div className="flex gap-4 justify-center">
          <Link to="/analysis">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors">
              Acessar Análise de Gatilhos
            </button>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Análise de Gatilhos</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Identifique os melhores gatilhos de entrada para mercados específicos
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Análise Histórica</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Explore a efetividade de gatilhos ao longo do tempo
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Dados Históricos</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Acesse 6 meses de dados de partidas de futebol virtual
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

