#!/usr/bin/env python3
"""Applique la migration persona/white-label sur GCP PostgreSQL"""
import psycopg2
import re

DATABASE_URL = "postgresql://yukpo_user:qtAa7DjLBhZWHeUTmxwv@34.79.199.41:5432/yukpo_db"
MIGRATION_FILE = r"C:\Users\23767\yukpomnang2\backend\migrations\20260404_001_add_persona_whitelabel_to_chatbot.sql"

def split_sql(sql):
    """Split SQL en statements individuels, en respectant les blocs DO $$ ... $$"""
    statements = []
    current = []
    in_dollar_block = False

    for line in sql.splitlines():
        stripped = line.strip()
        # Ignorer les commentaires purs
        if stripped.startswith('--'):
            continue
        current.append(line)
        # Détecter les blocs DO $$ ... $$
        dollar_count = line.count('$$')
        if dollar_count % 2 != 0:
            in_dollar_block = not in_dollar_block
        # Un statement se termine par ';' hors d'un bloc dollar
        if not in_dollar_block and stripped.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []

    # Reste éventuel
    if current:
        stmt = '\n'.join(current).strip()
        if stmt and stmt != '--':
            statements.append(stmt)

    return statements

def main():
    with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
        sql = f.read()

    statements = split_sql(sql)
    print(f"🔍 {len(statements)} statement(s) trouvés")

    conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
    conn.autocommit = True
    cur = conn.cursor()
    print("✅ Connecté à GCP PostgreSQL")

    for i, stmt in enumerate(statements, 1):
        if not stmt.strip() or stmt.strip().startswith('--'):
            continue
        try:
            cur.execute(stmt)
            # Résumé court du statement
            first_line = stmt.strip().splitlines()[0][:80]
            print(f"  ✅ [{i}] {first_line}")
        except Exception as e:
            first_line = stmt.strip().splitlines()[0][:80]
            print(f"  ⚠️  [{i}] {first_line}")
            print(f"       → {e}")

    conn.close()
    print("\n🎉 Migration terminée.")

if __name__ == '__main__':
    main()
