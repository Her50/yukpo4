#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script pour lister les utilisateurs dans la base de données"""
import os
import sys
import psycopg2
from urllib.parse import urlparse, unquote

# Configurer l'encodage pour Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Récupérer DATABASE_URL depuis les secrets GCP
# Pour Cloud SQL, utiliser le format Unix socket
database_url = os.getenv('DATABASE_URL', '')

if not database_url:
    print("ERREUR: DATABASE_URL non defini")
    sys.exit(1)

# Parser l'URL
parsed = urlparse(database_url)

# Extraire les informations
user = unquote(parsed.username) if parsed.username else 'yukpo_user'
password = unquote(parsed.password) if parsed.password else ''
database = parsed.path.lstrip('/') if parsed.path else 'yukpo_db'

# Pour Cloud SQL Unix socket
if '/cloudsql/' in database_url:
    # Extraire le socket path depuis ?host=/cloudsql/...
    socket_path = None
    if 'host=' in database_url:
        parts = database_url.split('host=')
        if len(parts) > 1:
            socket_path = parts[1].split('&')[0].split('?')[0]
    
    if socket_path:
        print(f"Connexion via socket Unix: {socket_path}")
        conn = psycopg2.connect(
            user=user,
            password=password,
            database=database,
            host=socket_path
        )
    else:
        print("ERREUR: Socket path non trouve dans DATABASE_URL")
        sys.exit(1)
else:
    # Connexion TCP/IP standard
    host = parsed.hostname
    port = parsed.port or 5432
    print(f"Connexion TCP/IP: {host}:{port}")
    conn = psycopg2.connect(
            user=user,
            password=password,
            database=database,
            host=host,
            port=port
        )

try:
    cursor = conn.cursor()
    
    # Compter les utilisateurs
    cursor.execute("SELECT COUNT(*) FROM users;")
    total = cursor.fetchone()[0]
    print(f"\nTotal d'utilisateurs: {total}\n")
    
    # Lister les utilisateurs
    cursor.execute("""
        SELECT id, email, role, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 10;
    """)
    
    print("Liste des utilisateurs (10 derniers):")
    print("-" * 80)
    print(f"{'ID':<10} {'Email':<40} {'Role':<15} {'Cree le'}")
    print("-" * 80)
    
    for row in cursor.fetchall():
        user_id, email, role, created_at = row
        role_str = role if role else 'N/A'
        print(f"{user_id:<10} {email:<40} {role_str:<15} {created_at}")
    
    print("-" * 80)
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"ERREUR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

