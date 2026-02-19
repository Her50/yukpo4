#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse des logs de connexion Cloud Run"""
import json
import sys
import io
from collections import Counter
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = sys.argv[1] if len(sys.argv) > 1 else "downloaded-logs-20260217-114954.json"

print("=" * 80)
print(f"📊 ANALYSE DES LOGS DE CONNEXION - {log_file}")
print("=" * 80)

with open(log_file, 'r', encoding='utf-8') as f:
    logs = json.load(f)

print(f"\n📈 STATISTIQUES GÉNÉRALES")
print("-" * 80)
print(f"Total d'entrées: {len(logs)}")

# Analyser par type de log
severities = Counter()
errors = []
rust_logs = []
wrapper_logs = []
database_errors = []
connection_attempts = []
auth_logs = []
http_requests = []
startup_logs = []

for entry in logs:
    # Severity
    severity = entry.get('severity', 'N/A')
    severities[severity] += 1
    
    # Text payload
    text = entry.get('textPayload', '')
    json_payload = entry.get('jsonPayload', {})
    
    # Combiner text et json pour analyse
    full_text = text
    if json_payload:
        full_text += " " + str(json_payload)
    
    # Erreurs
    if severity in ['ERROR', 'error', 'Error'] or 'error' in full_text.lower():
        errors.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Logs Rust
    if '[MAIN]' in full_text or 'Application Rust' in full_text or 'yukpomnang_backend' in full_text:
        rust_logs.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Logs wrapper
    if '[WRAPPER]' in full_text:
        wrapper_logs.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Erreurs base de données
    if any(kw in full_text.lower() for kw in ['database', 'postgres', 'sql', 'connection', 'empty host', 'configuration']):
        database_errors.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Tentatives de connexion
    if any(kw in full_text.lower() for kw in ['login', 'auth', 'connect', 'connexion', '/api/auth', 'POST /api']):
        connection_attempts.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Logs d'authentification
    if any(kw in full_text.lower() for kw in ['jwt', 'token', 'password', 'email', 'user', 'utilisateur']):
        auth_logs.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))
    
    # Requêtes HTTP
    http_req = entry.get('httpRequest', {})
    if http_req:
        method = http_req.get('requestMethod', '')
        url = http_req.get('requestUrl', '')
        status = http_req.get('status', '')
        http_requests.append((entry.get('timestamp', 'N/A'), method, url, status))
    
    # Logs de démarrage
    if any(kw in full_text.lower() for kw in ['startup', 'démarrage', 'starting', 'application rust démarre']):
        startup_logs.append((entry.get('timestamp', 'N/A'), severity, full_text[:500]))

print(f"\n📊 NIVEAUX DE SÉVÉRITÉ:")
for sev, count in severities.most_common():
    print(f"  {sev}: {count}")

# Logs de démarrage
if startup_logs:
    print(f"\n🚀 LOGS DE DÉMARRAGE ({len(startup_logs)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(startup_logs[:20], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt}")

# Logs wrapper
if wrapper_logs:
    print(f"\n🔧 LOGS WRAPPER ({len(wrapper_logs)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(wrapper_logs[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:400]}")

# Logs Rust
if rust_logs:
    print(f"\n🦀 LOGS RUST ({len(rust_logs)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(rust_logs[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:400]}")
else:
    print(f"\n⚠️ AUCUN LOG RUST TROUVÉ!")

# Erreurs base de données
if database_errors:
    print(f"\n🗄️ ERREURS BASE DE DONNÉES ({len(database_errors)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(database_errors[:20], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Tentatives de connexion
if connection_attempts:
    print(f"\n🔐 TENTATIVES DE CONNEXION ({len(connection_attempts)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(connection_attempts, 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Logs d'authentification
if auth_logs:
    print(f"\n🔑 LOGS D'AUTHENTIFICATION ({len(auth_logs)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(auth_logs[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Requêtes HTTP
if http_requests:
    print(f"\n🌐 REQUÊTES HTTP ({len(http_requests)}):")
    print("-" * 80)
    # Grouper par URL
    url_counts = Counter()
    for ts, method, url, status in http_requests:
        url_counts[f"{method} {url}"] += 1
    
    print("\nTop 20 requêtes HTTP:")
    for url, count in url_counts.most_common(20):
        print(f"  {url}: {count} fois")
    
    print("\nDernières 20 requêtes HTTP:")
    for i, (ts, method, url, status) in enumerate(http_requests[-20:], 1):
        print(f"[{i}] {ts} - {method} {url} - Status: {status}")

# Erreurs
if errors:
    print(f"\n❌ ERREURS TROUVÉES ({len(errors)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(errors[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Analyse chronologique
print(f"\n⏱️ ANALYSE CHRONOLOGIQUE:")
print("-" * 80)
if logs:
    first = logs[0].get('timestamp', 'N/A')
    last = logs[-1].get('timestamp', 'N/A')
    print(f"Premier log: {first}")
    print(f"Dernier log: {last}")
    
    # Chercher le démarrage de Rust
    rust_start_time = None
    for entry in logs:
        text = entry.get('textPayload', '')
        if '[MAIN] 🚀 Application Rust démarre' in text:
            rust_start_time = entry.get('timestamp', 'N/A')
            break
    
    if rust_start_time:
        print(f"Rust démarre à: {rust_start_time}")
        
        # Chercher les logs après le démarrage de Rust
        logs_after_rust = [log for log in logs if log.get('timestamp', '') >= rust_start_time]
        rust_logs_after = [log for log in logs_after_rust if '[MAIN]' in log.get('textPayload', '')]
        
        print(f"Logs après démarrage Rust: {len(logs_after_rust)}")
        print(f"Logs [MAIN] après démarrage: {len(rust_logs_after)}")
        
        if len(rust_logs_after) == 0:
            print("\n⚠️ PROBLÈME CRITIQUE: Rust démarre mais ne produit AUCUN log [MAIN]!")
    else:
        print("⚠️ Rust ne semble pas démarrer du tout")

print("\n" + "=" * 80)


