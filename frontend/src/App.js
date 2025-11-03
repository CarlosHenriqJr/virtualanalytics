import React, { useState } from 'react';
import AnalysisPage from './pages/AnalysisPage.jsx';
import AITrainingDashboard from './components/AITrainingDashboard';
import AIInsightsDashboard from './components/AIInsightsDashboard';
import { Toaster } from './components/ui/toaster.jsx';
import './styles.css';

function App() {
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis', 'training', 'insights'
  const [dbConnected, setDbConnected] = useState(true); // ou false, dependendo da sua lógica

  return (
    <div className="App min-h-screen bg-gray-50">
      {/* Header com Navegação */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Título */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">⚽</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Futebol Virtual Analytics</h1>
                <p className="text-sm text-gray-600">Análise Inteligente de Apostas</p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
              Sistema Online
            </div>
          </div>

          {/* Tabs de Navegação */}
          <nav className="flex gap-2 mt-6 border-b">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'analysis'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              📊 Análise de Dados
            </button>

            <button
              onClick={() => setActiveTab('training')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'training'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              🤖 IA Training
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'insights'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              💡 Insights da IA
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === 'analysis' && <AnalysisPage />}
        {activeTab === 'training' && <AITrainingDashboard dbConnected={dbConnected} />}
        {activeTab === 'insights' && <AIInsightsDashboard />}
      </main>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}

export default App;