"""
check_ready_to_train.py - Verifica se tudo está pronto para treinar

Uso:
    python check_ready_to_train.py
"""

import asyncio
import os
import sys
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PreTrainingChecker:
    """Verifica se sistema está pronto para treinar"""
    
    def __init__(self):
        self.checks = []
        self.warnings = []
        self.errors = []
    
    def check_files(self):
        """Verifica se arquivos necessários existem"""
        
        print("\n📁 Verificando arquivos...")
        print("-" * 60)
        
        required_files = [
            ("ai_system/ai_feature_extractor_v2.py", True),
            ("ai_system/ai_feature_extractor_with_db.py", True),
            ("ai_system/ai_reward_system_v2.py", True),
            ("ai_system/ai_betting_agent_v2.py", True),
            ("ai_system/ai_insights_routes.py", True),
            ("enrich_data_with_form.py", True),
            ("train_quality_focused.py", True),
            ("analyze_feature_importance.py", False),
            ("compare_models.py", False),
        ]
        
        for file_path, is_critical in required_files:
            if os.path.exists(file_path):
                print(f"  ✅ {file_path}")
                self.checks.append(f"Arquivo {file_path} existe")
            else:
                if is_critical:
                    print(f"  ❌ {file_path} (CRÍTICO!)")
                    self.errors.append(f"Arquivo crítico ausente: {file_path}")
                else:
                    print(f"  ⚠️  {file_path} (opcional)")
                    self.warnings.append(f"Arquivo opcional ausente: {file_path}")
    
    async def check_database(self):
        """Verifica conexão e dados do MongoDB"""
        
        print("\n🗄️  Verificando banco de dados...")
        print("-" * 60)
        
        try:
            from database import connect_to_mongo, get_db
            
            # Conectar
            await connect_to_mongo()
            db = await get_db()
            
            print("  ✅ Conexão com MongoDB OK")
            self.checks.append("MongoDB conectado")
            
            # Contar partidas
            total_matches = await db.partidas.count_documents({})
            print(f"  📊 Total de partidas: {total_matches}")
            
            if total_matches < 1000:
                print("  ⚠️  MENOS DE 1000 PARTIDAS!")
                print("     Recomendação: Importe mais dados")
                self.warnings.append(f"Apenas {total_matches} partidas (mínimo 1000)")
            elif total_matches < 5000:
                print("  ⚠️  Menos de 5000 partidas")
                print("     Recomendação: Importe mais para melhores resultados")
                self.warnings.append(f"Apenas {total_matches} partidas (ideal 5000+)")
            else:
                print(f"  ✅ {total_matches} partidas (bom!)")
                self.checks.append(f"{total_matches} partidas disponíveis")
            
            # Verificar se dados foram enriquecidos
            enriched = await db.partidas.count_documents({"enriched_at": {"$exists": True}})
            
            if enriched == 0:
                print("  ❌ DADOS NÃO ENRIQUECIDOS!")
                print("     AÇÃO NECESSÁRIA: Execute enrich_data_with_form.py")
                self.errors.append("Dados não enriquecidos com forma recente e H2H")
            elif enriched < total_matches * 0.5:
                print(f"  ⚠️  Apenas {enriched}/{total_matches} partidas enriquecidas")
                print("     Recomendação: Execute enrich_data_with_form.py novamente")
                self.warnings.append(f"Apenas {enriched} partidas enriquecidas")
            else:
                print(f"  ✅ {enriched} partidas enriquecidas")
                self.checks.append(f"{enriched} partidas com forma recente e H2H")
            
            # Verificar odds
            with_odds = await db.partidas.count_documents({
                "markets.TotalGols_MaisDe_35": {"$gt": 0}
            })
            
            if with_odds < total_matches * 0.8:
                print(f"  ⚠️  Apenas {with_odds} partidas têm odd over 3.5")
                self.warnings.append(f"Apenas {with_odds} partidas com odds")
            else:
                print(f"  ✅ {with_odds} partidas têm odd over 3.5")
                self.checks.append(f"{with_odds} partidas com odds")
            
        except Exception as e:
            print(f"  ❌ Erro ao conectar: {e}")
            self.errors.append(f"Erro MongoDB: {str(e)}")
    
    def check_dependencies(self):
        """Verifica dependências Python"""
        
        print("\n📦 Verificando dependências...")
        print("-" * 60)
        
        required_packages = [
            ("torch", "PyTorch"),
            ("numpy", "NumPy"),
            ("motor", "Motor (MongoDB async)"),
            ("fastapi", "FastAPI"),
        ]
        
        for package, name in required_packages:
            try:
                __import__(package)
                print(f"  ✅ {name}")
                self.checks.append(f"{name} instalado")
            except ImportError:
                print(f"  ❌ {name} não encontrado")
                self.errors.append(f"Pacote ausente: {name}")
    
    def check_gpu(self):
        """Verifica disponibilidade de GPU"""
        
        print("\n🖥️  Verificando GPU...")
        print("-" * 60)
        
        try:
            import torch
            
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                print(f"  ✅ GPU disponível: {gpu_name}")
                print(f"     Treinamento será ~5-10x mais rápido!")
                self.checks.append(f"GPU: {gpu_name}")
            else:
                print("  ⚠️  GPU não disponível")
                print("     Treinamento será em CPU (mais lento)")
                self.warnings.append("Sem GPU - treinamento mais lento")
        except:
            print("  ⚠️  Não foi possível verificar GPU")
    
    def check_disk_space(self):
        """Verifica espaço em disco"""
        
        print("\n💾 Verificando espaço em disco...")
        print("-" * 60)
        
        try:
            import shutil
            
            # Verificar espaço em models/
            models_dir = "models"
            os.makedirs(models_dir, exist_ok=True)
            
            stat = shutil.disk_usage(models_dir)
            free_gb = stat.free / (1024**3)
            
            if free_gb < 1:
                print(f"  ❌ Apenas {free_gb:.1f} GB disponível")
                print("     Libere espaço antes de treinar!")
                self.errors.append(f"Pouco espaço: {free_gb:.1f} GB")
            elif free_gb < 5:
                print(f"  ⚠️  {free_gb:.1f} GB disponível")
                print("     Recomendação: Libere mais espaço")
                self.warnings.append(f"Espaço limitado: {free_gb:.1f} GB")
            else:
                print(f"  ✅ {free_gb:.1f} GB disponível")
                self.checks.append(f"{free_gb:.1f} GB de espaço")
        except:
            print("  ⚠️  Não foi possível verificar espaço em disco")
    
    def print_summary(self):
        """Imprime resumo final"""
        
        print("\n" + "="*60)
        print("📊 RESUMO DA VERIFICAÇÃO")
        print("="*60)
        
        print(f"\n✅ Checks OK: {len(self.checks)}")
        for check in self.checks[:5]:
            print(f"   • {check}")
        if len(self.checks) > 5:
            print(f"   ... e mais {len(self.checks) - 5}")
        
        if self.warnings:
            print(f"\n⚠️  Avisos: {len(self.warnings)}")
            for warning in self.warnings:
                print(f"   • {warning}")
        
        if self.errors:
            print(f"\n❌ Erros Críticos: {len(self.errors)}")
            for error in self.errors:
                print(f"   • {error}")
        
        print("\n" + "="*60)
        
        # Veredito final
        if self.errors:
            print("\n❌ SISTEMA NÃO ESTÁ PRONTO PARA TREINAR!")
            print("\n🔧 AÇÕES NECESSÁRIAS:")
            
            if "Dados não enriquecidos" in str(self.errors):
                print("   1. Execute: python enrich_data_with_form.py")
            
            for error in self.errors:
                if "ausente" in error.lower():
                    print(f"   • Instale ou copie: {error}")
            
            print("\n💡 Depois de corrigir, execute este script novamente")
            
        elif self.warnings:
            print("\n⚠️  SISTEMA PODE SER USADO, MAS COM RESSALVAS")
            print("\n💡 RECOMENDAÇÕES:")
            
            for warning in self.warnings:
                if "partidas" in warning.lower():
                    print("   • Importe mais dados para melhores resultados")
                elif "espaço" in warning.lower():
                    print("   • Libere espaço em disco")
                elif "GPU" in warning.lower():
                    print("   • Treinamento será mais lento (OK)")
            
            print("\n✅ Pode prosseguir, mas considere as recomendações acima")
            
        else:
            print("\n✅ SISTEMA 100% PRONTO PARA TREINAR!")
            print("\n🚀 PRÓXIMO PASSO:")
            print("   python train_quality_focused.py")
        
        print("="*60 + "\n")
        
        return len(self.errors) == 0


async def main():
    """Função principal"""
    
    print("\n" + "="*60)
    print("🔍 VERIFICAÇÃO PRÉ-TREINAMENTO")
    print("="*60)
    print("\nVerificando se tudo está pronto para treinar...\n")
    
    checker = PreTrainingChecker()
    
    # Executar verificações
    checker.check_files()
    await checker.check_database()
    checker.check_dependencies()
    checker.check_gpu()
    checker.check_disk_space()
    
    # Resumo
    ready = checker.print_summary()
    
    # Exit code
    sys.exit(0 if ready else 1)


if __name__ == "__main__":
    asyncio.run(main())
