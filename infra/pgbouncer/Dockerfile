# Image PgBouncer pour Fly.io — mode transaction pooling
# Cible : factoriser N connexions backend en M connexions Postgres (N >> M)
# pour atteindre 10k req/s avec un Postgres limité à 1000 max_connections.

FROM edoburu/pgbouncer:1.23.1

# Variables d'environnement attendues (à fournir via `fly secrets set`) :
#   DB_HOST            — hôte Postgres Fly (ex: yukpo-bourse-sim-db.internal)
#   DB_PORT            — port Postgres (5432)
#   DB_NAME            — nom de la base (yukpo_db)
#   DB_USER            — user superuser pour stats_users
#   DB_PASSWORD        — mot de passe (chiffré dans Fly secrets)
#
# Le entrypoint d'edoburu/pgbouncer génère automatiquement userlist.txt
# et pgbouncer.ini depuis ces variables au boot.

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

EXPOSE 6432

# Healthcheck interne PgBouncer
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD nc -z 127.0.0.1 6432 || exit 1
