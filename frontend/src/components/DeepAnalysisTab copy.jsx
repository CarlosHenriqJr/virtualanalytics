import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import { Calendar, Users, BarChart, Zap, Clock } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const DeepAnalysisTab = ({ availableDates, dbConnected }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [teams, setTeams] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [analysisMode, setAnalysisMode] = useState('specific_day');

    useEffect(() => {
        if(availableDates.newest) {
            setSelectedDate(availableDates.newest);
        }
        
const fetchTeams = async () => {
    if (!dbConnected) {
        setTeamsLoading(false);
        return;
    }
    
    try {
        setTeamsLoading(true);
        
        // ✅ USAR O NOVO ENDPOINT
        const response = await axios.get(`${API_BASE_URL}/deep-pattern/teams`, {
            params: {
                start_date: availableDates?.oldest,
                end_date: availableDates?.newest
            }
        });
        
        const teamsList = response.data.teams || [];
        setTeams(teamsList);
        
        if (teamsList.length > 0) {
            setSelectedTeam(teamsList[0]);
        }
        
    } catch (err) {
        console.error("Erro ao carregar times:", err);
        setError("Erro ao carregar lista de times");
        setTeams([]);
    } finally {
        setTeamsLoading(false);
    }
};

fetchTeams();
    }, [dbConnected, availableDates]);

    const handleAnalyze = async () => {
        if (!selectedTeam) {
            setError('Por favor, selecione um time para a análise.');
            return;
        }

        if (analysisMode === 'specific_day' && !selectedDate) {
            setError('Por favor, selecione uma data para a análise.');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/deep-pattern/full`, {
                team_name: selectedTeam,
                start_date: availableDates.oldest,
                end_date: selectedDate || availableDates.newest
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao realizar a análise.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Análise Profunda e Preditiva</CardTitle>
                    <CardDescription>
                        Explore tendências, time do dia, comportamento de linhas, odds e placares raros.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Modo de Análise</Label>
                            <Select value={analysisMode} onValueChange={setAnalysisMode}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="specific_day">Dia Específico</SelectItem>
                                    <SelectItem value="full_history">Histórico Completo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Data de Referência</Label>
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                min={availableDates?.oldest}
                                max={availableDates?.newest}
                                disabled={loading || analysisMode !== 'specific_day'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Time para Análise</Label>
                            <Select 
                                value={selectedTeam} 
                                onValueChange={setSelectedTeam} 
                                disabled={loading || teamsLoading || teams.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue>
                                        {teamsLoading ? "Carregando times..." : 
                                         teams.length === 0 ? "Nenhum time encontrado" : 
                                         selectedTeam || "Selecione um time"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {teams.map(team => (
                                        <SelectItem key={team} value={team}>
                                            {team}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {teamsLoading && (
                                <p className="text-sm text-gray-500">Buscando times disponíveis...</p>
                            )}
                            {!teamsLoading && teams.length === 0 && (
                                <p className="text-sm text-red-500">Nenhum time encontrado no banco de dados</p>
                            )}
                        </div>
                        <div className="flex items-end">
                            <Button 
                                onClick={handleAnalyze} 
                                disabled={loading || !dbConnected || !selectedTeam || teams.length === 0} 
                                className="w-full"
                            >
                                {loading ? 'Analisando...' : 'Executar Análise'}
                            </Button>
                        </div>
                    </div>
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                </CardContent>
            </Card>

            {results && (
                <div className="space-y-6">
                    {/* ✅ AJUSTE: A estrutura dos resultados pode ser diferente do esperado */}
                    {results.executive_summary && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar />Resumo Executivo - {results.executive_summary.team}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-semibold">
                                    Performance: {results.executive_summary.performance?.rating} 
                                    ({results.executive_summary.performance?.over35_rate}% Over 3.5)
                                </p>
                                <p className="text-sm text-gray-600">
                                    Período: {results.executive_summary.period}
                                </p>
                                <div className="mt-2">
                                    <h4 className="font-semibold">Fatores Chave:</h4>
                                    <ul className="list-disc list-inside">
                                        {results.executive_summary.key_factors?.map((factor, index) => (
                                            <li key={index} className="text-sm">{factor}</li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {results.team_analysis && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users />Análise do Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p><strong>Taxa Over 3.5:</strong> {results.team_analysis.over35_rate}%</p>
                                <p><strong>Total de Jogos:</strong> {results.team_analysis.total_games}</p>
                                <p><strong>Jogos Over 3.5:</strong> {results.team_analysis.over35_games}</p>
                                
                                <div className="mt-3">
                                    <h4 className="font-semibold">Insights:</h4>
                                    <ul className="list-disc list-inside">
                                        {results.team_analysis.insights?.map((insight, index) => (
                                            <li key={index} className="text-sm">{insight}</li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {results.prediction_data?.next_team_prediction && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap />Predição do Time do Dia
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xl font-bold">
                                    {results.prediction_data.next_team_prediction.predicted_team}
                                </p>
                                <p className="text-sm">
                                    Confiança: {results.prediction_data.next_team_prediction.confidence}%
                                </p>
                                <div className="mt-2">
                                    <h4 className="font-semibold">Raciocínio:</h4>
                                    <ul className="list-disc list-inside">
                                        {results.prediction_data.next_team_prediction.reasoning?.map((reason, index) => (
                                            <li key={index} className="text-sm">{reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {results.actionable_insights && results.actionable_insights.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart />Insights Acionáveis
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-2">
                                    {results.actionable_insights.map((insight, index) => (
                                        <li key={index} className="text-sm">{insight}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeepAnalysisTab;