import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';

const API_BASE_URL = 'http://localhost:8000';

export default function PatternDiscoveryTab({
  selectedMarket,
  dbConnected,
  availableDates
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(20);
  const [minEntries, setMinEntries] = useState(1);
  const [maxEntries, setMaxEntries] = useState(5);
  
  const [discoveryResults, setDiscoveryResults] = useState(null);

  const handleDiscoverPatterns = async () => {
    if (!selectedMarket || !startDate || !endDate) {
      setError('Selecione mercado e período de análise.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/pattern-discovery/discover-patterns`, {
        target_market: selectedMarket,
        start_date: startDate,
        end_date: endDate,
        min_delay: parseInt(minDelay),
        max_delay: parseInt(maxDelay),
        min_entries: parseInt(minEntries),
        max_entries: parseInt(maxEntries)
      });
      setDiscoveryResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Erro ao descobrir padrões.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Descoberta Automática de Padrões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={availableDates?.oldest} max={availableDates?.newest} disabled={!dbConnected || loading} />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={availableDates?.oldest} max={availableDates?.newest} disabled={!dbConnected || loading} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleDiscoverPatterns} disabled={!dbConnected || loading || !selectedMarket}>
                {loading ? 'Descobrindo...' : 'Descobrir Padrões'}
              </Button>
            </div>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {discoveryResults && (
        <Card>
          <CardHeader>
            <CardTitle>Padrões Encontrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Dias analisados: {discoveryResults.total_days_analyzed}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}