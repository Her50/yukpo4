@echo off
echo Configuration des timeouts pour Yukpo...

set EMBEDDING_TIMEOUT_SECONDS=120
set EMBEDDING_MAX_RETRIES=3
set EMBEDDING_RETRY_DELAY_MS=2000
set PINECONE_API_KEY=pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu
set PINECONE_ENV=us-east-1
set PINECONE_INDEX=service-embeddings
set EMBEDDING_API_URL=http://localhost:8000
set YUKPO_API_KEY=yukpo_embedding_key_2024

echo Variables d'environnement configurees :
echo   EMBEDDING_TIMEOUT_SECONDS=%EMBEDDING_TIMEOUT_SECONDS%
echo   EMBEDDING_MAX_RETRIES=%EMBEDDING_MAX_RETRIES%
echo   EMBEDDING_RETRY_DELAY_MS=%EMBEDDING_RETRY_DELAY_MS%
echo   PINECONE_API_KEY=%PINECONE_API_KEY:~0,20%...
echo   PINECONE_ENV=%PINECONE_ENV%
echo   PINECONE_INDEX=%PINECONE_INDEX%
echo   EMBEDDING_API_URL=%EMBEDDING_API_URL%
echo   YUKPO_API_KEY=%YUKPO_API_KEY%

echo.
echo Configuration terminee ! Nouveaux timeouts :
echo   - Embedding timeout: 120 secondes (au lieu de 60)
echo   - Max retries: 3
echo   - Retry delay: 2000ms
echo.
echo Vous pouvez maintenant lancer le backend avec : cargo run
pause 