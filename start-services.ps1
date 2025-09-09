#!/usr/bin/env pwsh

Write-Host "🚀 Démarrage des services Yukpo..." -ForegroundColor Green

# Fonction pour démarrer un service en arrière-plan
function Start-ServiceInBackground {
    param(
        [string]$ServiceName,
        [string]$Directory,
        [string]$Command,
        [string]$Color = "White"
    )
    
    Write-Host "🔄 Démarrage de $ServiceName..." -ForegroundColor $Color
    
    # Créer un nouveau processus PowerShell
    $processArgs = @{
        FilePath = "powershell.exe"
        ArgumentList = "-NoExit", "-Command", "cd '$Directory'; $Command"
        WindowStyle = "Normal"
    }
    
    Start-Process @processArgs
    Start-Sleep -Seconds 2
    Write-Host "✅ $ServiceName démarré" -ForegroundColor Green
}

try {
    # Démarrer le backend (Rust)
    Start-ServiceInBackground -ServiceName "Backend Rust" -Directory "backend" -Command "cargo run" -Color "Yellow"
    
    # Attendre un peu pour que le backend démarre
    Start-Sleep -Seconds 5
    
    # Démarrer le frontend (Vite)
    Start-ServiceInBackground -ServiceName "Frontend Vite" -Directory "frontend" -Command "npm run dev" -Color "Cyan"
    
    Write-Host ""
    Write-Host "🎉 Services démarrés avec succès!" -ForegroundColor Green
    Write-Host "📊 Backend: http://localhost:3001" -ForegroundColor Yellow
    Write-Host "🌐 Frontend: http://localhost:5173" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    
} catch {
    Write-Host "❌ Erreur lors du démarrage des services: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
} 