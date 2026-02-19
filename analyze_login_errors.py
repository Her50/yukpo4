#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse les erreurs de login"""
import json
import sys
import io
from datetime import datetime

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = "downloaded-logs-login-attempts.json"

try:
    with open(log_file, 'r', encoding='utf-8') as f:
        logs = json.load(f)
except FileNotFoundError:
    print(f"⚠️ Fichier {log_file} non trouvé")
    sys.exit(1)

print("=" * 80)
print(f"📊 ANALYSE DES TENTATIVES DE CONNEXION - {len(logs)} entrées")
print("=" * 80)

# Filtrer les logs Cloud Run
cloud_run_logs = []
for log in logs:
    resource = log.get('resource', {})
    if resource.get('type') == 'cloud_run_revision':
        cloud_run_logs.append(log)

print(f"\n📦 Logs Cloud Run: {len(cloud_run_logs)}")

# Chercher les requêtes de login
login_requests = []
for log in cloud_run_logs:
    http_request = log.get('httpRequest', {})
    if http_request and 'login' in http_request.get('requestUrl', '').lower():
        login_requests.append(log)

print(f"\n🔐 Tentatives de login: {len(login_requests)}")

if login_requests:
    print("\n" + "=" * 80)
    print("📝 TENTATIVES DE LOGIN (ordre chronologique)")
    print("=" * 80)
    for i, log in enumerate(login_requests, 1):
        timestamp = log.get('timestamp', 'N/A')
        http_request = log.get('httpRequest', {})
        status = http_request.get('status', 'N/A')
        url = http_request.get('requestUrl', 'N/A')
        latency = http_request.get('latency', 'N/A')
        severity = log.get('severity', 'INFO')
        
        print(f"\n[{i}] {timestamp} [{severity}]")
        print(f"    URL: {url}")
        print(f"    Status: {status}")
        print(f"    Latency: {latency}")
        
        if status == '500':
            print(f"    ❌ ERREUR 500 - Échec du login")

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
    print("Dernières erreurs (10):")
    for log in postgres_errors[-10:]:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        print(f"\n[{timestamp}] {text[:200]}")

# Chercher les logs stdout/stderr du wrapper et Rust
wrapper_logs = []
rust_logs = []
for log in cloud_run_logs:
    log_name = log.get('logName', '')
    if 'stdout' in log_name or 'stderr' in log_name:
        text = log.get('textPayload', '')
        if 'WRAPPER' in text or 'wrapper' in text.lower():
            wrapper_logs.append(log)
        elif '[MAIN]' in text or 'Application Rust' in text:
            rust_logs.append(log)

if wrapper_logs:
    print("\n" + "=" * 80)
    print(f"🔧 LOGS WRAPPER: {len(wrapper_logs)}")
    print("=" * 80)
    for log in wrapper_logs[-30:]:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        print(f"\n[{timestamp}] {text[:200]}")

if rust_logs:
    print("\n" + "=" * 80)
    print(f"🚀 LOGS RUST [MAIN]: {len(rust_logs)}")
    print("=" * 80)
    for log in rust_logs:
        timestamp = log.get('timestamp', 'N/A')
        text = log.get('textPayload', '')
        print(f"\n[{timestamp}] {text[:300]}")

print("\n" + "=" * 80)


