#!/usr/bin/env python3
"""Create YukpoIA tables directly in production GCP Cloud SQL."""
import psycopg2

conn = psycopg2.connect(
    host='34.79.199.41',
    database='yukpo_db',
    user='yukpo_user',
    password='qtAa7DjLBhZWHeUTmxwv',
    connect_timeout=10
)
conn.autocommit = True
cur = conn.cursor()

def table_exists(name):
    cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = %s)", (name,))
    return cur.fetchone()[0]

# 1. yukpo_ia_daily_usage
if not table_exists('yukpo_ia_daily_usage'):
    print('Creating yukpo_ia_daily_usage...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS yukpo_ia_daily_usage (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            usage_date DATE NOT NULL,
            free_token_units_consumed BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, usage_date)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_daily_usage_date ON yukpo_ia_daily_usage(usage_date)")
    print('  -> CREATED')
else:
    print('yukpo_ia_daily_usage: already exists')

# 2. yukpo_ia_sessions
if not table_exists('yukpo_ia_sessions'):
    print('Creating yukpo_ia_sessions...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS yukpo_ia_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200),
            context_screen VARCHAR(100),
            context_type VARCHAR(50),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            summary TEXT,
            message_count INTEGER NOT NULL DEFAULT 0,
            total_tokens_used BIGINT NOT NULL DEFAULT 0,
            is_archived BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_sessions_user ON yukpo_ia_sessions(user_id, last_message_at DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_sessions_active ON yukpo_ia_sessions(user_id, is_archived, last_message_at DESC)")
    print('  -> CREATED')
else:
    print('yukpo_ia_sessions: already exists')

# 3. yukpo_ia_messages
if not table_exists('yukpo_ia_messages'):
    print('Creating yukpo_ia_messages...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS yukpo_ia_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES yukpo_ia_sessions(id) ON DELETE CASCADE,
            role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
            tokens_used INTEGER,
            model_used VARCHAR(50),
            billing JSONB,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_messages_session ON yukpo_ia_messages(session_id, created_at ASC)")
    print('  -> CREATED')
else:
    print('yukpo_ia_messages: already exists')

# 4. yukpo_ia_user_memory
if not table_exists('yukpo_ia_user_memory'):
    print('Creating yukpo_ia_user_memory...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS yukpo_ia_user_memory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            memory_key VARCHAR(100) NOT NULL,
            memory_value TEXT NOT NULL,
            source_session_id UUID REFERENCES yukpo_ia_sessions(id) ON DELETE SET NULL,
            confidence REAL NOT NULL DEFAULT 0.8,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, memory_key)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_user_memory_user ON yukpo_ia_user_memory(user_id, updated_at DESC)")
    print('  -> CREATED')
else:
    print('yukpo_ia_user_memory: already exists')

# 5. yukpo_ia_gdpr_audit
if not table_exists('yukpo_ia_gdpr_audit'):
    print('Creating yukpo_ia_gdpr_audit...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS yukpo_ia_gdpr_audit (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(32) NOT NULL CHECK (action IN ('export', 'delete')),
            client_ip VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_yukpo_ia_gdpr_audit_user ON yukpo_ia_gdpr_audit(user_id, created_at DESC)")
    print('  -> CREATED')
else:
    print('yukpo_ia_gdpr_audit: already exists')

# 6. users columns
try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS yukpo_ia_long_term_memory_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    print('Column yukpo_ia_long_term_memory_enabled: OK')
except Exception as e:
    print(f'Column yukpo_ia_long_term_memory_enabled: {e}')

try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS yukpo_ia_long_term_memory_consent_at TIMESTAMPTZ")
    print('Column yukpo_ia_long_term_memory_consent_at: OK')
except Exception as e:
    print(f'Column yukpo_ia_long_term_memory_consent_at: {e}')

# 7. token_consumption_logs (used by billing debit)
if not table_exists('token_consumption_logs'):
    print('Creating token_consumption_logs...')
    cur.execute("""
        CREATE TABLE IF NOT EXISTS token_consumption_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_name VARCHAR(100) NOT NULL,
            amount_consumed BIGINT NOT NULL,
            description TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_user ON token_consumption_logs(user_id, created_at DESC)")
    print('  -> CREATED')
else:
    print('token_consumption_logs: already exists')

print('\n=== ALL DONE ===')
cur.close()
conn.close()
