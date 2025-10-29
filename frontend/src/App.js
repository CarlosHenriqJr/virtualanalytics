import React from 'react';
import AnalysisPage from './pages/AnalysisPage.jsx';
import { Toaster } from './components/ui/toaster.jsx';
import './styles.css';

function App() {
  return (
    <div className="App">
      <AnalysisPage />
      <Toaster />
    </div>
  );
}

export default App;