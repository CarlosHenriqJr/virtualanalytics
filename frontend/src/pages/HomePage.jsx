import React, { useState, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { Eye, EyeOff, BarChart3 } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import DateSelector from '../components/DateSelector';
import MatchGrid from '../components/MatchGrid';
import MatchModal from '../components/MatchModal';
import FilterButtons from '../components/FilterButtons';
import Rankings from '../components/Rankings';
import PredictiveAnalysis from '../components/PredictiveAnalysis';
import PatternAnalysis from '../components/PatternAnalysis';
import { Button } from '../components/ui/button';
import { Toaster } from '../components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { mockMatches } from '../data/mockData';

const HomePage = () => {
  const [matches, setMatches] = useState(mockMatches);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showHT, setShowHT] = useState(false);
  const [filterMode, setFilterMode] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Extrai datas disponíveis dos dados
  const availableDates = useMemo(() => {
    const dates = [...new Set(matches.map(m => m.date))];
    return dates.sort();
  }, [matches]);

  // Define primeira data automaticamente
  React.useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      const firstDate = parse(availableDates[0], 'yyyy-MM-dd', new Date());
      setSelectedDate(firstDate);
    }
  }, [availableDates, selectedDate]);

  // Filtra partidas pela data selecionada
  const filteredMatches = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return matches.filter(m => m.date === dateStr);
  }, [matches, selectedDate]);

  const handleFileLoaded = (loadedMatches) => {
    setMatches(loadedMatches);
    setSelectedDate(null); // Reset para forçar recalculo
  };

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
  };

  const hasData = matches.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <Toaster />
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Futebol Virtual Analytics
              </h1>
              <p className="text-gray-400 mt-1">Análise completa de partidas virtuais</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!hasData ? (
          <div className="max-w-2xl mx-auto mt-12">
            <FileUpload onFileLoaded={handleFileLoaded} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Controles */}
            <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800 space-y-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <DateSelector
                  selectedDate={selectedDate}
                  availableDates={availableDates}
                  onDateChange={setSelectedDate}
                />
                
                <Button
                  onClick={() => setShowHT(!showHT)}
                  variant="outline"
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
                >
                  {showHT ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Esconder HT
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Mostrar HT
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setMatches([]);
                    setSelectedDate(null);
                  }}
                  variant="outline"
                  className="bg-blue-600 border-blue-500 hover:bg-blue-700 text-white"
                >
                  Carregar Novo Arquivo
                </Button>
              </div>

              <FilterButtons
                filterMode={filterMode}
                onFilterChange={setFilterMode}
                showLegend={true}
              />
            </div>

            {/* Grid de Partidas */}
            {selectedDate && filteredMatches.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    Grade de Partidas - {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: require('date-fns/locale/pt-BR').ptBR })}
                  </h2>
                  <span className="text-gray-400">
                    {filteredMatches.length} partida(s)
                  </span>
                </div>
                
                <MatchGrid
                  matches={filteredMatches}
                  showHT={showHT}
                  filterMode={filterMode}
                  onMatchClick={handleMatchClick}
                />
              </div>
            ) : (
              <div className="bg-gray-900/50 p-12 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400 text-lg">
                  {selectedDate
                    ? 'Nenhuma partida encontrada para esta data'
                    : 'Selecione uma data para visualizar as partidas'}
                </p>
              </div>
            )}

            {/* Rankings */}
            {selectedDate && filteredMatches.length > 0 && (
              <Rankings matches={filteredMatches} />
            )}
          </div>
        )}
      </main>

      {/* Modal de detalhes */}
      <MatchModal
        match={selectedMatch}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 py-8 bg-gray-950">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>© 2025 Futebol Virtual Analytics - Powered by Emergent</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;