# Script pour corriger toutes les URLs relatives vers API_BASE_URL
 = "https://yukpomnang.onrender.com"

# Fichiers à corriger
 = @(
    "src/lib/paymentClient.ts",
    "src/lib/checkServiceDoublon.ts", 
    "src/services/imageSearchService.ts",
    "src/services/gpsTrackingService.ts",
    "src/services/geospatialService.ts",
    "src/services/geocodingService.ts",
    "src/pages/AffinerBesoinPanel.tsx",
    "src/pages/ChatbotAI.tsx",
    "src/pages/ContactEnterprisePage.tsx",
    "src/pages/IAInsights.tsx",
    "src/pages/PartnerReviewPanel.tsx",
    "src/pages/PurgeLogViewer.tsx",
    "src/pages/RecoPanel.tsx",
    "src/pages/ReservationPanel.tsx",
    "src/pages/ServiceLocator.tsx",
    "src/pages/ServiceView.tsx",
    "src/pages/SmartBlocksStatus.tsx",
    "src/pages/SoldeDetailPage.tsx",
    "src/pages/TrendExplorer.tsx",
    "src/pages/VoicePanel.tsx",
    "src/pages/ThreatDashboard.tsx",
    "src/pages/SummaryDashboard.tsx",
    "src/pages/SecurityDashboard.tsx",
    "src/pages/ResultatsBesoin.tsx"
)

foreach ( in ) {
    if (Test-Path ) {
        Write-Host "Correction de ..."
         = Get-Content  -Raw -Encoding UTF8
        
        # Remplacer les URLs relatives par API_BASE_URL
         =  -replace "fetch\('/api/", "fetch(${API_BASE_URL}/api/"
         =  -replace 'fetch\("/api/', 'fetch(${API_BASE_URL}/api/'
         =  -replace "axios\.post\('/api/", "axios.post(${API_BASE_URL}/api/"
         =  -replace 'axios\.post\("/api/', 'axios.post(${API_BASE_URL}/api/'
         =  -replace "axios\.get\('/api/", "axios.get(${API_BASE_URL}/api/"
         =  -replace 'axios\.get\("/api/', 'axios.get(${API_BASE_URL}/api/'
         =  -replace "fetch\('/api/", "fetch(${API_BASE_URL}/api/"
         =  -replace 'fetch\("/api/', 'fetch(${API_BASE_URL}/api/'
        
        # Ajouter l'import API_BASE_URL si nécessaire
        if ( -notmatch "import.*API_BASE_URL" -and  -match "API_BASE_URL") {
             = "import { API_BASE_URL } from '@/config/api';
" + 
        }
        
        Set-Content  -Value  -Encoding UTF8
        Write-Host "✅  corrigé"
    } else {
        Write-Host "❌  non trouvé"
    }
}

Write-Host "Correction terminée !"
