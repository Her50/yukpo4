# Script simple pour appliquer la correction des images
Write-Host "🖼️ APPLICATION DE LA CORRECTION DES IMAGES" -ForegroundColor Yellow

# Demander les informations de connexion
$host_db = Read-Host "Host (défaut: localhost)"
if (-not $host_db) { $host_db = "localhost" }

$user_db = Read-Host "Utilisateur (défaut: postgres)"
if (-not $user_db) { $user_db = "postgres" }

$db_name = Read-Host "Nom de la base (défaut: yukpo_db)"
if (-not $db_name) { $db_name = "yukpo_db" }

Write-Host "🔑 Mot de passe pour l'utilisateur $user_db:" -ForegroundColor Yellow
$password = Read-Host -AsSecureString

# Convertir le mot de passe
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plain_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Appliquer la correction des images
Write-Host "📝 Application de la correction des images..." -ForegroundColor Cyan
$env:PGPASSWORD = $plain_password

try {
    $result = psql -h $host_db -U $user_db -d $db_name -f "fix_image_search_complete.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Correction des images appliquée avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultats:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'application:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

# Nettoyage
$env:PGPASSWORD = ""
Write-Host "🚀 Correction des images terminée!" -ForegroundColor Green 