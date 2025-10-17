import React, { useState, useEffect, useMemo } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Brain, Zap, Activity, TrendingUp, AlertCircle, Save, Download, Upload, Trash2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { toast } from '../hooks/use-toast';
import { format, parseISO } from 'date-fns';

const NeuralNetworkPredictor = ({ allMatches, currentDate }) => {
  const [model, setModel] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLoss, setTrainingLoss] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Tenta carregar modelo salvo ao montar componente
  useEffect(() => {
    checkSavedModel();
  }, []);

  // Verifica se há modelo salvo
  const checkSavedModel = async () => {
    try {
      const savedInfo = localStorage.getItem('nn-model-info');
      if (savedInfo) {
        setModelInfo(JSON.parse(savedInfo));
      }
    } catch (error) {
      console.error('Erro ao verificar modelo salvo:', error);
    }
  };

  // Salva modelo no IndexedDB
  const saveModel = async () => {
    if (!model || !modelReady) return;

    setIsSaving(true);
    try {
      await model.save('indexeddb://over35-predictor-model');
      
      const info = {
        savedAt: new Date().toISOString(),
        trainingDataSize: trainingData?.sequences.length || 0,
        lastLoss: trainingLoss,
        version: '1.0'
      };
      
      localStorage.setItem('nn-model-info', JSON.stringify(info));
      setModelInfo(info);

      toast({
        title: "✅ Modelo Salvo!",
        description: "Modelo treinado salvo no navegador com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o modelo.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Carrega modelo do IndexedDB
  const loadModel = async () => {
    setIsLoading(true);
    try {
      const loadedModel = await tf.loadLayersModel('indexeddb://over35-predictor-model');
      setModel(loadedModel);
      setModelReady(true);

      toast({
        title: "✅ Modelo Carregado!",
        description: "Modelo treinado carregado do navegador.",
      });

      // Faz previsões automaticamente
      makePredictions(loadedModel);
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar o modelo salvo. Treine um novo modelo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Exporta modelo como arquivo para download
  const exportModel = async () => {
    if (!model || !modelReady) return;

    setIsSaving(true);
    try {
      // Cria um diretório temporário no IndexedDB
      await model.save('downloads://over35-predictor-model');

      toast({
        title: "✅ Modelo Exportado!",
        description: "Modelo baixado para sua máquina.",
      });
    } catch (error) {
      console.error('Erro ao exportar modelo:', error);
      
      // Fallback: salva metadados como JSON
      const modelJSON = {
        info: modelInfo,
        trainingDataSize: trainingData?.sequences.length || 0,
        architecture: 'LSTM',
        note: 'Use "Salvar no Navegador" para salvar o modelo completo'
      };

      const blob = new Blob([JSON.stringify(modelJSON, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `over35-model-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Metadados Exportados",
        description: "Use 'Salvar no Navegador' para modelo completo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Deleta modelo salvo
  const deleteModel = async () => {
    try {
      await tf.io.removeModel('indexeddb://over35-predictor-model');
      localStorage.removeItem('nn-model-info');
      setModelInfo(null);
      setModel(null);
      setModelReady(false);
      setPredictions(null);

      toast({
        title: "Modelo Deletado",
        description: "Modelo removido do navegador.",
      });
    } catch (error) {
      console.error('Erro ao deletar modelo:', error);
    }
  };
    if (!allMatches || allMatches.length < 10) return null;

    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const historicalMatches = allMatches
      .filter(m => m.date <= currentDateStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (historicalMatches.length < 10) return null;

    const sequences = [];
    const labels = [];

    // Cria sequências de 5 jogos para prever o 6º
    for (let i = 5; i < historicalMatches.length; i++) {
      const sequence = historicalMatches.slice(i - 5, i);
      const target = historicalMatches[i];

      // Features da sequência (normalizado 0-1)
      const features = sequence.map(match => [
        match.totalGolsFT > 3.5 ? 1 : 0, // Over 3.5
        match.totalGolsFT / 10, // Gols normalizados
        (match.markets?.TotalGols_MaisDe_35 || 4) / 10, // Odd normalizada
        match.hour / 24, // Horário normalizado
        match.minute / 60, // Minuto normalizado
        match.placarCasaHT / 5, // HT Casa normalizado
        match.placarForaHT / 5, // HT Fora normalizado
      ]);

      sequences.push(features);
      labels.push(target.totalGolsFT > 3.5 ? 1 : 0);
    }

    return { sequences, labels };
  }, [allMatches, currentDate]);

  // Cria modelo LSTM
  const createModel = () => {
    const model = tf.sequential();

    // Camada LSTM para aprender sequências
    model.add(tf.layers.lstm({
      units: 32,
      inputShape: [5, 7], // 5 jogos, 7 features cada
      returnSequences: false
    }));

    // Dropout para evitar overfitting
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Camadas densas
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    
    // Saída: probabilidade de Over 3.5
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  };

  // Treina modelo
  const trainModel = async () => {
    if (!trainingData || isTraining) return;

    setIsTraining(true);
    setTrainingProgress(0);

    try {
      const newModel = createModel();

      // Converte dados para tensores
      const xs = tf.tensor3d(trainingData.sequences);
      const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);

      // Treina
      await newModel.fit(xs, ys, {
        epochs: 50,
        batchSize: 8,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            setTrainingProgress(((epoch + 1) / 50) * 100);
            setTrainingLoss(logs.loss.toFixed(4));
          }
        }
      });

      // Limpa tensores
      xs.dispose();
      ys.dispose();

      setModel(newModel);
      setModelReady(true);
      setIsTraining(false);

      // Faz previsões automaticamente
      makePredictions(newModel);

    } catch (error) {
      console.error('Erro ao treinar modelo:', error);
      setIsTraining(false);
    }
  };

  // Faz previsões para o próximo dia
  const makePredictions = async (trainedModel) => {
    if (!trainedModel || !allMatches) return;

    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const recentMatches = allMatches
      .filter(m => m.date <= currentDateStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-5);

    if (recentMatches.length < 5) return;

    // Prepara sequência
    const sequence = recentMatches.map(match => [
      match.totalGolsFT > 3.5 ? 1 : 0,
      match.totalGolsFT / 10,
      (match.markets?.TotalGols_MaisDe_35 || 4) / 10,
      match.hour / 24,
      match.minute / 60,
      match.placarCasaHT / 5,
      match.placarForaHT / 5,
    ]);

    const inputTensor = tf.tensor3d([sequence]);
    const prediction = trainedModel.predict(inputTensor);
    const probability = (await prediction.data())[0] * 100;

    inputTensor.dispose();
    prediction.dispose();

    // Análise de times inviesados com NN
    const teamPredictions = await predictBiasedTeams(trainedModel);

    // Análise de blocos com NN
    const blockPredictions = await predictBlocks(trainedModel, recentMatches);

    setPredictions({
      over35Probability: probability,
      confidence: probability > 70 ? 'alta' : probability > 40 ? 'média' : 'baixa',
      recentSequence: recentMatches.map(m => ({
        placar: m.placarFT,
        over35: m.totalGolsFT > 3.5,
        gols: m.totalGolsFT
      })),
      biasedTeams: teamPredictions,
      blockPattern: blockPredictions
    });
  };

  // Prediz times inviesados usando NN
  const predictBiasedTeams = async (trainedModel) => {
    // Agrupa times e suas estatísticas
    const teamStats = {};
    
    allMatches.forEach(match => {
      [match.timeCasa, match.timeFora].forEach(team => {
        if (!teamStats[team]) {
          teamStats[team] = {
            team,
            matches: [],
            over35Count: 0
          };
        }
        teamStats[team].matches.push(match);
        if (match.totalGolsFT > 3.5) teamStats[team].over35Count++;
      });
    });

    // Para cada time, prevê probabilidade de Over 3.5
    const predictions = [];
    for (const [team, stats] of Object.entries(teamStats)) {
      if (stats.matches.length >= 5) {
        const recentMatches = stats.matches.slice(-5);
        
        const sequence = recentMatches.map(match => [
          match.totalGolsFT > 3.5 ? 1 : 0,
          match.totalGolsFT / 10,
          (match.markets?.TotalGols_MaisDe_35 || 4) / 10,
          match.hour / 24,
          match.minute / 60,
          match.placarCasaHT / 5,
          match.placarForaHT / 5,
        ]);

        const inputTensor = tf.tensor3d([sequence]);
        const prediction = trainedModel.predict(inputTensor);
        const probability = (await prediction.data())[0] * 100;

        inputTensor.dispose();
        prediction.dispose();

        predictions.push({
          team,
          probability,
          recentOver35Rate: (stats.over35Count / stats.matches.length) * 100
        });
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability).slice(0, 3);
  };

  // Prediz padrão de blocos
  const predictBlocks = async (trainedModel, recentMatches) => {
    // Analisa últimos 5 jogos
    const pattern = recentMatches.map(m => m.totalGolsFT > 3.5 ? 'O' : 'U').join('-');
    
    // Detecta padrões conhecidos
    const isAlternating = /^(O-U|U-O)/.test(pattern);
    const isBlockOfOvers = pattern.split('-').filter(x => x === 'O').length >= 3;
    
    let nextExpected = null;
    let confidence = 'baixa';

    if (isAlternating) {
      const last = pattern.split('-').pop();
      nextExpected = last === 'O' ? 'Under' : 'Over';
      confidence = 'alta';
    } else if (isBlockOfOvers) {
      nextExpected = 'Over (bloco continua)';
      confidence = 'média';
    }

    return {
      currentPattern: pattern,
      nextExpected,
      confidence,
      isAlternating,
      isBlockOfOvers
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-10 h-10 animate-pulse" />
            <div>
              <h2 className="text-3xl font-bold">Previsão com Rede Neural</h2>
              <p className="text-purple-100 mt-1">
                LSTM treinada com {trainingData?.sequences.length || 0} sequências
              </p>
            </div>
          </div>
          <div>
            {!modelReady ? (
              <Button
                onClick={trainModel}
                disabled={isTraining || !trainingData}
                size="lg"
                className="bg-white text-purple-600 hover:bg-purple-50"
              >
                {isTraining ? (
                  <>
                    <Zap className="w-5 h-5 mr-2 animate-pulse" />
                    Treinando...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Treinar Modelo
                  </>
                )}
              </Button>
            ) : (
              <div className="text-right">
                <div className="text-sm opacity-90">Modelo Treinado</div>
                <div className="text-2xl font-bold text-green-300">✓ PRONTO</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controles de Salvar/Carregar */}
      <Card className="bg-gray-900/50 border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Save className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Gerenciar Modelo Treinado</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Informações do modelo salvo */}
          {modelInfo && (
            <Card className="bg-blue-900/20 border-blue-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-white">Modelo Salvo Disponível</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Salvo em:</span>
                  <span className="text-white">
                    {new Date(modelInfo.savedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dados de treino:</span>
                  <span className="text-white">{modelInfo.trainingDataSize} sequências</span>
                </div>
                {modelInfo.lastLoss && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loss final:</span>
                    <span className="text-white">{modelInfo.lastLoss}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Ações */}
          <div className="space-y-3">
            {!modelReady && modelInfo && (
              <Button
                onClick={loadModel}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Carregar Modelo Salvo
                  </>
                )}
              </Button>
            )}

            {modelReady && (
              <>
                <Button
                  onClick={saveModel}
                  disabled={isSaving}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar no Navegador
                    </>
                  )}
                </Button>

                <Button
                  onClick={exportModel}
                  disabled={isSaving}
                  variant="outline"
                  className="w-full bg-gray-800 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Modelo
                </Button>
              </>
            )}

            {modelInfo && (
              <Button
                onClick={deleteModel}
                variant="destructive"
                className="w-full bg-red-900 hover:bg-red-800"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Modelo Salvo
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
          <p className="text-sm text-yellow-200">
            <strong>💡 Dica:</strong> Após treinar com muitos dados, salve o modelo no navegador. 
            Na próxima vez que usar o site, basta carregar o modelo salvo sem precisar retreinar!
          </p>
        </div>
      </Card>

      {/* Progresso de Treinamento */}
      {isTraining && (
        <Card className="bg-gray-900/50 border-purple-500/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-purple-400 animate-pulse" />
            <h3 className="text-xl font-bold text-white">Treinando Rede Neural...</h3>
          </div>
          <Progress value={trainingProgress} className="mb-3" />
          <div className="flex justify-between text-sm text-gray-400">
            <span>{trainingProgress.toFixed(0)}% concluído</span>
            {trainingLoss && <span>Loss: {trainingLoss}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            A rede está aprendendo padrões históricos de Over 3.5...
          </p>
        </Card>
      )}

      {/* Previsões da NN */}
      {predictions && modelReady && (
        <>
          {/* Probabilidade de Over 3.5 */}
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/50 border-2 p-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Brain className="w-10 h-10 text-purple-400" />
                <h2 className="text-3xl font-bold text-white">Probabilidade NN: Over 3.5</h2>
              </div>
              
              <div className="mb-6">
                <div className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                  {predictions.over35Probability.toFixed(1)}%
                </div>
                <div className={`text-xl font-semibold ${
                  predictions.confidence === 'alta' ? 'text-green-300' :
                  predictions.confidence === 'média' ? 'text-yellow-300' :
                  'text-red-300'
                }`}>
                  Confiança da IA: {predictions.confidence.toUpperCase()}
                </div>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-purple-200">
                  <strong>Baseado na sequência dos últimos 5 jogos:</strong>
                </p>
                <div className="flex justify-center gap-2 mt-3">
                  {predictions.recentSequence.map((match, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 rounded-lg font-bold ${
                        match.over35 
                          ? 'bg-green-600 text-white' 
                          : 'bg-red-600/50 text-red-200'
                      }`}
                    >
                      <div className="text-xs">#{idx + 1}</div>
                      <div>{match.placar}</div>
                      <div className="text-xs">{match.gols} gols</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Times Inviesados por NN */}
          <Card className="bg-gray-900/50 border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              <h3 className="text-2xl font-bold text-white">Top 3 Times (Previsão NN)</h3>
            </div>
            <div className="space-y-3">
              {predictions.biasedTeams.map((team, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-purple-400">{idx + 1}º</span>
                      <span className="text-lg font-bold text-white">{team.team}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-400">
                        {team.probability.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-400">prob. NN</div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-400">
                    Taxa histórica: {team.recentOver35Rate.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Padrão de Blocos */}
          <Card className="bg-gray-900/50 border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-pink-400" />
              <h3 className="text-2xl font-bold text-white">Análise de Padrão de Blocos</h3>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-5">
              <div className="mb-4">
                <span className="text-sm text-gray-400 block mb-2">Padrão Atual:</span>
                <span className="text-2xl font-mono font-bold text-white">
                  {predictions.blockPattern.currentPattern}
                </span>
                <span className="text-sm text-gray-500 ml-3">(O=Over, U=Under)</span>
              </div>

              {predictions.blockPattern.nextExpected && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Próximo Esperado:</p>
                      <p className="text-xl font-bold text-purple-300">
                        {predictions.blockPattern.nextExpected}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                      predictions.blockPattern.confidence === 'alta' ? 'bg-green-600' :
                      predictions.blockPattern.confidence === 'média' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    } text-white`}>
                      {predictions.blockPattern.confidence}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-300">
                    {predictions.blockPattern.isAlternating && (
                      <p>• Padrão alternado detectado</p>
                    )}
                    {predictions.blockPattern.isBlockOfOvers && (
                      <p>• Bloco de Overs em andamento</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Mensagem se dados insuficientes */}
      {!trainingData && (
        <Card className="bg-gray-900/50 border-gray-800 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Dados Insuficientes</h3>
          <p className="text-gray-400">
            São necessários pelo menos 10 jogos históricos para treinar a Rede Neural.
            <br />
            Carregue mais dados para ativar a IA.
          </p>
        </Card>
      )}
    </div>
  );
};

export default NeuralNetworkPredictor;
