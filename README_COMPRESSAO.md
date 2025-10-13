# Como Comprimir Arquivos de Dados para o Sistema

## Problema
Arquivos JavaScript (.js) com 500MB+ são muito grandes para upload eficiente.

## Solução
Use compressão GZIP para reduzir o tamanho do arquivo em 70-90%.

## Passo a Passo

### 1. Converter JavaScript para JSON

Se você tem um arquivo `mockMatches.js` como este:
```javascript
export const mockMatches = [
  {
    "id": "match1",
    "date": "2025-02-05",
    ...
  },
  ...
];
```

Remova a parte `export const mockMatches = ` e o `;` final, deixando apenas o array JSON:
```json
[
  {
    "id": "match1",
    "date": "2025-02-05",
    ...
  },
  ...
]
```

Salve como `matches.json`

### 2. Comprimir com GZIP

#### No Windows (PowerShell):
```powershell
# Usando 7-Zip (instale de https://www.7-zip.org/)
7z a -tgzip matches.json.gz matches.json
```

#### No Linux/Mac:
```bash
gzip -k matches.json
# Isso cria matches.json.gz mantendo o original (-k)
```

#### Usando Node.js (qualquer sistema):
```javascript
const fs = require('fs');
const zlib = require('zlib');

const input = fs.createReadStream('matches.json');
const output = fs.createWriteStream('matches.json.gz');
const gzip = zlib.createGzip({ level: 9 }); // nível máximo de compressão

input.pipe(gzip).pipe(output);

output.on('finish', () => {
  console.log('Arquivo compactado com sucesso!');
  
  const originalSize = fs.statSync('matches.json').size;
  const compressedSize = fs.statSync('matches.json.gz').size;
  const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(2);
  
  console.log(`Tamanho original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Tamanho compactado: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Redução: ${reduction}%`);
});
```

### 3. Fazer Upload

1. Acesse o sistema
2. Clique em "Selecionar Arquivo"
3. Escolha o arquivo `matches.json.gz`
4. O sistema automaticamente:
   - Detecta que é um arquivo compactado
   - Descompacta usando pako
   - Carrega os dados

## Formatos Suportados

O sistema aceita três formatos:

1. **`.json.gz`** (Recomendado para arquivos grandes)
   - JSON compactado com gzip
   - Redução de 70-90% no tamanho

2. **`.json`** (JSON puro)
   - Para arquivos menores
   - Sem compressão

3. **`.js`** (JavaScript)
   - Formato antigo
   - Apenas para compatibilidade

## Exemplo de Redução de Tamanho

```
Arquivo Original (.js):    500 MB
Convertido para JSON:       485 MB
Compactado (.json.gz):      50-150 MB (70-90% menor!)
```

## Benefícios

✅ Upload 5-10x mais rápido
✅ Menor uso de banda
✅ Processamento mais eficiente
✅ Mesma funcionalidade

## Observações

- A descompressão acontece no navegador, não há necessidade de backend
- O processo é transparente para o usuário
- A biblioteca pako é muito eficiente e rápida
