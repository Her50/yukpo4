#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse des logs CSV Cloud Run"""
import csv
import sys
import io
from collections import Counter
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

log_file = sys.argv[1] if len(sys.argv) > 1 else "downloaded-logs-20260217-111228.csv"

print("=" * 80)
print(f"📊 ANALYSE DES LOGS CSV - {log_file}")
print("=" * 80)

logs = []
with open(log_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    logs = list(reader)

print(f"\n📈 STATISTIQUES GÉNÉRALES")
print("-" * 80)
print(f"Total d'entrées: {len(logs)}")
if logs:
    print(f"Colonnes disponibles: {', '.join(logs[0].keys())}")

# Analyser par type de log
severities = Counter()
text_payloads = []
errors = []
rust_logs = []
wrapper_logs = []
database_errors = []
http_errors = []

for log in logs:
    # Severity
    severity = log.get('severity', log.get('Severity', 'N/A'))
    severities[severity] += 1
    
    # Text payload
    text = log.get('textPayload', log.get('TextPayload', ''))
    if text:
        text_payloads.append((log.get('timestamp', log.get('Timestamp', 'N/A')), severity, text))
    
    # Erreurs
    if severity in ['ERROR', 'error', 'Error'] or 'error' in text.lower():
        errors.append((log.get('timestamp', log.get('Timestamp', 'N/A')), severity, text))
    
    # Logs Rust
    if 'Rust' in text or '[MAIN]' in text or 'Application Rust' in text:
        rust_logs.append((log.get('timestamp', log.get('Timestamp', 'N/A')), severity, text))
    
    # Logs wrapper
    if '[WRAPPER]' in text:
        wrapper_logs.append((log.get('timestamp', log.get('Timestamp', 'N/A')), severity, text))
    
    # Erreurs base de données
    if any(kw in text.lower() for kw in ['database', 'postgres', 'sql', 'connection', 'empty host', 'configuration', 'cloud sql']):
        database_errors.append((log.get('timestamp', log.get('Timestamp', 'N/A')), severity, text))
    
    # Erreurs HTTP
    status = log.get('httpRequest.status', log.get('Status', ''))
    if status and status.isdigit() and int(status) >= 500:
        http_errors.append((log.get('timestamp', log.get('Timestamp', 'N/A')), status, log.get('httpRequest.requestUrl', log.get('RequestUrl', 'N/A'))))

print(f"\n📊 NIVEAUX DE SÉVÉRITÉ:")
for sev, count in severities.most_common():
    print(f"  {sev}: {count}")

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
    print("L'application Rust ne produit aucun log, ce qui suggère qu'elle ne démarre pas ou crash immédiatement.")

# Erreurs
if errors:
    print(f"\n❌ ERREURS TROUVÉES ({len(errors)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(errors[:30], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Erreurs base de données
if database_errors:
    print(f"\n🗄️ ERREURS BASE DE DONNÉES ({len(database_errors)}):")
    print("-" * 80)
    for i, (ts, sev, txt) in enumerate(database_errors[:20], 1):
        print(f"\n[{i}] {ts} - {sev}")
        print(f"    {txt[:500]}")

# Erreurs HTTP
if http_errors:
    print(f"\n🌐 ERREURS HTTP 5xx ({len(http_errors)}):")
    print("-" * 80)
    for i, (ts, status, url) in enumerate(http_errors[:15], 1):
        print(f"[{i}] {ts} - Status {status} - {url}")

# Dernières entrées
print(f"\n📋 DERNIÈRES 20 ENTRÉES:")
print("-" * 80)
for i, log in enumerate(logs[-20:], 1):
    timestamp = log.get('timestamp', log.get('Timestamp', 'N/A'))
    severity = log.get('severity', log.get('Severity', 'N/A'))
    text = log.get('textPayload', log.get('TextPayload', ''))
    
    print(f"\n[{i}] {timestamp} - {severity}")
    if text:
        print(f"    {text[:300]}")

# Analyse chronologique
print(f"\n⏱️ ANALYSE CHRONOLOGIQUE:")
print("-" * 80)
if logs:
    first = logs[0].get('timestamp', logs[0].get('Timestamp', 'N/A'))
    last = logs[-1].get('timestamp', logs[-1].get('Timestamp', 'N/A'))
    print(f"Premier log: {first}")
    print(f"Dernier log: {last}")
    
    # Chercher le démarrage de Rust
    rust_start_time = None
    for log in logs:
        text = log.get('textPayload', log.get('TextPayload', ''))
        if 'Démarrage application Rust' in text:
            rust_start_time = log.get('timestamp', log.get('Timestamp', 'N/A'))
            break
    
    if rust_start_time:
        print(f"Rust démarre à: {rust_start_time}")
        
        # Chercher les logs après le démarrage de Rust
        logs_after_rust = [log for log in logs if log.get('timestamp', log.get('Timestamp', '')) >= rust_start_time]
        rust_logs_after = [log for log in logs_after_rust if '[MAIN]' in log.get('textPayload', log.get('TextPayload', ''))]
        
        print(f"Logs après démarrage Rust: {len(logs_after_rust)}")
        print(f"Logs [MAIN] après démarrage: {len(rust_logs_after)}")
        
        if len(rust_logs_after) == 0:
            print("\n⚠️ PROBLÈME CRITIQUE: Rust démarre mais ne produit AUCUN log [MAIN]!")
            print("Cela signifie que l'application crash avant d'atteindre le premier eprintln! dans main()")
    else:
        print("⚠️ Rust ne semble pas démarrer du tout")

print("\n" + "=" * 80)


