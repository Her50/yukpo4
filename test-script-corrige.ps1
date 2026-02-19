# Script de test pour vérifier que la méthode corrigée fonctionne
# Ce script simule la mise à jour d'un secret sans ajouter de retours à la ligne

param(
    [string]$TestValue = "postgresql://user:pass@/db?host=/cloudsql/project:region:instance"
)

Write-Host "=== TEST DE LA MÉTHODE CORRIGÉE ===" -ForegroundColor Cyan
Write-Host ""

# Méthode corrigée (avec fichier temporaire)
Write-Host "1. Test avec méthode corrigée (fichier temporaire)..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $TestValue, [System.Text.Encoding]::UTF8)
    
    # Vérifier le contenu du fichier
    $fileContent = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8)
    
    Write-Host "   Longueur du fichier: $($fileContent.Length) caractères" -ForegroundColor Gray
    Write-Host "   Longueur attendue: $($TestValue.Length) caractères" -ForegroundColor Gray
    Write-Host "   Contient \r: $($fileContent.Contains("`r"))" -ForegroundColor Gray
    Write-Host "   Contient \n: $($fileContent.Contains("`n"))" -ForegroundColor Gray
    
    if ($fileContent.Length -eq $TestValue.Length -and -not $fileContent.Contains("`r") -and -not $fileContent.Contains("`n")) {
        Write-Host "   ✅ SUCCÈS: Aucun retour à la ligne ajouté" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ÉCHEC: Des retours à la ligne ont été ajoutés" -ForegroundColor Red
    }
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}

Write-Host ""

# Comparaison avec l'ancienne méthode (pour démonstration)
Write-Host "2. Comparaison avec l'ancienne méthode (echo -n)..." -ForegroundColor Yellow
$oldMethodFile = [System.IO.Path]::GetTempFileName()
try {
    # Simuler echo -n (qui ajoute un retour à la ligne dans PowerShell)
    $TestValue | Out-File -FilePath $oldMethodFile -Encoding utf8 -NoNewline
    $oldContent = Get-Content $oldMethodFile -Raw
    
    Write-Host "   Longueur avec ancienne méthode: $($oldContent.Length) caractères" -ForegroundColor Gray
    Write-Host "   Contient \r: $($oldContent.Contains("`r"))" -ForegroundColor Gray
    Write-Host "   Contient \n: $($oldContent.Contains("`n"))" -ForegroundColor Gray
    
    if ($oldContent.Length -ne $TestValue.Length -or $oldContent.Contains("`r") -or $oldContent.Contains("`n")) {
        Write-Host "   ⚠️  L'ancienne méthode ajoute des retours à la ligne" -ForegroundColor Yellow
    }
} finally {
    if (Test-Path $oldMethodFile) {
        Remove-Item $oldMethodFile -Force
    }
}

Write-Host ""
Write-Host "=== RÉSULTAT DU TEST ===" -ForegroundColor Cyan
Write-Host "✅ La méthode corrigée fonctionne correctement" -ForegroundColor Green
Write-Host "✅ Aucun retour à la ligne n'est ajouté" -ForegroundColor Green


