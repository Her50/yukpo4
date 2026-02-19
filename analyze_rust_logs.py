#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse spécifique des logs Rust et erreurs de connexion"""
import json
import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = sys.argv[1] if len(sys.argv) > 1 else "downloaded-logs-20260217-103758.json"

with open(log_file, 'r', encoding='utf-8') as f:
    logs = json.load(f)

print("=" * 60)
print(f"🔍 ANALYSE DÉTAILLÉE DES LOGS RUST")
print("=" * 60)

# Chercher les logs après le démarrage de Rust
rust_started = False
rust_logs = []
errors = []
database_errors = []
http_errors = []

for entry in logs:
    text = entry.get('textPayload', '')
    json_payload = entry.get('jsonPayload', {})
    severity = entry.get('severity', 'N/A')
    timestamp = entry.get('timestamp', 'N/A')
    
    # Détecter le démarrage de Rust
    if 'Démarrage application Rust' in text or 'Démarrage de Rust' in text:
        rust_started = True
        print(f"\n✅ Rust démarre à: {timestamp}")
    
    # Collecter les logs après le démarrage de Rust
    if rust_started:
        if text:
            rust_logs.append((timestamp, severity, text))
        
        # Erreurs
        if severity == 'ERROR' or 'error' in text.lower() or 'ERROR' in text:
            errors.append((timestamp, severity, text))
        
        # Erreurs de base de données
        if any(keyword in text.lower() for keyword in ['database', 'postgres', 'sql', 'connection', 'empty host', 'configuration']):
            database_errors.append((timestamp, severity, text))
    
    # Erreurs HTTP
    if 'httpRequest' in entry:
        status = entry['httpRequest'].get('status', 0)
        if status >= 500:
            http_errors.append((timestamp, status, entry['httpRequest'].get('requestUrl', 'N/A')))

print(f"\n📊 STATISTIQUES")
print("-" * 60)
print(f"Total logs après démarrage Rust: {len(rust_logs)}")
print(f"Erreurs trouvées: {len(errors)}")
print(f"Erreurs base de données: {len(database_errors)}")
print(f"Erreurs HTTP 5xx: {len(http_errors)}")

# Afficher les logs Rust
if rust_logs:
    print(f"\n📝 LOGS RUST (premiers 30):")
    print("-" * 60)
    for i, (ts, sev, txt) in enumerate(rust_logs[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:400]}")

# Afficher les erreurs
if errors:
    print(f"\n❌ ERREURS TROUVÉES ({len(errors)}):")
    print("-" * 60)
    for i, (ts, sev, txt) in enumerate(errors[:20], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Afficher les erreurs de base de données
if database_errors:
    print(f"\n🗄️ ERREURS BASE DE DONNÉES ({len(database_errors)}):")
    print("-" * 60)
    for i, (ts, sev, txt) in enumerate(database_errors, 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Afficher les erreurs HTTP
if http_errors:
    print(f"\n🌐 ERREURS HTTP 5xx ({len(http_errors)}):")
    print("-" * 60)
    for i, (ts, status, url) in enumerate(http_errors[:10], 1):
        print(f"[{i}] {ts} - Status {status} - {url}")

# Vérifier si Rust a démarré
if not rust_started:
    print("\n⚠️ ATTENTION: Aucun log de démarrage Rust trouvé!")
    print("L'application Rust ne semble pas démarrer.")

# Chercher les dernières entrées
print(f"\n📋 DERNIÈRES 15 ENTRÉES:")
print("-" * 60)
for i, entry in enumerate(logs[-15:], 1):
    timestamp = entry.get('timestamp', 'N/A')
    severity = entry.get('severity', 'N/A')
    text = entry.get('textPayload', '')
    if not text and 'jsonPayload' in entry:
        json_payload = entry['jsonPayload']
        if isinstance(json_payload, dict):
            text = json_payload.get('message', str(json_payload)[:100])
        else:
            text = str(json_payload)[:100]
    
    print(f"\n[{i}] {timestamp} - {severity}")
    if text:
        print(f"    {text[:300]}")

print("\n" + "=" * 60)


