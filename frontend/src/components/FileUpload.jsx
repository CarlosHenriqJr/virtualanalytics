import React from 'react';
import { Upload, FileCode } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from './ui/use-toast';

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
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-lg bg-gray-900/50 hover:border-gray-600 transition-colors">
      <FileCode className="w-16 h-16 text-gray-500 mb-4" />
      <h3 className="text-xl font-semibold text-white mb-2">
        Carregar arquivo mockMatches.js
      </h3>
      <p className="text-gray-400 mb-6 text-center max-w-md">
        Selecione o arquivo JavaScript contendo os dados das partidas para análise
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
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Upload className="w-5 h-5 mr-2" />
        Selecionar Arquivo
      </Button>
    </div>
  );
};

export default FileUpload;