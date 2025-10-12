import React from 'react';
import { Upload, FileCode } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';

const FileUpload = ({ onFileLoaded }) => {
  const fileInputRef = React.useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.js')) {
      toast({
        title: "Erro no arquivo",
        description: "Por favor, selecione um arquivo .js",
        variant: "destructive"
      });
      return;
    }

    try {
      const text = await file.text();
      
      // Remove export statement e extrai o array
      const cleanedText = text
        .replace(/export\s+const\s+\w+\s*=\s*/, '')
        .replace(/;\s*$/, '');
      
      // Avalia o JavaScript
      const matches = eval(`(${cleanedText})`);
      
      if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('Formato inválido');
      }

      onFileLoaded(matches);
      toast({
        title: "Arquivo carregado!",
        description: `${matches.length} partidas carregadas com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative">
      {/* Background decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl blur-xl"></div>
      
      <div className="relative flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/80 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
        <div className="bg-blue-600/20 p-6 rounded-full mb-6 border border-blue-500/30">
          <FileCode className="w-16 h-16 text-blue-400" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-3">
          Carregar Dados das Partidas
        </h3>
        
        <p className="text-gray-400 mb-2 text-center max-w-lg text-lg">
          Faça upload do arquivo <span className="text-blue-400 font-mono">mockMatches.js</span>
        </p>
        
        <p className="text-gray-500 mb-8 text-center max-w-lg text-sm">
          O arquivo deve conter os dados das partidas de futebol virtual com placares, horários e mercados
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".js"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Upload className="w-6 h-6 mr-3" />
          Selecionar Arquivo .js
        </Button>
        
        <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Formato: JavaScript (.js)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Estrutura: Array de objetos</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;