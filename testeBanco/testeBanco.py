from pymongo import MongoClient
import pandas as pd

# 1️⃣ Conexão com o servidor MongoDB
# Exemplo para localhost:
client = MongoClient("mongodb://localhost:27017/")  

# Caso seu Mongo esteja em outro host/porta:
# client = MongoClient("mongodb://usuario:senha@dadosFutebol:27017/")

# 2️⃣ Seleciona o banco e a coleção
db = client["futebol"]
colecao = db["partidas"]

# 3️⃣ Lê todos os documentos
documentos = list(colecao.find())

print(f"Total de partidas encontradas: {len(documentos)}")

# 4️⃣ Converte em DataFrame (para análise mais fácil)
df = pd.DataFrame(documentos)

# Remove o campo '_id' (do Mongo)
if '_id' in df.columns:
    df = df.drop(columns=['_id'])

# Mostra as primeiras linhas
print(df.head(3))

# 5️⃣ Exemplo de análise simples:
print("\n=== Estatísticas rápidas ===")
print("Total médio de gols FT:", df["totalGolsFT"].mean())
print("Top 5 times da casa mais frequentes:")
print(df["timeCasa"].value_counts().head())

# 6️⃣ Exemplo de leitura de odds dentro de 'markets'
# Transforma os mercados em colunas individuais
markets_df = pd.json_normalize(df["markets"])
df_completo = pd.concat([df.drop(columns=['markets']), markets_df], axis=1)

print("\n=== Colunas do dataframe completo ===")
print(df_completo.columns[:10])

# 7️⃣ Salva em CSV se quiser
df_completo.to_csv("partidas_analisadas.csv", index=False, encoding="utf-8")
print("\nArquivo 'partidas_analisadas.csv' criado com sucesso!")
