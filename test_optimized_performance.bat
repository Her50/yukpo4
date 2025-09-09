@echo off
echo ========================================
echo Test des performances optimisees
echo ========================================

echo.
echo 1. Verification des services...
echo.

REM Verifier que le backend est en cours d'execution
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Backend non accessible sur http://localhost:3001
    echo    Lancez d'abord: cd backend && cargo run
    pause
    exit /b 1
) else (
    echo ✅ Backend accessible
)

REM Verifier que le microservice embedding est en cours d'execution
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Microservice embedding non accessible sur http://localhost:8000
    echo    Lancez d'abord: cd microservice_embedding && python main.py
    pause
    exit /b 1
) else (
    echo ✅ Microservice embedding accessible
)

echo.
echo 2. Lancement des tests de performance...
echo.

python test_optimized_service_creation.py

echo.
echo 3. Test termine.
echo.
pause 