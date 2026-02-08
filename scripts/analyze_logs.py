#!/usr/bin/env python3
"""
Script d'analyse des logs PostgreSQL
Analyse les erreurs, migrations, et état de la base de données
"""

import csv
import re
import sys
from collections import defaultdict
from datetime import datetime

# Augmenter la limite de taille de champ CSV
csv.field_size_limit(sys.maxsize)

def analyze_logs(csv_file):
    """Analyse le fichier CSV de logs"""
    
    errors = []
    migrations = []
    db_operations = []
    critical_errors = []
    migration_errors = []
    
    error_patterns = {
        'syntax_error': r'syntax error',
        'missing_column': r'column.*does not exist',
        'missing_table': r'relation.*does not exist',
        'duplicate': r'already exists',
        'materialized_view': r'cannot refresh materialized view',
        'from_clause': r'missing FROM-clause',
        'group_by': r'must appear in the GROUP BY',
        'prepared_statement': r'cannot insert multiple commands',
    }
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            message = row.get('message', '')
            
            # Détecter les erreurs
            if 'ERROR:' in message:
                errors.append({
                    'timestamp': row.get('timestamp', ''),
                    'message': message
                })
                
                # Classifier les erreurs
                for error_type, pattern in error_patterns.items():
                    if re.search(pattern, message, re.IGNORECASE):
                        critical_errors.append({
                            'type': error_type,
                            'timestamp': row.get('timestamp', ''),
                            'message': message
                        })
                        break
            
            # Détecter les migrations
            if any(keyword in message.lower() for keyword in ['migration', 'migrate', 'sqlx migrate', 'CREATE TABLE', 'ALTER TABLE', 'CREATE VIEW']):
                migrations.append({
                    'timestamp': row.get('timestamp', ''),
                    'message': message[:200]  # Tronquer les longs messages
                })
            
            # Détecter les opérations DB
            if any(keyword in message.lower() for keyword in ['connection', 'pool', 'query', 'execute']):
                db_operations.append({
                    'timestamp': row.get('timestamp', ''),
                    'message': message[:200]
                })
    
    return {
        'total_errors': len(errors),
        'errors': errors,
        'critical_errors': critical_errors,
        'migrations': migrations,
        'db_operations': db_operations,
        'error_patterns': error_patterns
    }

def generate_report(analysis):
    """Génère un rapport d'analyse"""
    
    report = []
    report.append("=" * 80)
    report.append("ANALYSE DES LOGS POSTGRESQL")
    report.append("=" * 80)
    report.append("")
    
    # Résumé général
    report.append("📊 RÉSUMÉ GÉNÉRAL")
    report.append("-" * 80)
    report.append(f"Total d'erreurs détectées: {analysis['total_errors']}")
    report.append(f"Erreurs critiques: {len(analysis['critical_errors'])}")
    report.append(f"Opérations de migration détectées: {len(analysis['migrations'])}")
    report.append(f"Opérations DB détectées: {len(analysis['db_operations'])}")
    report.append("")
    
    # Analyse des erreurs critiques
    if analysis['critical_errors']:
        report.append("🔴 ERREURS CRITIQUES")
        report.append("-" * 80)
        
        # Grouper par type
        errors_by_type = defaultdict(list)
        for error in analysis['critical_errors']:
            errors_by_type[error['type']].append(error)
        
        for error_type, error_list in errors_by_type.items():
            report.append(f"\n{error_type.upper()}: {len(error_list)} occurrence(s)")
            for i, error in enumerate(error_list[:5], 1):  # Afficher les 5 premières
                timestamp = error['timestamp']
                if timestamp:
                    try:
                        ts = int(timestamp) / 1000
                        dt = datetime.fromtimestamp(ts)
                        timestamp_str = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        timestamp_str = timestamp
                else:
                    timestamp_str = "N/A"
                
                msg = error['message'].replace('\n', ' ').strip()[:150]
                report.append(f"  {i}. [{timestamp_str}] {msg}")
            
            if len(error_list) > 5:
                report.append(f"  ... et {len(error_list) - 5} autre(s)")
        
        report.append("")
    
    # Analyse des migrations
    if analysis['migrations']:
        report.append("📝 MIGRATIONS DÉTECTÉES")
        report.append("-" * 80)
        report.append(f"Total: {len(analysis['migrations'])} opération(s) de migration")
        
        # Dernières migrations
        recent_migrations = sorted(analysis['migrations'], key=lambda x: x['timestamp'], reverse=True)[:10]
        report.append("\nDernières 10 opérations de migration:")
        for i, mig in enumerate(recent_migrations, 1):
            timestamp = mig['timestamp']
            if timestamp:
                try:
                    ts = int(timestamp) / 1000
                    dt = datetime.fromtimestamp(ts)
                    timestamp_str = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    timestamp_str = timestamp
            else:
                timestamp_str = "N/A"
            
            msg = mig['message'].replace('\n', ' ').strip()[:100]
            report.append(f"  {i}. [{timestamp_str}] {msg}")
        
        report.append("")
    
    # État de la base de données
    report.append("💾 ÉTAT DE LA BASE DE DONNÉES")
    report.append("-" * 80)
    
    if analysis['total_errors'] == 0:
        report.append("✅ Aucune erreur détectée - Base de données opérationnelle")
    elif len(analysis['critical_errors']) == 0:
        report.append("⚠️  Erreurs mineures détectées - Base de données fonctionnelle")
    else:
        report.append("❌ Erreurs critiques détectées - Base de données en état dégradé")
    
    # Détecter les problèmes spécifiques
    report.append("\n🔍 PROBLÈMES DÉTECTÉS:")
    
    problems = []
    if any(e['type'] == 'syntax_error' for e in analysis['critical_errors']):
        problems.append("❌ Erreurs de syntaxe SQL (migrations mal formées)")
    
    if any(e['type'] == 'missing_column' for e in analysis['critical_errors']):
        problems.append("❌ Colonnes manquantes (migrations incomplètes)")
    
    if any(e['type'] == 'materialized_view' for e in analysis['critical_errors']):
        problems.append("⚠️  Vue matérialisée nécessite un index unique pour refresh concurrent")
    
    if any(e['type'] == 'from_clause' for e in analysis['critical_errors']):
        problems.append("❌ Erreurs dans les vues (FROM-clause manquant)")
    
    if any(e['type'] == 'prepared_statement' for e in analysis['critical_errors']):
        problems.append("⚠️  Tentatives d'exécuter plusieurs commandes dans une prepared statement")
    
    if not problems:
        problems.append("✅ Aucun problème majeur détecté")
    
    for problem in problems:
        report.append(f"  {problem}")
    
    report.append("")
    report.append("=" * 80)
    
    return "\n".join(report)

if __name__ == "__main__":
    import sys
    
    csv_file = "log-events-viewer-result (31).csv"
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    
    print("Analyse en cours...")
    analysis = analyze_logs(csv_file)
    report = generate_report(analysis)
    
    # Sauvegarder le rapport
    output_file = "ANALYSE_LOGS_RESULTAT.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    # Afficher le rapport (sans emojis pour éviter les problèmes d'encodage)
    report_console = report.replace('📊', '[RESUME]').replace('🔴', '[ERREURS]').replace('📝', '[MIGRATIONS]').replace('💾', '[DB]').replace('🔍', '[PROBLEMES]').replace('✅', '[OK]').replace('⚠️', '[WARNING]').replace('❌', '[ERROR]')
    print(report_console)
    
    print(f"\n[OK] Rapport sauvegardé dans: {output_file}")

