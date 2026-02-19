#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse les nouveaux logs Cloud Run"""
import json
import sys
import io

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = "downloaded-logs-20260217-193847.json"

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
        cloud_run_logs.append(log)

print(f"\n📦 Logs Cloud Run: {len(cloud_run_logs)}")

# Chercher les logs du wrapper et de Rust
wrapper_logs = []
rust_logs = []
other_logs = []

for log in cloud_run_logs:
    text = log.get('textPayload', '')
    if not text and 'jsonPayload' in log:
        json_payload = log.get('jsonPayload', {})
        if isinstance(json_payload, dict):
            text = json_payload.get('message', '')
        else:
            text = str(json_payload)
    
    if 'WRAPPER' in text or 'wrapper' in text.lower():
        wrapper_logs.append(log)
    elif '[MAIN]' in text or 'Application Rust' in text:
        rust_logs.append(log)
    else:
        other_logs.append(log)

print(f"🔧 Logs WRAPPER: {len(wrapper_logs)}")
print(f"🚀 Logs Rust [MAIN]: {len(rust_logs)}")
print(f"📝 Autres logs Cloud Run: {len(other_logs)}")

# Afficher les logs du wrapper
if wrapper_logs:
    print("\n" + "=" * 80)
    print("🔧 LOGS DU WRAPPER (derniers 50)")
    print("=" * 80)
    for log in wrapper_logs[-50:]:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        if not text and 'jsonPayload' in log:
            json_payload = log.get('jsonPayload', {})
            if isinstance(json_payload, dict):
                text = json_payload.get('message', '')
        print(f"\n[{timestamp}] {text[:200]}")

# Afficher les logs Rust
if rust_logs:
    print("\n" + "=" * 80)
    print("🚀 LOGS RUST [MAIN]")
    print("=" * 80)
    for log in rust_logs:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        if not text and 'jsonPayload' in log:
            json_payload = log.get('jsonPayload', {})
            if isinstance(json_payload, dict):
                text = json_payload.get('message', '')
        print(f"\n[{timestamp}] {text[:300]}")

# Afficher les derniers logs Cloud Run (pour voir la séquence)
print("\n" + "=" * 80)
print("📝 DERNIERS LOGS CLOUD RUN (pour voir la séquence)")
print("=" * 80)
for log in cloud_run_logs[-30:]:
    timestamp = log.get('timestamp', 'N/A')
    severity = log.get('severity', 'INFO')
    text = log.get('textPayload', '')
    if not text and 'jsonPayload' in log:
        json_payload = log.get('jsonPayload', {})
        if isinstance(json_payload, dict):
            text = json_payload.get('message', '')
    log_name = log.get('logName', '')
    if 'stdout' in log_name or 'stderr' in log_name:
        print(f"\n[{timestamp}] [{severity}] {text[:200]}")

# Chercher les erreurs d'authentification PostgreSQL
postgres_errors = []
for log in logs:
    text = log.get('textPayload', '')
    if 'password authentication failed' in text.lower() or 'FATAL' in text:
        postgres_errors.append(log)

if postgres_errors:
    print("\n" + "=" * 80)
    print(f"⚠️ ERREURS POSTGRESQL: {len(postgres_errors)}")
    print("=" * 80)
    for log in postgres_errors[-10:]:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        print(f"\n[{timestamp}] {text[:200]}")

print("\n" + "=" * 80)


