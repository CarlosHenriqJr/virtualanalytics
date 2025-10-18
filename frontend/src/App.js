import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MatchesProvider } from './contexts/MatchesContext';
import HomePage from './pages/HomePage';
import PatternAnalysisPage from './pages/PatternAnalysisPage';
import './App.css';

function App() {
  return (
    <div className="App">
      <MatchesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pattern-analysis" element={<PatternAnalysisPage />} />
          </Routes>
        </BrowserRouter>
      </MatchesProvider>
    </div>
  );
}

export default App;