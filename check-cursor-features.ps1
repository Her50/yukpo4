# check-cursor-features.ps1
# Vérification des fonctionnalités Cursor 1.6.35

Write-Host "🔍 Vérification des fonctionnalités Cursor 1.6.35" -ForegroundColor Green

# Vérifier les chemins d'installation
$cursorPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor\resources\app\bin\cursor.exe",
    "C:\Program Files\Cursor\resources\app\bin\cursor.exe",
    "C:\Program Files (x86)\Cursor\resources\app\bin\cursor.exe"
)

$foundPath = $null
foreach ($path in $cursorPaths) {
    if (Test-Path $path) {
        $foundPath = $path
        break
    }
}

if ($foundPath) {
    Write-Host "✅ Cursor trouvé : $foundPath" -ForegroundColor Green
    
    # Vérifier la version
    try {
        $version = & $foundPath --version
        Write-Host "📋 Version CLI : $version" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️ Impossible de vérifier la version CLI" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Cursor non trouvé dans les chemins standards" -ForegroundColor Red
}

# Vérifier les fonctionnalités disponibles
Write-Host "`n🔧 Fonctionnalités à vérifier dans l'interface Cursor :" -ForegroundColor Yellow

Write-Host "`n1. 🐛 BugBot (Révision automatique) :" -ForegroundColor Cyan
Write-Host "   - Ouvrez un projet GitHub dans Cursor" -ForegroundColor White
Write-Host "   - Allez dans les Pull Requests" -ForegroundColor White
Write-Host "   - Recherchez des commentaires automatiques de BugBot" -ForegroundColor White

Write-Host "`n2. 🔄 Background Agent :" -ForegroundColor Cyan
Write-Host "   - Allez dans Settings (Ctrl+,)" -ForegroundColor White
Write-Host "   - Recherchez 'Background Agent' ou 'Background Processing'" -ForegroundColor White
Write-Host "   - Vérifiez si l'option est activée" -ForegroundColor White

Write-Host "`n3. 📓 Support Jupyter :" -ForegroundColor Cyan
Write-Host "   - Créez un fichier .ipynb" -ForegroundColor White
Write-Host "   - Vérifiez si Cursor peut l'ouvrir et l'éditer" -ForegroundColor White
Write-Host "   - Testez l'exécution de cellules Python" -ForegroundColor White

Write-Host "`n4. 🧠 Memories (Mémorisation du contexte) :" -ForegroundColor Cyan
Write-Host "   - Allez dans Settings (Ctrl+,)" -ForegroundColor White
Write-Host "   - Recherchez 'Memories' ou 'Context Memory'" -ForegroundColor White
Write-Host "   - Vérifiez si l'option est disponible" -ForegroundColor White

Write-Host "`n5. 🎯 Max Mode amélioré :" -ForegroundColor Cyan
Write-Host "   - Appuyez sur Ctrl+K pour ouvrir Max Mode" -ForegroundColor White
Write-Host "   - Vérifiez les nouvelles options disponibles" -ForegroundColor White
Write-Host "   - Testez les améliorations de performance" -ForegroundColor White

Write-Host "`n📋 Instructions de vérification :" -ForegroundColor Yellow
Write-Host "1. Ouvrez Cursor (interface graphique)" -ForegroundColor White
Write-Host "2. Allez dans Help > About pour confirmer la version 1.6.35" -ForegroundColor White
Write-Host "3. Testez chaque fonctionnalité listée ci-dessus" -ForegroundColor White
Write-Host "4. Notez quelles fonctionnalités sont disponibles" -ForegroundColor White

Write-Host "`n✅ Script de vérification créé !" -ForegroundColor Green
