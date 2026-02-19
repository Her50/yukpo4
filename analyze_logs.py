#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyse les logs Cloud Run"""
import json
import sys
import io
from collections import Counter
from datetime import datetime

# Configurer l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import sys
log_file = "downloaded-logs-20260217-103758.json" if len(sys.argv) < 2 else sys.argv[1]

with open(log_file, 'r', encoding='utf-8') as f:
    logs = json.load(f)

print("=" * 60)
print(f"📊 ANALYSE DES LOGS - {len(logs)} entrées")
print("=" * 60)

# Statistiques générales
status_codes = Counter()
severities = Counter()
methods = Counter()
urls = Counter()
errors = []

for entry in logs:
    # Status codes
    if 'httpRequest' in entry:
        status = entry['httpRequest'].get('status', 'N/A')
        status_codes[status] += 1
        methods[entry['httpRequest'].get('requestMethod', 'N/A')] += 1
        urls[entry['httpRequest'].get('requestUrl', 'N/A')] += 1
    
    # Severities
    severity = entry.get('severity', 'N/A')
    severities[severity] += 1
    
    # Erreurs
    if severity in ['ERROR', 'CRITICAL']:
        text = entry.get('textPayload', '')
        json_payload = entry.get('jsonPayload', {})
        message = json_payload.get('message', '') if isinstance(json_payload, dict) else ''
        errors.append({
            'timestamp': entry.get('timestamp', 'N/A'),
            'severity': severity,
            'message': text or message or str(json_payload)[:200]
        })

print("\n📈 STATISTIQUES GÉNÉRALES")
print("-" * 60)
print(f"Total d'entrées: {len(logs)}")
print(f"\nNiveaux de sévérité:")
for sev, count in severities.most_common():
    print(f"  {sev}: {count}")

print(f"\nCodes de statut HTTP:")
for status, count in status_codes.most_common(10):
    print(f"  {status}: {count}")

print(f"\nMéthodes HTTP:")
for method, count in methods.most_common():
    print(f"  {method}: {count}")

print(f"\nURLs les plus fréquentes:")
for url, count in urls.most_common(10):
    print(f"  {url}: {count}")

# Erreurs
if errors:
    print(f"\n❌ ERREURS TROUVÉES ({len(errors)}):")
    print("-" * 60)
    for i, error in enumerate(errors[:20], 1):
        print(f"\n[{i}] {error['timestamp']} - {error['severity']}")
        print(f"    {error['message'][:300]}")

# Recherche d'erreurs spécifiques
print("\n🔍 RECHERCHE D'ERREURS SPÉCIFIQUES")
print("-" * 60)
keywords = ['error', 'Error', 'ERROR', 'failed', 'Failed', 'FAILED', 'exception', 'Exception', 'EXCEPTION', 'database', 'Database', 'DATABASE', 'connection', 'Connection', 'CONNECTION']

found_errors = []
for entry in logs:
    text = entry.get('textPayload', '')
    json_payload = entry.get('jsonPayload', {})
    message = ''
    if isinstance(json_payload, dict):
        message = json_payload.get('message', '') or json_payload.get('error', '') or str(json_payload)
    
    full_text = (text + ' ' + message).lower()
    for keyword in keywords:
        if keyword.lower() in full_text:
            found_errors.append({
                'timestamp': entry.get('timestamp', 'N/A'),
                'severity': entry.get('severity', 'N/A'),
                'text': text[:200] if text else message[:200]
            })
            break

if found_errors:
    print(f"Trouvé {len(found_errors)} entrées avec mots-clés d'erreur:")
    for i, err in enumerate(found_errors[:15], 1):
        print(f"\n[{i}] {err['timestamp']} - {err['severity']}")
        print(f"    {err['text']}")
else:
    print("Aucune erreur spécifique trouvée avec les mots-clés recherchés.")

# Dernières entrées
print("\n📝 DERNIÈRES 10 ENTRÉES")
print("-" * 60)
for i, entry in enumerate(logs[-10:], 1):
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
        print(f"    {text[:200]}")

print("\n" + "=" * 60)

