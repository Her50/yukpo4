# =============================================================================
# run-backend-local.ps1 — lance yukpomnang_backend en local, pointant sur la
# DB Fly staging via le proxy localhost:15432.
#
# Pré-requis :
#   - cargo build --release --features image (terminé, binaire dans
#     backend/target/release/yukpomnang_backend.exe)
#   - fly proxy 15432:5432 -a yukpo-bourse-sim-db (déjà lancé)
#
# Lance sur 127.0.0.1:8080.
# =============================================================================

$env:DATABASE_URL = "postgres://yukpo_bourse_sim:vawfFy6mTeZ3D5J@localhost:15432/yukpo_db?sslmode=disable"
$env:JWT_SECRET = "c3d61e9b5de52fbef30ae6bf9ce2428e6ad236c4d489977782be12903258e8a1"
$env:PORT = "8080"
$env:HOST = "127.0.0.1"
$env:RUST_LOG = "info,sqlx=warn,tower_http=info"
$env:APP_ENV = "staging-sim"
$env:CLOUD_RUN = "false"
$env:ENABLE_AUTO_MIGRATIONS = "true"
$env:SMS_PROVIDER = "stub"
$env:GPU_ENABLED = "false"
$env:ENABLE_AI_OPTIMIZATIONS = "true"
$env:DB_POOL_SIZE = "10"
$env:DB_POOL_MIN_SIZE = "2"
$env:DB_ACQUIRE_TIMEOUT_SECS = "8"
$env:DB_STATEMENT_TIMEOUT_MS = "30000"
$env:YUKPO_IA_EXEMPT_ALL_PARTNERS = "true"
$env:YUKPO_IA_TOKEN_MULTIPLIER = "20"
$env:YUKPO_SIGNUP_BONUS_TOKENS = "4000"
$env:YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS = ""

Set-Location C:\Users\23767\yukpomnang2\backend
Write-Host "▶️  Lance yukpomnang_backend sur http://127.0.0.1:8080"
Write-Host "   DB = $($env:DATABASE_URL -replace ':[^@/]+@', ':***@')"
Write-Host "   JWT = ***"
# Préférer release si dispo, sinon debug
if (Test-Path .\target\release\yukpomnang_backend.exe) {
    Write-Host "   Binaire : target\release\yukpomnang_backend.exe"
    & .\target\release\yukpomnang_backend.exe
} else {
    Write-Host "   Binaire : target\debug\yukpomnang_backend.exe (mode debug — plus lent)"
    & .\target\debug\yukpomnang_backend.exe
}
