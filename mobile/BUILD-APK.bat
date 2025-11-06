@echo off
echo.
echo ========================================
echo    COMPILATION APK - YUKPOMNANG
echo ========================================
echo.
echo Dossier: %CD%
echo Temps estime: 10-15 minutes
echo.

cd android

echo Nettoyage des processus Gradle...
call gradlew --stop
timeout /t 2 /nobreak >nul

echo.
echo Suppression des fichiers de lock...
if exist .gradle (
    rmdir /s /q .gradle
    echo Fichiers .gradle supprimes
)

echo.
echo ===========================================
echo Lancement de la compilation...
echo ===========================================
echo.

call gradlew assembleDebug --no-daemon --console=plain

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo    BUILD TERMINE AVEC SUCCES !
    echo ========================================
    echo.
    echo APK genere:
    echo %CD%\app\build\outputs\apk\debug\app-debug.apk
    echo.
) else (
    echo.
    echo ========================================
    echo    BUILD ECHOUE !
    echo ========================================
    echo.
    echo Consultez les erreurs ci-dessus
    echo.
)

pause

