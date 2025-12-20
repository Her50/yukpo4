# Script PowerShell pour appliquer les migrations des services (Bourse, Orientation, Emploi)
# Base de données Render

$env:PGPASSWORD = "YOUR_PASSWORD"
$hostname = "your-render-db-host.render.com"
$database = "yukpo_db"
$username = "yukpo_db_user"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Application des migrations sur Render" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Migration 1: Livres scolaires (base)
Write-Host "`n[1/6] Application migration livres_scolaires (base)..." -ForegroundColor Yellow
$sql1 = Get-Content -Path "backend\migrations\20250128_create_livres_scolaires_troc.sql" -Raw -Encoding UTF8
$result1 = psql -h $hostname -U $username -d $database -c $sql1 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration livres_scolaires (base) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result1" -ForegroundColor Yellow
}

# Migration 2: Offres emploi (base)
Write-Host "`n[2/6] Application migration offres_emploi (base)..." -ForegroundColor Yellow
$sql2 = Get-Content -Path "backend\migrations\20250128_create_offres_emploi.sql" -Raw -Encoding UTF8
$result2 = psql -h $hostname -U $username -d $database -c $sql2 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration offres_emploi (base) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result2" -ForegroundColor Yellow
}

# Migration 3: Orientation scolaire (base)
Write-Host "`n[3/6] Application migration orientation_scolaire (base)..." -ForegroundColor Yellow
$sql3 = Get-Content -Path "backend\migrations\20250128_create_orientation_scolaire.sql" -Raw -Encoding UTF8
$result3 = psql -h $hostname -U $username -d $database -c $sql3 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration orientation_scolaire (base) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result3" -ForegroundColor Yellow
}

# Migration 4: Bourse livre (avancé)
Write-Host "`n[4/6] Application migration bourse_livre (avancé)..." -ForegroundColor Yellow
$sql4 = Get-Content -Path "backend\migrations\20250127_create_bourse_livre_advanced_tables.sql" -Raw -Encoding UTF8
$result4 = psql -h $hostname -U $username -d $database -c $sql4 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration bourse_livre (avancé) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result4" -ForegroundColor Yellow
}

# Migration 5: Orientation scolaire (avancé)
Write-Host "`n[5/6] Application migration orientation_scolaire (avancé)..." -ForegroundColor Yellow
$sql5 = Get-Content -Path "backend\migrations\20250127_create_orientation_scolaire_advanced_tables.sql" -Raw -Encoding UTF8
$result5 = psql -h $hostname -U $username -d $database -c $sql5 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration orientation_scolaire (avancé) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result5" -ForegroundColor Yellow
}

# Migration 6: Offres emploi (avancé)
Write-Host "`n[6/6] Application migration offres_emploi (avancé)..." -ForegroundColor Yellow
$sql6 = Get-Content -Path "backend\migrations\20250127_create_offres_emploi_advanced_tables.sql" -Raw -Encoding UTF8
$result6 = psql -h $hostname -U $username -d $database -c $sql6 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration offres_emploi (avancé) appliquée" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur (peut être déjà appliquée): $result6" -ForegroundColor Yellow
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "✅ Toutes les migrations ont été tentées" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

