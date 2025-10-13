# Como Trabalhar com Arquivos Grandes - Guia Completo

## Problema
Arquivos JavaScript (.js) com 500MB+ são muito grandes e, mesmo compactados, quando descompactados podem estourar a memória do navegador.

## Solução: Dividir + Comprimir
Divida o arquivo em partes menores (chunks) e compacte cada parte. O sistema processará sequencialmente para evitar problemas de memória.

---

## 🔧 Passo a Passo Completo

### 1. Preparar o Arquivo Original

Se você tem um arquivo `mockMatches.js`:
```javascript
export const mockMatches = [
  { "id": "match1", ... },
  { "id": "match2", ... },
  ...
  { "id": "match100000", ... }  // 100mil partidas
];
```

Remova o `export const mockMatches = ` e o `;` final, salvando apenas o array JSON:
```json
[
  { "id": "match1", ... },
  { "id": "match2", ... },
  ...
]
```

Salve como `matches.json`

---

### 2. Dividir o Arquivo em Partes

#### Opção A: Usando Node.js (Recomendado)

Crie um script `split-json.js`:

```javascript
const fs = require('fs');
const zlib = require('zlib');

// Configurações
const INPUT_FILE = 'matches.json';
const CHUNK_SIZE = 10000; // 10mil partidas por arquivo
const OUTPUT_PREFIX = 'matches_part';

async function splitAndCompress() {
  console.log('Lendo arquivo...');
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  if (!Array.isArray(data)) {
    throw new Error('O arquivo deve conter um array JSON');
  }

  const totalItems = data.length;
  const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);
  
  console.log(`Total de itens: ${totalItems}`);
  console.log(`Dividindo em ${totalChunks} parte(s) de ${CHUNK_SIZE} itens cada`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalItems);
    const chunk = data.slice(start, end);
    
    // Nome do arquivo: matches_part001.json.gz, matches_part002.json.gz, etc
    const partNumber = String(i + 1).padStart(3, '0');
    const outputFile = `${OUTPUT_PREFIX}${partNumber}.json.gz`;
    
    console.log(`Criando ${outputFile} (${chunk.length} itens)...`);
    
    // Converte para JSON
    const jsonString = JSON.stringify(chunk);
    
    // Compacta com gzip (nível máximo)
    const compressed = zlib.gzipSync(jsonString, { level: 9 });
    
    // Salva arquivo
    fs.writeFileSync(outputFile, compressed);
    
    const originalSize = Buffer.byteLength(jsonString);
    const compressedSize = compressed.length;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(2);
    
    console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compactado: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Redução: ${reduction}%`);
  }
  
  console.log('\n✅ Divisão e compactação concluídas!');
  console.log(`Arquivos gerados: ${OUTPUT_PREFIX}001.json.gz até ${OUTPUT_PREFIX}${String(totalChunks).padStart(3, '0')}.json.gz`);
}

splitAndCompress().catch(console.error);
```

Execute:
```bash
node split-json.js
```

#### Opção B: Usando Python

```python
import json
import gzip
import math

INPUT_FILE = 'matches.json'
CHUNK_SIZE = 10000
OUTPUT_PREFIX = 'matches_part'

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

total_items = len(data)
total_chunks = math.ceil(total_items / CHUNK_SIZE)

print(f'Total de itens: {total_items}')
print(f'Dividindo em {total_chunks} parte(s)')

for i in range(total_chunks):
    start = i * CHUNK_SIZE
    end = min(start + CHUNK_SIZE, total_items)
    chunk = data[start:end]
    
    part_number = str(i + 1).zfill(3)
    output_file = f'{OUTPUT_PREFIX}{part_number}.json.gz'
    
    print(f'Criando {output_file} ({len(chunk)} itens)...')
    
    json_string = json.dumps(chunk, ensure_ascii=False)
    
    with gzip.open(output_file, 'wt', encoding='utf-8', compresslevel=9) as f:
        f.write(json_string)

print('\n✅ Divisão e compactação concluídas!')
```

Execute:
```bash
python split-json.py
```

---

### 3. Fazer Upload dos Arquivos Divididos

1. Acesse o sistema
2. Clique em "Selecionar Arquivo(s)"
3. **Selecione TODOS os arquivos de uma vez** (Ctrl+A ou Cmd+A):
   - `matches_part001.json.gz`
   - `matches_part002.json.gz`
   - `matches_part003.json.gz`
   - etc.

4. O sistema irá:
   - ✅ Processar cada arquivo sequencialmente (um de cada vez)
   - ✅ Mostrar progresso em tempo real
   - ✅ Combinar todos os dados automaticamente
   - ✅ Remover partidas duplicadas (baseado no ID)
   - ✅ Liberar memória entre processamentos

---

## 📊 Exemplo Prático

### Cenário: Arquivo de 500MB

```
Arquivo original:
mockMatches.js: 500 MB

Passo 1 - Converter para JSON:
matches.json: 485 MB

Passo 2 - Dividir em 10 partes:
matches_part001.json: 48.5 MB
matches_part002.json: 48.5 MB
...
matches_part010.json: 48.5 MB

Passo 3 - Comprimir cada parte:
matches_part001.json.gz: 5-15 MB (70-90% menor)
matches_part002.json.gz: 5-15 MB
...
matches_part010.json.gz: 5-15 MB

Total compactado: 50-150 MB
```

---

## 💡 Dicas Importantes

### Tamanho Ideal dos Chunks

- **Para arquivos de 100-500 MB**: 5.000 - 10.000 itens por chunk
- **Para arquivos de 500MB - 1GB**: 3.000 - 5.000 itens por chunk
- **Para arquivos acima de 1GB**: 1.000 - 3.000 itens por chunk

### Nomenclatura dos Arquivos

Use números com zero à esquerda para ordem correta:
```
✅ Correto:
matches_part001.json.gz
matches_part002.json.gz
matches_part010.json.gz

❌ Incorreto:
matches_part1.json.gz
matches_part2.json.gz
matches_part10.json.gz  (será processado antes do part2!)
```

### Remoção de Duplicatas

O sistema remove automaticamente partidas duplicadas usando o campo `id`. Se seus dados não têm `id` único, adicione antes de dividir:

```javascript
const data = JSON.parse(fs.readFileSync('matches.json', 'utf8'));
const withIds = data.map((match, index) => ({
  ...match,
  id: match.id || `match_${index}`
}));
fs.writeFileSync('matches.json', JSON.stringify(withIds));
```

---

## 🚀 Benefícios da Divisão

✅ **Sem estouros de memória**: Processa um arquivo de cada vez
✅ **Flexibilidade**: Pode carregar apenas partes específicas se necessário
✅ **Confiabilidade**: Se um arquivo falhar, apenas ele precisa ser reprocessado
✅ **Progresso visível**: Barra de progresso mostra o andamento
✅ **Automático**: Combina tudo sem intervenção manual

---

## ⚠️ Solução de Problemas

### "Out of memory" ao processar

- Reduza o CHUNK_SIZE para 2000-5000 itens
- Divida em mais partes menores
- Feche outras abas do navegador

### Arquivos processados na ordem errada

- Use números com zero à esquerda (001, 002, etc)
- O sistema ordena alfabeticamente antes de processar

### Partidas duplicadas

- Certifique-se de que cada partida tem um `id` único
- O sistema remove duplicatas automaticamente

---

## 📝 Script Completo Automatizado

Para facilitar, aqui está um script que faz tudo de uma vez:

```javascript
// auto-split.js
const fs = require('fs');
const zlib = require('zlib');

const config = {
  inputFile: process.argv[2] || 'matches.json',
  chunkSize: parseInt(process.argv[3]) || 10000,
  outputPrefix: 'matches_part'
};

console.log('🚀 Iniciando processamento...\n');
console.log(`Arquivo de entrada: ${config.inputFile}`);
console.log(`Tamanho do chunk: ${config.chunkSize} itens\n`);

try {
  const data = JSON.parse(fs.readFileSync(config.inputFile, 'utf8'));
  
  if (!Array.isArray(data)) {
    throw new Error('O arquivo deve conter um array JSON');
  }

  const totalChunks = Math.ceil(data.length / config.chunkSize);
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * config.chunkSize;
    const end = Math.min(start + config.chunkSize, data.length);
    const chunk = data.slice(start, end);
    
    const partNumber = String(i + 1).padStart(3, '0');
    const outputFile = `${config.outputPrefix}${partNumber}.json.gz`;
    
    const jsonString = JSON.stringify(chunk);
    const compressed = zlib.gzipSync(jsonString, { level: 9 });
    
    fs.writeFileSync(outputFile, compressed);
    
    totalOriginalSize += Buffer.byteLength(jsonString);
    totalCompressedSize += compressed.length;
    
    console.log(`✓ ${outputFile} criado (${chunk.length} itens)`);
  }
  
  const totalReduction = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(2);
  
  console.log(`\n✅ Concluído!`);
  console.log(`Total original: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total compactado: ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Redução total: ${totalReduction}%`);
  console.log(`Arquivos gerados: ${totalChunks}`);
  
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
```

Uso:
```bash
# Padrão: 10.000 itens por chunk
node auto-split.js matches.json

# Personalizado: 5.000 itens por chunk
node auto-split.js matches.json 5000
```

---

**Pronto!** Agora você pode trabalhar com arquivos de qualquer tamanho sem problemas de memória! 🎉
