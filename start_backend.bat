@echo off
echo 🚀 Démarrage du backend avec debug...
echo 🔧 RUST_LOG=debug
echo 🔧 RUST_BACKTRACE=1
echo 📦 Compilation et démarrage...
echo.

cd backend
set RUST_LOG=debug
set RUST_BACKTRACE=1
cargo run --features image_search

pause 