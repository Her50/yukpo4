# Script pour corriger les appels API dans le frontend
Write-Host "Correction des appels API dans le frontend..." -ForegroundColor Green

# Liste des fichiers à corriger avec leurs patterns
 = @(
    @{Path="frontend/src/pages/HomePage.tsx"; Pattern='fetch\("/api/search/direct"'; Replacement='fetch(${API_BASE_URL}/api/search/direct"'}
    @{Path="frontend/src/pages/RechercheBesoin.tsx"; Pattern='fetch\("/api/search/direct"'; Replacement='fetch(${API_BASE_URL}/api/search/direct"'}
    @{Path="frontend/src/pages/ChatbotAI.tsx"; Pattern='fetch\("/api/ask"'; Replacement='fetch(${API_BASE_URL}/api/ask"'}
    @{Path="frontend/src/pages/ContactEnterprisePage.tsx"; Pattern='fetch\("/api/contact/entreprise"'; Replacement='fetch(${API_BASE_URL}/api/contact/entreprise"'}
    @{Path="frontend/src/pages/FormulaireYukpoIntelligent.tsx"; Pattern='fetch\("/api/users/balance"'; Replacement='fetch(${API_BASE_URL}/api/users/balance"'}
    @{Path="frontend/src/pages/IAInsights.tsx"; Pattern='fetch\("/api/ia/score"'; Replacement='fetch(${API_BASE_URL}/api/ia/score"'}
    @{Path="frontend/src/pages/SecurityDashboard.tsx"; Pattern='fetch\("/api/admin/security-dashboard"'; Replacement='fetch(${API_BASE_URL}/api/admin/security-dashboard"'}
    @{Path="frontend/src/pages/SmartBlocksStatus.tsx"; Pattern='fetch\("/api/admin/block-status"'; Replacement='fetch(${API_BASE_URL}/api/admin/block-status"'}
    @{Path="frontend/src/pages/SummaryDashboard.tsx"; Pattern='fetch\("/api/admin/summarize-all"'; Replacement='fetch(${API_BASE_URL}/api/admin/summarize-all"'}
    @{Path="frontend/src/pages/ThreatDashboard.tsx"; Pattern='fetch\("/api/admin/threats"'; Replacement='fetch(${API_BASE_URL}/api/admin/threats"'}
)

foreach ( in ) {
    if (Test-Path .Path) {
        Write-Host "Correction de ..." -ForegroundColor Yellow
         = Get-Content .Path -Raw
         =  -replace .Pattern, .Replacement
        Set-Content .Path  -Encoding UTF8
        Write-Host "✓  corrigé" -ForegroundColor Green
    } else {
        Write-Host "⚠ Fichier non trouvé: " -ForegroundColor Red
    }
}

Write-Host "Correction terminée!" -ForegroundColor Green
