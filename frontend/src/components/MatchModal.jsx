import React from 'react';
import { X, Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const MatchModal = ({ match, open, onClose }) => {
  if (!match) return null;

  const { timeCasa, timeFora, placarHT, placarFT, totalGolsFT, markets, date, hour, minute } = match;

  // Verifica se mercados bateram
  const checkMarket = (marketKey, condition) => {
    return condition;
  };

  const over25Hit = totalGolsFT > 2.5;
  const over35Hit = totalGolsFT > 3.5;
  const over45Hit = totalGolsFT > 4.5;
  const ambosMarcam = match.placarCasaFT > 0 && match.placarForaFT > 0;

  const marketGroups = [
    {
      title: 'Totais de Gols',
      items: [
        { name: 'Over 2.5', odd: markets?.TotalGols_MaisDe_25 || '-', hit: over25Hit },
        { name: 'Over 3.5', odd: markets?.TotalGols_MaisDe_35 || '-', hit: over35Hit },
        { name: 'Over 4.5', odd: markets?.TotalGols_MaisDe_45 || '-', hit: over45Hit },
      ]
    },
    {
      title: 'Ambos Marcam',
      items: [
        { name: 'Ambos Marcam - Sim', odd: markets?.ParaOTimeMarcarSimNao_AmbasMarcam || '-', hit: ambosMarcam },
      ]
    },
    {
      title: 'Resultado Final',
      items: [
        { name: 'Vitória Casa', odd: markets?.VencedorFT_Casa || '-', hit: match.placarCasaFT > match.placarForaFT },
        { name: 'Empate', odd: markets?.VencedorFT_Empate || '-', hit: match.placarCasaFT === match.placarForaFT },
        { name: 'Vitória Fora', odd: markets?.VencedorFT_Visitante || '-', hit: match.placarForaFT > match.placarCasaFT },
      ]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gray-950 border-gray-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Detalhes da Partida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cabeçalho da partida */}
          <div className="bg-gray-900 p-6 rounded-lg">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-400 mb-2">
                {date} - {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}
              </div>
              <div className="text-3xl font-bold mb-2">
                {timeCasa} <span className="text-gray-500">vs</span> {timeFora}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm mb-1">Placar HT</div>
                <div className="text-2xl font-bold text-yellow-400">{placarHT}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm mb-1">Placar FT</div>
                <div className="text-2xl font-bold text-green-400">{placarFT}</div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <div className="text-gray-400 text-sm">Total de Gols</div>
              <div className="text-3xl font-bold text-blue-400">{totalGolsFT}</div>
            </div>
          </div>

          {/* Mercados */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Mercados e Odds</h3>
            {marketGroups.map((group, idx) => (
              <div key={idx} className="bg-gray-900 p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-3 text-gray-300">{group.title}</h4>
                <div className="space-y-2">
                  {group.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className={`flex justify-between items-center p-3 rounded ${
                        item.hit
                          ? 'bg-green-900/40 border border-green-600'
                          : 'bg-gray-800 border border-gray-700'
                      }`}
                    >
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 font-bold">
                          {typeof item.odd === 'number' ? item.odd.toFixed(2) : item.odd}
                        </span>
                        {item.hit && (
                          <span className="text-green-400 text-sm font-semibold">✓ Bateu</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchModal;