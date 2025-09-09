#!/usr/bin/env python3
"""
Validation de l'architecture IA optimisée sans backend
"""

import os
import json
import time
from pathlib import Path

def test_prompt_files():
    """Test de l'existence et de la validité des fichiers de prompts"""
    print("🔍 Test des fichiers de prompts...")
    
    prompt_files = [
        "backend/ia_prompts/creation_service_prompt.md",
        "backend/ia_prompts/recherche_service_prompt.md", 
        "backend/ia_prompts/echange_prompt.md",
        "backend/ia_prompts/question_generale_prompt.md",
        "backend/ia_prompts/support_prompt.md"
    ]
    
    valid_files = 0
    for file_path in prompt_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
            valid_files += 1
        else:
            print(f"❌ {file_path} - MANQUANT")
    
    print(f"\n📊 Fichiers de prompts: {valid_files}/{len(prompt_files)}")
    return valid_files == len(prompt_files)

def test_instruction_file():
    """Test du fichier d'instructions principal"""
    print("\n🔍 Test du fichier d'instructions principal...")
    
    instruction_file = "backend/ia_intentions_instructions.md"
    
    if os.path.exists(instruction_file):
        file_size = os.path.getsize(instruction_file)
        print(f"✅ {instruction_file} ({file_size} bytes)")
        
        # Vérifier le contenu
        with open(instruction_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if "creation_service" in content and "recherche_besoin" in content:
                print("✅ Contenu valide (intentions détectées)")
                return True
            else:
                print("⚠️ Contenu incomplet")
                return False
    else:
        print(f"❌ {instruction_file} - MANQUANT")
        return False

def test_rust_files():
    """Test de l'existence des fichiers Rust optimisés"""
    print("\n🔍 Test des fichiers Rust optimisés...")
    
    rust_files = [
        "backend/src/services/ia/mod.rs",
        "backend/src/services/ia/intention_detector.rs",
        "backend/src/services/ia/prompt_manager.rs",
        "backend/src/services/orchestration_ia.rs"
    ]
    
    valid_files = 0
    for file_path in rust_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
            valid_files += 1
        else:
            print(f"❌ {file_path} - MANQUANT")
    
    print(f"\n📊 Fichiers Rust: {valid_files}/{len(rust_files)}")
    return valid_files == len(rust_files)

def test_compilation():
    """Test de compilation du projet Rust"""
    print("\n🔍 Test de compilation...")
    
    try:
        import subprocess
        result = subprocess.run(
            ["cargo", "check", "--manifest-path", "backend/Cargo.toml"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print("✅ Compilation réussie")
            return True
        else:
            print(f"❌ Erreurs de compilation:")
            print(result.stderr[:500])
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors de la compilation: {e}")
        return False

def test_architecture_structure():
    """Test de la structure de l'architecture"""
    print("\n🔍 Test de la structure de l'architecture...")
    
    # Vérifier que l'orchestration IA utilise le service optimisé
    orchestration_file = "backend/src/services/orchestration_ia.rs"
    
    if os.path.exists(orchestration_file):
        with open(orchestration_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
            checks = [
                ("OptimizedIAService", "Service IA optimisé importé"),
                ("process_user_request", "Méthode de traitement optimisée"),
                ("IntentionDetector", "Détecteur d'intention"),
                ("PromptManager", "Gestionnaire de prompts")
            ]
            
            valid_checks = 0
            for check, description in checks:
                if check in content:
                    print(f"✅ {description}")
                    valid_checks += 1
                else:
                    print(f"❌ {description} - MANQUANT")
            
            print(f"\n📊 Composants architecturaux: {valid_checks}/{len(checks)}")
            return valid_checks == len(checks)
    else:
        print(f"❌ {orchestration_file} - MANQUANT")
        return False

def generate_architecture_report():
    """Générer un rapport de l'architecture"""
    print("\n" + "="*60)
    print("📋 RAPPORT D'ARCHITECTURE IA OPTIMISÉE")
    print("="*60)
    
    tests = [
        ("Fichiers de prompts", test_prompt_files),
        ("Fichier d'instructions", test_instruction_file),
        ("Fichiers Rust", test_rust_files),
        ("Compilation", test_compilation),
        ("Structure architecturale", test_architecture_structure)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}")
        print("-" * 40)
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Erreur lors du test: {e}")
            results.append((test_name, False))
    
    # Résumé final
    print("\n" + "="*60)
    print("📊 RÉSUMÉ FINAL")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Score: {passed}/{total} ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 Architecture IA optimisée VALIDÉE!")
        print("\n🚀 Prochaines étapes:")
        print("1. Démarrer le backend: backend/start_backend.bat")
        print("2. Tester l'API: python backend/test_optimized_ia.py")
        print("3. Vérifier les performances")
    else:
        print("⚠️ Architecture incomplète - corrections nécessaires")
    
    return passed == total

if __name__ == "__main__":
    generate_architecture_report() 