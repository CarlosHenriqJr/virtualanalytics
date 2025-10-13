import React from 'react';
import { Upload, FileCode, Loader2, Files } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';
import pako from 'pako';
import { Progress } from './ui/progress';

const FileUpload = ({ onFileLoaded }) => {
  const fileInputRef = React.useRef(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentFile, setCurrentFile] = React.useState('');

  const processFile = async (file) => {
    const isGzipped = file.name.endsWith('.gz');
    const isJson = file.name.endsWith('.json') || file.name.endsWith('.json.gz');
    const isJs = file.name.endsWith('.js');

    let matches;

    if (isGzipped) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      matches = JSON.parse(decompressed);
    } else if (isJson) {
      const text = await file.text();
      matches = JSON.parse(text);
    } else if (isJs) {
      const text = await file.text();
      const cleanedText = text
        .replace(/export\s+const\s+\w+\s*=\s*/, '')
        .replace(/;\s*$/, '');
      matches = eval(`(${cleanedText})`);
    }

    return matches;
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Verifica se todos os arquivos são válidos
    const validExtensions = ['.js', '.json', '.gz'];
    const invalidFiles = files.filter(file => 
      !validExtensions.some(ext => file.name.endsWith(ext))
    );

    if (invalidFiles.length > 0) {
      toast({
        title: "Erro nos arquivos",
        description: "Por favor, selecione apenas arquivos .js, .json ou .json.gz",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      let allMatches = [];
      let totalSize = 0;

      // Ordena arquivos por nome (importante para parts: part1, part2, etc)
      const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));

      toast({
        title: `Processando ${files.length} arquivo(s)...`,
        description: "Aguarde enquanto carregamos os dados.",
      });

      // Processa cada arquivo sequencialmente
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        setCurrentFile(file.name);
        setProgress(Math.round((i / sortedFiles.length) * 100));

        console.log(`Processando ${i + 1}/${sortedFiles.length}: ${file.name}`);

        const matches = await processFile(file);

        if (!Array.isArray(matches)) {
          throw new Error(`Arquivo ${file.name} não contém um array válido`);
        }

        // Adiciona ao array principal
        allMatches = allMatches.concat(matches);
        totalSize += file.size;

        // Libera memória (força garbage collection)
        if (i < sortedFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setProgress(100);

      if (allMatches.length === 0) {
        throw new Error('Nenhuma partida encontrada nos arquivos');
      }

      // Remove duplicatas baseado no id (se houver)
      const uniqueMatches = Array.from(
        new Map(allMatches.map(m => [m.id, m])).values()
      );

      if (uniqueMatches.length !== allMatches.length) {
        console.log(`Removidas ${allMatches.length - uniqueMatches.length} partidas duplicadas`);
      }

      onFileLoaded(uniqueMatches);

      const fileSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      toast({
        title: "✅ Arquivos carregados com sucesso!",
        description: `${uniqueMatches.length} partidas únicas de ${files.length} arquivo(s) (${fileSizeMB} MB)`,
      });
    } catch (error) {
      console.error('Erro ao processar arquivos:', error);
      toast({
        title: "Erro ao processar arquivos",
        description: error.message || "Verifique se os arquivos estão no formato correto.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile('');
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
            <Files className="w-16 h-16 text-blue-400" />
          )}
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-3">
          {isProcessing ? 'Processando arquivos...' : 'Carregar Dados das Partidas'}
        </h3>
        
        <p className="text-gray-400 mb-2 text-center max-w-lg text-lg">
          {isProcessing 
            ? `Processando: ${currentFile}`
            : 'Selecione um ou múltiplos arquivos'
          }
        </p>
        
        <p className="text-gray-500 mb-8 text-center max-w-lg text-sm">
          Suporta <span className="text-blue-400 font-mono">.json.gz</span> (compactado),{' '}
          <span className="text-blue-400 font-mono">.json</span> ou{' '}
          <span className="text-blue-400 font-mono">.js</span>
          <br />
          <span className="text-green-400 font-semibold mt-2 inline-block">
            ✨ Agora com suporte para arquivos divididos!
          </span>
        </p>
        
        {isProcessing && (
          <div className="w-full max-w-md mb-6">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-gray-400 mt-2">
              {progress}% concluído
            </p>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.json,.gz"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessing}
          multiple
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
              Selecionar Arquivo(s)
            </>
          )}
        </Button>
        
        <div className="mt-8 space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
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
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm">
            <p className="text-blue-300 font-semibold mb-2">💡 Dica para arquivos grandes:</p>
            <p className="text-gray-300">
              Se seu arquivo é muito grande (&gt;100MB descompactado), divida-o em partes menores:
              <br />
              <code className="text-blue-400 bg-gray-800 px-2 py-1 rounded mt-2 inline-block">
                matches_part1.json.gz, matches_part2.json.gz, ...
              </code>
              <br />
              <span className="text-gray-400 text-xs mt-1 inline-block">
                Selecione todos os arquivos de uma vez. Eles serão processados sequencialmente.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;