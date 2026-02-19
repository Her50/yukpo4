#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse spécifique des logs du wrapper"""
import json
import sys
import io
from datetime import datetime

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = "downloaded-logs-cloud-run-00186.json"

with open(log_file, 'r', encoding='utf-8') as f:
    logs = json.load(f)

print("=" * 80)
print(f"📊 ANALYSE DES LOGS WRAPPER - {len(logs)} entrées")
print("=" * 80)

# Filtrer les logs Cloud Run et les trier par timestamp
cloud_run_logs = []
for log in logs:
    resource = log.get('resource', {})
    if resource.get('type') == 'cloud_run_revision':
        timestamp = log.get('timestamp', '')
        text = log.get('textPayload', '')
        if not text and 'jsonPayload' in log:
            json_payload = log.get('jsonPayload', {})
            if isinstance(json_payload, dict):
                text = json_payload.get('message', '')
        cloud_run_logs.append({
            'timestamp': timestamp,
            'text': text,
            'severity': log.get('severity', 'INFO'),
            'logName': log.get('logName', '')
        })

# Trier par timestamp
cloud_run_logs.sort(key=lambda x: x['timestamp'])

print(f"\n📦 Logs Cloud Run trouvés: {len(cloud_run_logs)}")

# Afficher tous les logs dans l'ordre chronologique
print("\n" + "=" * 80)
print("📝 SÉQUENCE COMPLÈTE DES LOGS (ordre chronologique)")
print("=" * 80)

for i, log in enumerate(cloud_run_logs, 1):
    timestamp = log['timestamp']
    text = log['text']
    severity = log['severity']
    log_name = log['logName']
    
    # Afficher seulement les logs stdout/stderr (pas les logs système)
    if 'stdout' in log_name or 'stderr' in log_name:
        print(f"\n[{i}] {timestamp} [{severity}]")
        print(f"    {text[:300]}")

# Chercher spécifiquement les logs du wrapper
wrapper_keywords = ['WRAPPER', 'Étape', 'Vérification', 'Binaire', 'Port libéré', 'exec', 'Rust']
rust_keywords = ['[MAIN]', 'Application Rust', 'Rust démarre']

wrapper_logs = [log for log in cloud_run_logs if any(kw in log['text'] for kw in wrapper_keywords)]
rust_logs = [log for log in cloud_run_logs if any(kw in log['text'] for kw in rust_keywords)]

print("\n" + "=" * 80)
print(f"🔧 LOGS WRAPPER: {len(wrapper_logs)}")
print("=" * 80)
for log in wrapper_logs:
    print(f"\n[{log['timestamp']}] {log['text'][:200]}")

print("\n" + "=" * 80)
print(f"🚀 LOGS RUST [MAIN]: {len(rust_logs)}")
print("=" * 80)
for log in rust_logs:
    print(f"\n[{log['timestamp']}] {log['text'][:300]}")

# Chercher les erreurs
errors = [log for log in cloud_run_logs if 'ERREUR' in log['text'] or 'ERROR' in log['text'] or log['severity'] in ['ERROR', 'CRITICAL']]
if errors:
    print("\n" + "=" * 80)
    print(f"❌ ERREURS TROUVÉES: {len(errors)}")
    print("=" * 80)
    for log in errors:
        print(f"\n[{log['timestamp']}] [{log['severity']}] {log['text'][:300]}")

print("\n" + "=" * 80)


