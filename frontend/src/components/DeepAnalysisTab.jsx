import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import { Calendar, Users, BarChart, Zap, Clock, Shield, TrendingUp, Target, Loader2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const DeepAnalysisTab = ({ availableDates, dbConnected }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [teams, setTeams] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [analysisMode, setAnalysisMode] = useState('specific_day');

    useEffect(() => {
        if(availableDates.newest) {
            setSelectedDate(availableDates.newest);
        }
        
        // ✅ CARREGAR TIMES AUTOMATICAMENTE AO INICIAR
        loadTeams();
    }, [dbConnected, availableDates]);

    const loadTeams = async () => {
        if (teams.length > 0 || !dbConnected) return;
        
        setTeamsLoading(true);
        try {
            // ✅ PRIMEIRO TENTA O ENDPOINT ESPECÍFICO DE TIMES
            try {
                const response = await axios.get(`${API_BASE_URL}/deep-pattern/teams`);
                const teamsData = response.data.teams || [];
                
                // ✅ FILTRAR VALORES VAZIOS E INVÁLIDOS
                const validTeams = teamsData.filter(team => 
                    team && 
                    team.trim() !== '' && 
                    team !== 'null' && 
                    team !== 'undefined'
                ).sort();
                
                setTeams(validTeams);
                
                if (validTeams.length > 0 && !selectedTeam) {
                    setSelectedTeam(validTeams[0]);
                }
            } catch (teamsError) {
                console.log("Endpoint de times não disponível, buscando de matches...");
                
                // ✅ FALLBACK: BUSCAR TIMES DAS PARTIDAS
                const matchesResponse = await axios.get(`${API_BASE_URL}/analysis/matches`, {
                    params: { limit: 500 }
                });
                
                const matches = matchesResponse.data.matches || [];
                const uniqueTeams = new Set();
                
                matches.forEach(match => {
                    if (match.timeCasa && match.timeCasa.trim() && match.timeCasa.trim() !== '') {
                        uniqueTeams.add(match.timeCasa.trim());
                    }
                    if (match.timeFora && match.timeFora.trim() && match.timeFora.trim() !== '') {
                        uniqueTeams.add(match.timeFora.trim());
                    }
                });
                
                // ✅ CONVERTER PARA ARRAY E FILTRAR VALORES VÁLIDOS
                const teamsList = Array.from(uniqueTeams)
                    .filter(team => team && team.trim() !== '')
                    .sort();
                
                setTeams(teamsList);
                
                if (teamsList.length > 0 && !selectedTeam) {
                    setSelectedTeam(teamsList[0]);
                }
            }
            
        } catch (err) {
            console.error("Erro ao carregar times:", err);
            setError("Não foi possível carregar a lista de times");
        } finally {
            setTeamsLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedTeam) {
            setError('Por favor, selecione um time para a análise.');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/deep-pattern/full`, {
                team_name: selectedTeam,
                start_date: availableDates.oldest,
                end_date: analysisMode === 'specific_day' ? selectedDate : availableDates.newest
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao realizar a análise.');
        } finally {
            setLoading(false);
        }
    };

    // ✅ FUNÇÃO PARA RENDERIZAR ANÁLISE DE ADVERSÁRIOS (mantida igual)
    const renderOpponentAnalysis = (teamAnalysis) => {
        if (!teamAnalysis?.similarity_analysis?.position_analysis?.opponent_analysis) return null;
        
        const opponentAnalysis = teamAnalysis.similarity_analysis.position_analysis.opponent_analysis;
        
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield /> Análise dos Adversários em Over 3.5
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">
                                {opponentAnalysis.avg_opponent_position || 'N/A'}
                            </p>
                            <p className="text-sm">Posição Média dos Adversários</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">
                                {opponentAnalysis.total_unique_opponents || 0}
                            </p>
                            <p className="text-sm">Adversários Diferentes</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">
                                {opponentAnalysis.strongest_opponent ? opponentAnalysis.strongest_opponent.opponent : 'N/A'}
                            </p>
                            <p className="text-sm">Adversário Mais Forte</p>
                        </div>
                    </div>

                    {opponentAnalysis.most_common_opponents && opponentAnalysis.most_common_opponents.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-3">Adversários Mais Frequentes:</h4>
                            <div className="space-y-2">
                                {opponentAnalysis.most_common_opponents.slice(0, 5).map((opponent, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                            <span className="font-medium">{opponent.opponent}</span>
                                            <span className="text-sm text-gray-600 ml-2">
                                                (Posição média: {opponent.avg_position}ª)
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold">{opponent.count} jogos</span>
                                            <span className="text-sm text-gray-600 block">
                                                {opponent.frequency_rate}% dos Over 3.5
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    // ✅ FUNÇÃO PARA RENDERIZAR ANÁLISE DE HORÁRIOS (mantida igual)
    const renderTimeAnalysis = (teamAnalysis) => {
        if (!teamAnalysis?.similarity_analysis?.matchup_analysis?.time_patterns) return null;
        
        const timeAnalysis = teamAnalysis.similarity_analysis.matchup_analysis.time_patterns;
        
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock /> Padrões de Horário em Over 3.5
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">
                                {timeAnalysis.total_time_slots || 0}
                            </p>
                            <p className="text-sm">Horários Diferentes</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-2xl font-bold text-red-600">
                                {timeAnalysis.time_with_most_goals ? timeAnalysis.time_with_most_goals.avg_total_goals : 'N/A'}
                            </p>
                            <p className="text-sm">Média de Gols no Melhor Horário</p>
                        </div>
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600">
                                {timeAnalysis.most_common_times?.[0]?.frequency_rate || 0}%
                            </p>
                            <p className="text-sm">Frequência do Horário Principal</p>
                        </div>
                    </div>

                    {timeAnalysis.most_common_times && timeAnalysis.most_common_times.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-3">Horários Mais Comuns:</h4>
                            <div className="space-y-2">
                                {timeAnalysis.most_common_times.map((timeSlot, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                            <span className="font-medium">{timeSlot.time}</span>
                                            <span className="text-sm text-gray-600 ml-2">
                                                {timeSlot.home_games} casa / {timeSlot.away_games} fora
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold">{timeSlot.count} jogos</span>
                                            <span className="text-sm text-gray-600 block">
                                                {timeSlot.frequency_rate}% • {timeSlot.avg_total_goals} gols/média
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    // ✅ FUNÇÃO PARA RENDERIZAR ANÁLISE DE ODDS (mantida igual)
    const renderOddsAnalysis = (teamAnalysis) => {
        if (!teamAnalysis?.similarity_analysis?.odds_analysis) return null;
        
        const oddsAnalysis = teamAnalysis.similarity_analysis.odds_analysis;
        
        if (!oddsAnalysis.available) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp /> Análise de Odds
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600">{oddsAnalysis.note}</p>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp /> Padrões de Odds em Over 3.5
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">
                                {oddsAnalysis.average_odds}
                            </p>
                            <p className="text-sm">Odds Média</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">
                                {oddsAnalysis.coverage_rate}%
                            </p>
                            <p className="text-sm">Cobertura de Dados</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">
                                {oddsAnalysis.most_common_range}
                            </p>
                            <p className="text-sm">Faixa Mais Comum</p>
                        </div>
                    </div>

                    {oddsAnalysis.odds_distribution && (
                        <div>
                            <h4 className="font-semibold mb-3">Distribuição das Odds:</h4>
                            <div className="space-y-2">
                                {Object.entries(oddsAnalysis.odds_distribution).map(([range, count]) => (
                                    <div key={range} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span className="font-medium">{range}</span>
                                        <div className="text-right">
                                            <span className="font-bold">{count} jogos</span>
                                            <span className="text-sm text-gray-600 block">
                                                {((count / oddsAnalysis.total_games_with_odds) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Análise Profunda e Preditiva</CardTitle>
                    <CardDescription>
                        Análise detalhada de padrões, adversários, horários e odds para times específicos
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Modo de Análise</Label>
                            <Select value={analysisMode} onValueChange={setAnalysisMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o modo" />
                                </SelectTrigger>
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
                                disabled={loading || teamsLoading || !dbConnected}
                            >
                                <SelectTrigger>
                                    <SelectValue>
                                        {teamsLoading ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Carregando times...
                                            </span>
                                        ) : selectedTeam ? (
                                            selectedTeam
                                        ) : (
                                            "Selecione um time"
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {/* ✅ GARANTIR QUE NENHUM Select.Item TENHA VALUE VAZIO */}
                                    {teams.map(team => (
                                        <SelectItem key={team} value={team}>
                                            {team}
                                        </SelectItem>
                                    ))}
                                    {teams.length === 0 && !teamsLoading && (
                                        <SelectItem value="no-teams" disabled>
                                            Nenhum time encontrado
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {teamsLoading && (
                                <p className="text-xs text-gray-500">Buscando times disponíveis...</p>
                            )}
                            {!teamsLoading && teams.length > 0 && (
                                <p className="text-xs text-gray-500">
                                    {teams.length} times disponíveis
                                </p>
                            )}
                        </div>
                        
                        <div className="flex items-end">
                            <Button 
                                onClick={handleAnalyze} 
                                disabled={loading || !dbConnected || !selectedTeam || teamsLoading} 
                                className="w-full"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Analisando...
                                    </span>
                                ) : 'Executar Análise'}
                            </Button>
                        </div>
                    </div>
                    
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {results && (
                <div className="space-y-6">
                    {/* Resumo Executivo */}
                    {results.executive_summary && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar />Resumo Executivo - {results.executive_summary.team}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                        <p className="text-2xl font-bold text-blue-600">
                                            {results.executive_summary.performance?.over35_rate}%
                                        </p>
                                        <p className="text-sm">Taxa Over 3.5</p>
                                    </div>
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                        <p className="text-2xl font-bold text-green-600">
                                            {results.executive_summary.performance?.rating}
                                        </p>
                                        <p className="text-sm">Performance</p>
                                    </div>
                                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                                        <p className="text-2xl font-bold text-orange-600">
                                            {results.executive_summary.risk_level?.split(' ')[0]}
                                        </p>
                                        <p className="text-sm">Nível de Risco</p>
                                    </div>
                                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                                        <p className="text-2xl font-bold text-purple-600">
                                            {results.executive_summary.opportunity_score}
                                        </p>
                                        <p className="text-sm">Score Oportunidade</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Análise do Time com Novas Métricas */}
                    {results.team_analysis && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users />Análise Detalhada do Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                                            <p className="text-2xl font-bold text-blue-600">
                                                {results.team_analysis.over35_rate}%
                                            </p>
                                            <p className="text-sm">Taxa Over 3.5</p>
                                        </div>
                                        <div className="text-center p-3 bg-green-50 rounded-lg">
                                            <p className="text-2xl font-bold text-green-600">
                                                {results.team_analysis.total_games}
                                            </p>
                                            <p className="text-sm">Total Jogos</p>
                                        </div>
                                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                                            <p className="text-2xl font-bold text-orange-600">
                                                {results.team_analysis.over35_games}
                                            </p>
                                            <p className="text-sm">Jogos Over 3.5</p>
                                        </div>
                                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                                            <p className="text-2xl font-bold text-purple-600">
                                                {results.team_analysis.similarity_analysis?.position_analysis?.avg_team_position || 'N/A'}
                                            </p>
                                            <p className="text-sm">Posição Média</p>
                                        </div>
                                    </div>

                                    {/* ✅ NOVAS ANÁLISES ADICIONADAS AQUI */}
                                    {renderOpponentAnalysis(results.team_analysis)}
                                    {renderTimeAnalysis(results.team_analysis)}
                                    {renderOddsAnalysis(results.team_analysis)}

                                    {results.team_analysis.insights && results.team_analysis.insights.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Insights Principais</h4>
                                            <ul className="space-y-2">
                                                {results.team_analysis.insights.map((insight, index) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm p-2 bg-gray-50 rounded">
                                                        <span className="text-green-500 mt-1">•</span>
                                                        {insight}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Insights Acionáveis */}
                    {results.actionable_insights && results.actionable_insights.length > 0 && (
                        <Card className="border-green-200 bg-green-50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-700">
                                    <Target />Insights Acionáveis
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {results.actionable_insights.map((insight, index) => (
                                        <li key={index} className="flex items-start gap-2 p-2 bg-white rounded">
                                            <span className="text-green-500 mt-1">🎯</span>
                                            <span className="text-sm">{insight}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Predição do Time do Dia */}
                    {results.prediction_data?.next_team_prediction && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap />Predição do Próximo Time do Dia
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-blue-600">
                                        {results.prediction_data.next_team_prediction.predicted_team}
                                    </p>
                                    <p className="text-lg text-gray-600 mt-2">
                                        Confiança: {results.prediction_data.next_team_prediction.confidence}%
                                    </p>
                                    <div className="mt-4 text-left">
                                        <h4 className="font-semibold mb-2">Raciocínio:</h4>
                                        <ul className="list-disc list-inside space-y-1">
                                            {results.prediction_data.next_team_prediction.reasoning?.map((reason, index) => (
                                                <li key={index} className="text-sm text-gray-700">{reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeepAnalysisTab;