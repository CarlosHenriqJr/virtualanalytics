import React from 'react';
import { Upload, FileCode, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';
import pako from 'pako';

const FileUpload = ({ onFileLoaded }) => {
  const fileInputRef = React.useRef(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isGzipped = file.name.endsWith('.gz');
    const isJson = file.name.endsWith('.json') || file.name.endsWith('.json.gz');
    const isJs = file.name.endsWith('.js');

    if (!isJson && !isJs) {
      toast({
        title: "Erro no arquivo",
        description: "Por favor, selecione um arquivo .js, .json ou .json.gz",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let matches;

      if (isGzipped) {
        // Arquivo compactado com gzip
        toast({
          title: "Descompactando arquivo...",
          description: "Aguarde enquanto processamos o arquivo compactado.",
        });

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Descompactar com pako
        const decompressed = pako.ungzip(uint8Array, { to: 'string' });
        
        // Parse JSON
        matches = JSON.parse(decompressed);
      } else if (isJson) {
        // JSON não compactado
        const text = await file.text();
        matches = JSON.parse(text);
      } else {
        // JavaScript (.js)
        const text = await file.text();
        
        // Remove export statement e extrai o array
        const cleanedText = text
          .replace(/export\s+const\s+\w+\s*=\s*/, '')
          .replace(/;\s*$/, '');
        
        // Avalia o JavaScript
        matches = eval(`(${cleanedText})`);
      }
      
      if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('Formato inválido');
      }

      onFileLoaded(matches);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast({
        title: "✅ Arquivo carregado!",
        description: `${matches.length} partidas carregadas (${fileSizeMB} MB)`,
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: error.message || "Verifique se o arquivo está no formato correto.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      // Limpa o input para permitir recarregar o mesmo arquivo
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
      {/* Background decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl blur-xl"></div>
      
      <div className="relative flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/80 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
        <div className="bg-blue-600/20 p-6 rounded-full mb-6 border border-blue-500/30">
          {isProcessing ? (
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
          ) : (
            <FileCode className="w-16 h-16 text-blue-400" />
          )}
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-3">
          {isProcessing ? 'Processando arquivo...' : 'Carregar Dados das Partidas'}
        </h3>
        
        <p className="text-gray-400 mb-2 text-center max-w-lg text-lg">
          Faça upload do arquivo de dados das partidas
        </p>
        
        <p className="text-gray-500 mb-8 text-center max-w-lg text-sm">
          Suporta arquivos <span className="text-blue-400 font-mono">.json.gz</span> (compactado),{' '}
          <span className="text-blue-400 font-mono">.json</span> ou{' '}
          <span className="text-blue-400 font-mono">.js</span>
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.json,.gz"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessing}
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          size="lg"
          disabled={isProcessing}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-6 h-6 mr-3 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 mr-3" />
              Selecionar Arquivo
            </>
          )}
        </Button>
        
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>JSON Compactado (.json.gz)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>JSON (.json)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>JavaScript (.js)</span>
          </div>
        </div>
        
        {isProcessing && (
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm animate-pulse">
              Descompactando e carregando dados...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
};

export default FileUpload;