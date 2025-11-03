"""
enrich_data_with_form.py - Enriquece dados com FORMA RECENTE e H2H

Adiciona aos dados:
- Forma recente dos times (últimos 5 jogos)
- Head-to-head histórico
- Estatísticas de gols
- Padrões temporais

Uso:
    python enrich_data_with_form.py
    
IMPORTANTE: Execute antes de treinar para ter features completas!
"""

import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataEnricher:
    """Enriquece dados com forma recente e H2H"""
    
    def __init__(self, db):
        self.db = db
        
        # Cache
        self.team_history = defaultdict(list)
        self.h2h_cache = {}
        
        # Stats
        self.stats = {
            'total_processed': 0,
            'with_form': 0,
            'with_h2h': 0,
            'errors': 0
        }
    
    async def enrich_all_matches(self, batch_size: int = 100):
        """
        Enriquece todas as partidas do banco.
        
        Processa em batches para não sobrecarregar memória.
        """
        
        logger.info("🔄 Iniciando enriquecimento dos dados...")
        
        # Contar total
        total_matches = await self.db.partidas.count_documents({})
        logger.info(f"📊 Total de partidas: {total_matches}")
        
        # Processar em batches
        processed = 0
        
        while processed < total_matches:
            # Buscar batch
            cursor = self.db.partidas.find().skip(processed).limit(batch_size)
            matches = await cursor.to_list(length=batch_size)
            
            if not matches:
                break
            
            # Enriquecer batch
            for match in matches:
                try:
                    enriched = await self.enrich_match(match)
                    
                    # Atualizar no banco
                    await self.db.partidas.update_one(
                        {"_id": match["_id"]},
                        {"$set": {
                            "forma_casa": enriched.get("forma_casa"),
                            "forma_visitante": enriched.get("forma_visitante"),
                            "h2h": enriched.get("h2h"),
                            "enriched_at": datetime.now()
                        }}
                    )
                    
                    self.stats['total_processed'] += 1
                    
                    if enriched.get("forma_casa"):
                        self.stats['with_form'] += 1
                    if enriched.get("h2h"):
                        self.stats['with_h2h'] += 1
                
                except Exception as e:
                    logger.error(f"❌ Erro ao enriquecer partida {match.get('_id')}: {e}")
                    self.stats['errors'] += 1
            
            processed += len(matches)
            
            # Log progresso
            logger.info(
                f"📊 Progresso: {processed}/{total_matches} "
                f"({processed/total_matches*100:.1f}%)"
            )
        
        # Resumo final
        logger.info("\n" + "="*60)
        logger.info("✅ ENRIQUECIMENTO COMPLETO!")
        logger.info("="*60)
        logger.info(f"Total processado: {self.stats['total_processed']}")
        logger.info(f"Com forma recente: {self.stats['with_form']}")
        logger.info(f"Com H2H: {self.stats['with_h2h']}")
        logger.info(f"Erros: {self.stats['errors']}")
        logger.info("="*60 + "\n")
    
    async def enrich_match(self, match: Dict) -> Dict:
        """
        Enriquece uma partida individual.
        
        Returns:
            Dict com dados enriquecidos
        """
        
        enriched = {}
        
        # Extrair info básica
        home_team = match.get("time_casa", "Unknown")
        away_team = match.get("time_visitante", "Unknown")
        match_date = match.get("data", datetime.now())
        
        # 1. FORMA RECENTE CASA
        enriched["forma_casa"] = await self.get_team_form(
            team_name=home_team,
            before_date=match_date,
            is_home=True
        )
        
        # 2. FORMA RECENTE VISITANTE
        enriched["forma_visitante"] = await self.get_team_form(
            team_name=away_team,
            before_date=match_date,
            is_home=False
        )
        
        # 3. HEAD-TO-HEAD
        enriched["h2h"] = await self.get_h2h_stats(
            home_team=home_team,
            away_team=away_team,
            before_date=match_date
        )
        
        return enriched
    
    async def get_team_form(
        self,
        team_name: str,
        before_date: datetime,
        is_home: bool,
        num_games: int = 5
    ) -> Dict:
        """
        Busca forma recente do time.
        
        Args:
            team_name: Nome do time
            before_date: Data limite (não incluir jogos após essa data)
            is_home: Se é time da casa
            num_games: Número de jogos anteriores
            
        Returns:
            Dict com estatísticas de forma
        """
        
        # Buscar últimos N jogos do time
        query = {
            "$or": [
                {"time_casa": team_name},
                {"time_visitante": team_name}
            ],
            "data": {"$lt": before_date}
        }
        
        cursor = self.db.partidas.find(query).sort("data", -1).limit(num_games)
        recent_games = await cursor.to_list(length=num_games)
        
        if not recent_games:
            return self._get_default_form()
        
        # Calcular estatísticas
        stats = {
            'num_games': len(recent_games),
            'gols_marcados': [],
            'gols_sofridos': [],
            'total_gols': [],
            'resultados': [],  # W, D, L
            'over25': 0,
            'over35': 0,
            'btts': 0
        }
        
        for game in recent_games:
            is_team_home = game.get("time_casa") == team_name
            
            if is_team_home:
                gols_marcados = game.get("gols_casa", 0)
                gols_sofridos = game.get("gols_visitante", 0)
            else:
                gols_marcados = game.get("gols_visitante", 0)
                gols_sofridos = game.get("gols_casa", 0)
            
            total = gols_marcados + gols_sofridos
            
            stats['gols_marcados'].append(gols_marcados)
            stats['gols_sofridos'].append(gols_sofridos)
            stats['total_gols'].append(total)
            
            # Resultado
            if gols_marcados > gols_sofridos:
                stats['resultados'].append('W')
            elif gols_marcados == gols_sofridos:
                stats['resultados'].append('D')
            else:
                stats['resultados'].append('L')
            
            # Over/Under
            if total > 2.5:
                stats['over25'] += 1
            if total > 3.5:
                stats['over35'] += 1
            
            # BTTS
            if gols_marcados > 0 and gols_sofridos > 0:
                stats['btts'] += 1
        
        # Calcular médias
        form = {
            'num_games': stats['num_games'],
            'gols_marcados_media': np.mean(stats['gols_marcados']),
            'gols_sofridos_media': np.mean(stats['gols_sofridos']),
            'total_gols_media': np.mean(stats['total_gols']),
            'over25_percent': stats['over25'] / stats['num_games'],
            'over35_percent': stats['over35'] / stats['num_games'],
            'btts_percent': stats['btts'] / stats['num_games'],
            'vitorias': stats['resultados'].count('W'),
            'empates': stats['resultados'].count('D'),
            'derrotas': stats['resultados'].count('L'),
            'pontos': stats['resultados'].count('W') * 3 + stats['resultados'].count('D'),
            'win_rate': stats['resultados'].count('W') / stats['num_games'],
            
            # Momentum (últimos 3 jogos mais importantes)
            'momentum': self._calculate_momentum(stats['resultados']),
            
            # Consistência (desvio padrão de gols)
            'consistencia_ataque': 1 / (1 + np.std(stats['gols_marcados'])),
            'consistencia_defesa': 1 / (1 + np.std(stats['gols_sofridos'])),
        }
        
        return form
    
    async def get_h2h_stats(
        self,
        home_team: str,
        away_team: str,
        before_date: datetime,
        num_games: int = 10
    ) -> Dict:
        """
        Busca estatísticas de confrontos diretos.
        
        Args:
            home_team: Time da casa
            away_team: Time visitante
            before_date: Data limite
            num_games: Número de confrontos
            
        Returns:
            Dict com estatísticas de H2H
        """
        
        # Buscar confrontos diretos
        query = {
            "$or": [
                {"time_casa": home_team, "time_visitante": away_team},
                {"time_casa": away_team, "time_visitante": home_team}
            ],
            "data": {"$lt": before_date}
        }
        
        cursor = self.db.partidas.find(query).sort("data", -1).limit(num_games)
        h2h_games = await cursor.to_list(length=num_games)
        
        if not h2h_games:
            return self._get_default_h2h()
        
        # Calcular estatísticas
        stats = {
            'num_games': len(h2h_games),
            'total_gols': [],
            'home_wins': 0,
            'away_wins': 0,
            'draws': 0,
            'home_goals': [],
            'away_goals': [],
            'over25': 0,
            'over35': 0,
            'btts': 0
        }
        
        for game in h2h_games:
            gols_casa = game.get("gols_casa", 0)
            gols_visitante = game.get("gols_visitante", 0)
            total = gols_casa + gols_visitante
            
            # Determinar vencedor baseado na perspectiva atual
            game_home = game.get("time_casa")
            if game_home == home_team:
                stats['home_goals'].append(gols_casa)
                stats['away_goals'].append(gols_visitante)
                if gols_casa > gols_visitante:
                    stats['home_wins'] += 1
                elif gols_visitante > gols_casa:
                    stats['away_wins'] += 1
                else:
                    stats['draws'] += 1
            else:
                stats['home_goals'].append(gols_visitante)
                stats['away_goals'].append(gols_casa)
                if gols_visitante > gols_casa:
                    stats['home_wins'] += 1
                elif gols_casa > gols_visitante:
                    stats['away_wins'] += 1
                else:
                    stats['draws'] += 1
            
            stats['total_gols'].append(total)
            
            if total > 2.5:
                stats['over25'] += 1
            if total > 3.5:
                stats['over35'] += 1
            if gols_casa > 0 and gols_visitante > 0:
                stats['btts'] += 1
        
        # Compilar resultado
        h2h = {
            'num_games': stats['num_games'],
            'total_gols_media': np.mean(stats['total_gols']),
            'over25_percent': stats['over25'] / stats['num_games'],
            'over35_percent': stats['over35'] / stats['num_games'],
            'btts_percent': stats['btts'] / stats['num_games'],
            'home_wins': stats['home_wins'],
            'away_wins': stats['away_wins'],
            'draws': stats['draws'],
            'home_goals_media': np.mean(stats['home_goals']),
            'away_goals_media': np.mean(stats['away_goals']),
            'ultimo_total_gols': stats['total_gols'][0] if stats['total_gols'] else 0,
            'tendencia_gols': self._calculate_trend(stats['total_gols']),
            'variancia_gols': np.var(stats['total_gols']),
            'maior_placar': max(stats['total_gols']) if stats['total_gols'] else 0,
            'previsibilidade': 1 / (1 + np.std(stats['total_gols'])) if stats['total_gols'] else 0.5
        }
        
        return h2h
    
    def _calculate_momentum(self, results: List[str]) -> float:
        """
        Calcula momentum do time (últimos jogos mais importantes).
        
        W = 1.0, D = 0.5, L = 0.0
        Últimos jogos têm peso maior
        """
        if not results:
            return 0.5
        
        weights = [0.4, 0.3, 0.2, 0.1]  # Últimos 4 jogos
        weighted_sum = 0
        
        for i, result in enumerate(results[:4]):
            if result == 'W':
                value = 1.0
            elif result == 'D':
                value = 0.5
            else:
                value = 0.0
            
            weight = weights[i] if i < len(weights) else 0.0
            weighted_sum += value * weight
        
        return weighted_sum
    
    def _calculate_trend(self, values: List[float]) -> float:
        """
        Calcula tendência (subindo, descendo ou estável).
        
        Returns:
            Positivo = subindo, Negativo = descendo, ~0 = estável
        """
        if len(values) < 2:
            return 0.0
        
        # Regressão linear simples
        x = np.arange(len(values))
        y = np.array(values)
        
        slope = np.polyfit(x, y, 1)[0]
        
        return slope
    
    def _get_default_form(self) -> Dict:
        """Retorna forma padrão quando não há dados"""
        return {
            'num_games': 0,
            'gols_marcados_media': 1.5,
            'gols_sofridos_media': 1.5,
            'total_gols_media': 3.0,
            'over25_percent': 0.5,
            'over35_percent': 0.3,
            'btts_percent': 0.5,
            'vitorias': 0,
            'empates': 0,
            'derrotas': 0,
            'pontos': 0,
            'win_rate': 0.33,
            'momentum': 0.5,
            'consistencia_ataque': 0.5,
            'consistencia_defesa': 0.5
        }
    
    def _get_default_h2h(self) -> Dict:
        """Retorna H2H padrão quando não há dados"""
        return {
            'num_games': 0,
            'total_gols_media': 2.5,
            'over25_percent': 0.5,
            'over35_percent': 0.3,
            'btts_percent': 0.5,
            'home_wins': 0,
            'away_wins': 0,
            'draws': 0,
            'home_goals_media': 1.5,
            'away_goals_media': 1.5,
            'ultimo_total_gols': 0,
            'tendencia_gols': 0.0,
            'variancia_gols': 1.0,
            'maior_placar': 5,
            'previsibilidade': 0.5
        }


async def main():
    """Função principal"""
    
    print("\n" + "="*60)
    print("🔄 ENRIQUECIMENTO DE DADOS")
    print("="*60)
    print("\nAdicionando:")
    print("  • Forma recente dos times (últimos 5 jogos)")
    print("  • Head-to-head histórico (últimos 10 confrontos)")
    print("  • Estatísticas de gols e padrões")
    print("\nISTO PODE DEMORAR ALGUNS MINUTOS...")
    print("="*60 + "\n")
    
    # Conectar ao banco
    from database import connect_to_mongo, get_db
    
    await connect_to_mongo()
    db = await get_db()
    
    # Criar enricher
    enricher = DataEnricher(db)
    
    # Enriquecer todos os dados
    await enricher.enrich_all_matches(batch_size=100)
    
    print("\n✅ Dados enriquecidos com sucesso!")
    print("💡 Agora você pode treinar o modelo com features completas\n")


if __name__ == "__main__":
    asyncio.run(main())