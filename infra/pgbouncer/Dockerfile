# Image PgBouncer pour Fly.io — mode transaction pooling
# Cible : factoriser N connexions backend en M connexions Postgres (N >> M)
# pour atteindre 10k req/s avec un Postgres limité à 1000 max_connections.

FROM edoburu/pgbouncer:latest

# Variables edoburu/pgbouncer (sans préfixe, écrit directement dans pgbouncer.ini)
ENV POOL_MODE=transaction
ENV MAX_CLIENT_CONN=10000
ENV DEFAULT_POOL_SIZE=50
ENV RESERVE_POOL_SIZE=10
ENV RESERVE_POOL_TIMEOUT=3
ENV SERVER_LIFETIME=3600
ENV SERVER_IDLE_TIMEOUT=600
ENV QUERY_TIMEOUT=20
ENV QUERY_WAIT_TIMEOUT=10
ENV LOG_CONNECTIONS=1
ENV LOG_DISCONNECTIONS=1
ENV LOG_POOLER_ERRORS=1
ENV STATS_PERIOD=60
ENV IGNORE_STARTUP_PARAMETERS=extra_float_digits,application_name,search_path
ENV LISTEN_ADDR=0.0.0.0
ENV LISTEN_PORT=6432

# ✅ 2026-05-21 — Support prepared statements en mode transaction.
# PgBouncer 1.21+ tracks named prepared statements per-client and re-prepares
# them when the connection is reassigned to a different server. Compatible
# avec sqlx 0.8 qui utilise prepared statements named pour query_as!.
# Sans ce paramètre, on observait "current transaction is aborted" en cascade
# car sqlx re-utilise un prepared statement sur une connexion server qui
# vient d'être réassignée (donc le prepared n'existe plus).
ENV MAX_PREPARED_STATEMENTS=200

EXPOSE 6432

# Healthcheck interne PgBouncer
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD nc -z 127.0.0.1 6432 || exit 1
