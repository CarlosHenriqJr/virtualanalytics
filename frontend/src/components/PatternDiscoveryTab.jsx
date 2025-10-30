/**
 * PatternDiscoveryTab.jsx
 * * Tela para "Criar Novo Robô" e que inclui o "Buscador de Padrões"
 * para descoberta automática de pulos.
 */
import React, { useState } from 'react'; // <--- Erro de digitação 'fs' removido daqui
import axios from 'axios';
import Select from 'react-select'; // Esta linha requer o 'npm install react-select'

const API_BASE_URL = 'http://localhost:8000';

// Opções de exemplo (você deve carregar isso da sua API/Contexto)
const leagueOptions = [
  { value: 'Copa', label: 'Copa' },
  { value: 'Euro', label: 'Euro' },
  { value: 'Super', label: 'Super' },
  { value: 'Premier', label: 'Premier' },
];

// Carregue os mercados da sua API. Este é apenas um exemplo estático.
const marketOptions = [
  { value: 'TotalGols_MaisDe_25', label: 'Total Gols Mais de 2.5' },
  { value: 'TotalGols_MenosDe_25', label: 'Total Gols Menos de 2.5' },
  { value: 'ParaOTimeMarcarSimNao_AmbasMarcam', label: 'Ambas Marcam' },
  { value: 'VencedorFT_Casa', label: 'Casa Vence (FT)' },
  { value: 'VencedorFT_Visitante', label: 'Visitante Vence (FT)' },
  { value: 'VencedorFT_Empate', label: 'Empate (FT)' },
  { value: 'ResultadoCorreto_Empate_0x0', label: 'Placar Exato 0-0' },
  { value: 'ResultadoCorreto_Casa_1x0', label: 'Placar Exato 1-0' },
  // ... adicione outros mercados conforme seu JSON
];

const teamOptions = [
  { value: 'Everton', label: 'Everton' },
  { value: 'Palace', label: 'Palace' },
  // ... adicione todos os times
];

const chatOptions = [
  { value: '606234858', label: '[@bl4ckb0t_bot] 606234858' }
];

// Estilos customizados para o react-select (para parecer "dark mode")
const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: '#343a40', // bg-dark (cinza escuro)
    borderColor: '#6c757d',
  }),
  singleValue: (base) => ({ ...base, color: '#f8f9fa' }), // text-light (branco)
  placeholder: (base) => ({ ...base, color: '#adb5bd' }), // cinza claro
  input: (base) => ({ ...base, color: '#f8f9fa' }),
  menu: (base) => ({ ...base, backgroundColor: '#343a40' }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#007bff' : isFocused ? '#495057' : '#343a40',
    color: '#f8f9fa',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#495057',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#f8f9fa',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#adb5bd',
    ':hover': {
      backgroundColor: '#dc3545',
      color: 'white',
    },
  }),
};


// --- Sub-componente Modal ---
const PatternFinderModal = ({ isOpen, onClose, onPatternFound, triggerConditions, selectedLeagues }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  
  // Estado do formulário do modal
  const [targetMarket, setTargetMarket] = useState(null);
  const [entriesCount, setEntriesCount] = useState(1);
  const [maxSkip, setMaxSkip] = useState(20);
  const [orderBy, setOrderBy] = useState('p'); // 'p' = Melhor %

  const handleSearch = async () => {
    let triggerJSON;
    try {
      triggerJSON = JSON.parse(triggerConditions);
    } catch(e) {
      setError(`Gatilho JSON no formulário principal é inválido: ${e.message}`);
      return;
    }

    if (!targetMarket) {
      setError("Por favor, selecione um Mercado Alvo (Entrada).");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    const requestBody = {
      trigger_conditions: triggerJSON,
      target_market: targetMarket.value,
      max_skip: parseInt(maxSkip, 10),
      entries_count: parseInt(entriesCount, 10),
      leagues: selectedLeagues.map(l => l.value)
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/pattern-discovery/find-best-skip`, requestBody);
      
      // Ordena os resultados
      const sortedData = [...response.data].sort((a, b) => {
        if (orderBy === 'p') {
          return b.success_rate - a.success_rate; // Melhor %
        } else {
          return b.total_wins - a.total_wins; // Mais Entradas (wins)
        }
      });
      setResults(sortedData);

    } catch (err) {
      console.error("Erro ao buscar padrões:", err);
      setError(err.response?.data?.detail || err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    // Modal (Tailwind CSS)
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h4 className="text-xl font-bold">Buscador de Padrões 🤖</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        
        {/* Corpo do Modal */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Formulário de Busca */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 border border-dashed border-gray-600 rounded-lg">
            <div>
              <label className="text-sm font-medium">Entrada (Mercado Alvo)</label>
              <Select
                options={marketOptions}
                styles={selectStyles}
                onChange={setTargetMarket}
                value={targetMarket}
                placeholder="Escolher Entrada"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tiros</label>
              <select value={entriesCount} onChange={e => setEntriesCount(e.target.value)} className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white">
                {[1, 2, 3, 4, 5].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Máximo Pulos</label>
              <select value={maxSkip} onChange={e => setMaxSkip(e.target.value)} className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white">
                <option value="20">20</option>
                <option value="40">40</option>
                <option value="80">80</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Base (Gatilho)</label>
              <input type="text" value="Gatilho do Formulário" disabled className="w-full p-2 bg-gray-600 border-gray-500 rounded cursor-not-allowed text-gray-300" />
            </div>
            <div>
              <label className="text-sm font-medium">Ordenação</label>
              <select value={orderBy} onChange={e => setOrderBy(e.target.value)} className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white">
                <option value="p">Melhor %</option>
                <option value="e">Mais Acertos</option>
              </select>
            </div>
          </div>
          
          <button onClick={handleSearch} disabled={loading} className="w-full py-3 bg-green-600 hover:bg-green-700 rounded font-bold transition-colors disabled:bg-gray-500">
            {loading ? 'Buscando...' : 'Buscar Padrão de Pulo'}
          </button>
          
          {error && <div className="text-red-400 p-3 bg-red-900 border border-red-700 rounded">{error}</div>}

          {/* Tabela de Resultados */}
          <div className="overflow-auto max-h-[50vh]">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Pulo (Skip)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Gatilhos</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Acertos</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">% Sucesso</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {results.map((r, idx) => (
                  <tr key={idx} className={`hover:bg-gray-700 ${r.success_rate > 0.7 ? 'bg-green-900 bg-opacity-50' : ''}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-lg font-bold">{r.skip}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.total_triggers}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium text-green-400">{r.total_wins}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-lg font-bold text-cyan-400">
                      {(r.success_rate * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button 
                        onClick={() => onPatternFound(r.skip)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
                      >
                        Usar Pulo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal da Aba ---
export default function PatternDiscoveryTab({ dbConnected }) {
  const [isPublic, setIsPublic] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [robotName, setRobotName] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);

  // Estado do Gatilho (o <app-robos-novo> do HTML)
  const [triggerType, setTriggerType] = useState('pi'); // 'pi' = Padrão Isolado
  
  // O GATILHO JSON (ex: {"placarHT": "0-0"})
  const [triggerConditions, setTriggerConditions] = useState('{\n  "placarHT": "0-0"\n}');
  const [jsonError, setJsonError] = useState(null);

  // Estado do modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bestSkip, setBestSkip] = useState(null); // Armazena o pulo encontrado

  const handleJsonChange = (e) => {
    const newJson = e.target.value;
    setTriggerConditions(newJson);
    try {
      JSON.parse(newJson);
      setJsonError(null);
    } catch (err) {
      setJsonError('JSON inválido');
    }
  };

  const handlePatternFound = (skip) => {
    alert(`Pulo ${skip} selecionado! (Esta ação pode ser customizada)`);
    setBestSkip(skip); // Você pode usar isso para preencher outro campo
    setIsModalOpen(false);
  };
  
  return (
    // O HTML original usava bg-dark, m-2. O Tailwind usa bg-gray-800, p-4.
    <div className="bg-gray-800 text-white p-4 rounded-lg space-y-6">
      
      {/* 1. Cabeçalho */}
      <h5 className="text-center text-xl font-bold">Criar Novo Robô</h5>
      
      <div className="flex justify-center items-center space-x-4">
        {/* Switch 'Público' (usando HTML/CSS do Bootstrap para 'custom-switch') */}
        <div className="custom-control custom-switch">
          <input 
            type="checkbox" 
            className="custom-control-input" 
            id="switchPublic" 
            checked={isPublic} 
            onChange={e => setIsPublic(e.target.checked)} 
          />
          <label className="custom-control-label" htmlFor="switchPublic">Público</label>
        </div>
      </div>

      {/* 2. Seleção de Ligas */}
      <div className="text-center p-4 border border-gray-700 rounded">
        <h5 className="mb-2">Selecione a Liga que deseja atuar</h5>
        {/* O HTML original usava checkboxes. React-Select é uma tradução moderna do <ng-select> */}
        <Select
          isMulti
          options={leagueOptions}
          styles={selectStyles}
          onChange={setLeagues}
          value={leagues}
          placeholder="Selecionar ligas..."
        />
      </div>

      {/* 3. Nome e Chat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label>Nome</label>
          <input 
            type="text" 
            placeholder="Nome do Bot" 
            value={robotName}
            onChange={e => setRobotName(e.target.value)}
            className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white" 
          />
        </div>
        <div>
          <label>Chat</label>
          <Select
            options={chatOptions}
            styles={selectStyles}
            onChange={setSelectedChat}
            value={selectedChat}
            placeholder="Selecionar chat..."
          />
        </div>
      </div>

      {/* 4. Definição do Gatilho */}
      <div className="p-4 rounded-lg" style={{ background: '#1f252a' }}>
        <h6 className="font-bold mb-4">Definição do Gatilho</h6>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label>Tipo Marcação</label>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)} className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white">
              <option value="pi">Padrão Isolado (Gatilho)</option>
              <option value="e">Entrada (Mercado Alvo)</option>
            </select>
          </div>
          <div>
            <label>Mercado Alvo (Entrada)</label>
            <Select
              options={marketOptions}
              styles={selectStyles}
              placeholder="Selecione um Mercado "
            />
          </div>
        </div>

{/* O GATILHO JSON - A parte mais importante */}
<div className="mt-4">
  <label className="block text-sm font-medium text-gray-300">
    Gatilho (Query MongoDB em JSON)
  </label>
  <textarea
    rows="5"
    value={triggerConditions}
    onChange={handleJsonChange}
    className={`mt-1 block w-full px-3 py-2 font-mono text-sm border ${
      jsonError ? 'border-red-500' : 'border-gray-700'
    } bg-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-white`}
    placeholder='Ex: { "placarHT": "0-0" }'
  ></textarea>
  {jsonError && <p className="mt-2 text-sm text-red-400">{jsonError}</p>}
  <p className="mt-2 text-xs text-gray-400">
    Ex: {"{ \"placarHT\": \"0-0\" }"} ou {"{ \"placarCasaFT\": 4, \"placarForaFT\": 0 }"}
  </p>
</div>

        {/* Botões */}
        <div className="mt-6 space-x-2">
          {/* Usei classes do Tailwind que se parecem com 'btn btn-danger' etc */}
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium">Remover</button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">Limpar</button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold"
            disabled={!dbConnected} // Desabilita se o DB não estiver conectado
          >
            Buscador de Padrões 🤖
          </button>
          {!dbConnected && <p className="text-yellow-400 text-xs mt-2">Buscador desabilitado. Conecte ao banco de dados.</p>}
        </div>
      </div>
      
      {/* 5. Tabela de Padrões (Visual) */}
      <div className="p-4 rounded-lg" style={{ background: '#1f252a' }}>
        <h6 className="font-bold mb-2">Visualizador de Padrões (Layout)</h6>
        <div className="overflow-x-auto text-center text-xs text-gray-400">
          <p>(Aqui entraria o componente visual de tabela/grid que você mostrou no HTML, que é uma funcionalidade de UI complexa e separada)</p>
          <p className="p-8 border border-dashed border-gray-600 rounded">Tabela de Padrões (Grid 20x8) ...</p>
        </div>
      </div>

      {/* 6. Parametrização (Simplificado com <details>) */}
      <div className="space-y-2">
        <details className="bg-gray-700 rounded p-2 cursor-pointer">
          <summary className="font-bold">Parametrização (Clique para expandir)</summary>
          <div className="p-4 space-y-4">
            <label className="block">Texto Adicional <input type="text" className="w-full p-2 bg-gray-800 rounded mt-1 text-white" /></label>
            <label className="block">Link (ACESSE AQUI) <input type="text" className="w-full p-2 bg-gray-800 rounded mt-1 text-white" /></label>
            <label className="block">Limite Entradas Simultâneas <input type="number" className="w-full p-2 bg-gray-800 rounded mt-1 text-white" /></label>
            <div className="p-2 bg-gray-600 rounded cursor-pointer">Regras Abortar / Não Enviar...</div>
            <div className="p-2 bg-gray-600 rounded cursor-pointer">Regras Stop Loss...</div>
            <div className="p-2 bg-gray-600 rounded cursor-pointer">Regras Stop Win...</div>
          </div>
        </details>
      </div>

      {/* 7. Finalizar */}
      <div>
        <button className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold">Finalizar</button>
      </div>

      {/* O Modal do Buscador (Renderizado fora do fluxo principal) */}
      <PatternFinderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPatternFound={handlePatternFound}
        triggerConditions={triggerConditions}
        selectedLeagues={leagues}
      />
    </div>
  );
}