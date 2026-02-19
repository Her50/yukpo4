#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse les derniers logs"""
import json
import sys
import io

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = "downloaded-logs-20260217-203216.json"

with open(log_file, 'r', encoding='utf-8') as f:
    logs = json.load(f)

print("=" * 80)
print(f"📊 ANALYSE DES LOGS - {len(logs)} entrées")
print("=" * 80)

# Filtrer les logs Cloud Run
cloud_run_logs = []
for log in logs:
    resource = log.get('resource', {})
    if resource.get('type') == 'cloud_run_revision':
        log_name = log.get('logName', '')
        # Chercher seulement stdout/stderr, pas requests
        if 'stdout' in log_name or 'stderr' in log_name:
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
                'logName': log_name
            })

# Trier par timestamp
cloud_run_logs.sort(key=lambda x: x['timestamp'])

print(f"\n📦 Logs Cloud Run (stdout/stderr): {len(cloud_run_logs)}")

if cloud_run_logs:
    print("\n" + "=" * 80)
    print("📝 LOGS CLOUD RUN (ordre chronologique)")
    print("=" * 80)
    for i, log in enumerate(cloud_run_logs, 1):
        timestamp = log['timestamp']
        text = log['text']
        severity = log['severity']
        print(f"\n[{i}] {timestamp} [{severity}]")
        if text:
            print(f"    {text[:300]}")
else:
    print("\n⚠️ Aucun log Cloud Run (stdout/stderr) trouvé dans ce fichier")
    print("   Le fichier contient probablement seulement des logs PostgreSQL")

# Chercher les erreurs d'authentification PostgreSQL
postgres_errors = []
for log in logs:
    text = log.get('textPayload', '')
    if 'password authentication failed' in text.lower():
        postgres_errors.append(log)

if postgres_errors:
    print("\n" + "=" * 80)
    print(f"⚠️ ERREURS POSTGRESQL: {len(postgres_errors)}")
    print("=" * 80)
    print(f"Dernières erreurs (5):")
    for log in postgres_errors[-5:]:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        print(f"\n[{timestamp}] {text[:200]}")

print("\n" + "=" * 80)


