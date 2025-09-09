# Test des endpoints IA
# Usage: .\test_ia_endpoints.ps1

$baseUrl = "http://127.0.0.1:3001"

Write-Host "🧪 Test des endpoints IA" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Test /api/ia/analyze (feedback UX)
Write-Host "`n1. Test /api/ia/analyze (feedback UX)" -ForegroundColor Yellow
$analyzeBody = @{
    text = "Je vends une voiture en bon état"
    context = "ultra_advanced_input_analysis"
    includeSecurity = $true
    includeOptimization = $true
    includeModelRecommendation = $true
} | ConvertTo-Json

try {
    $headers = @{ 
        "Content-Type" = "application/json"
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTk5OTk5OSwiaWF0IjoxNzUxNDcwNzE1LCJleHAiOjE3NTE1NTcxMTV9.nGhSMHCvO6_JWdfUouKV-NakaFolAilMUI5H9cOfbsE"
    }
    $r = Invoke-RestMethod -Uri "$baseUrl/api/ia/analyze" -Method POST -Body $analyzeBody -Headers $headers -ErrorAction Stop
    Write-Host "✅ /api/ia/analyze OK" -ForegroundColor Green
    Write-Host "   Confiance: $($r.confidence)" -ForegroundColor Gray
    Write-Host "   Complexité: $($r.complexity)" -ForegroundColor Gray
    Write-Host "   Tokens estimés: $($r.estimatedTokens)" -ForegroundColor Gray
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Write-Host "❌ /api/ia/analyze ERREUR: $status" -ForegroundColor Red
    Write-Host "   $content" -ForegroundColor Gray
}

# 2. Test /api/ia/auto (analyse principale)
Write-Host "`n2. Test /api/ia/auto (analyse principale)" -ForegroundColor Yellow
$autoBody = @{
    texte = "Je vends une voiture en bon état"
    site_web = $null
    base64_image = @()
    audio_base64 = $null
    video_base64 = $null
    doc_base64 = @()
    excel_base64 = @()
    gps_mobile = $null
} | ConvertTo-Json

try {
    $headers = @{ 
        "Content-Type" = "application/json"
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTk5OTk5OSwiaWF0IjoxNzUxNDcwNzE1LCJleHAiOjE3NTE1NTcxMTV9.nGhSMHCvO6_JWdfUouKV-NakaFolAilMUI5H9cOfbsE"
    }
    $r = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body $autoBody -Headers $headers -ErrorAction Stop
    Write-Host "✅ /api/ia/auto OK" -ForegroundColor Green
    Write-Host "   Type de réponse: $($r.GetType().Name)" -ForegroundColor Gray
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Write-Host "❌ /api/ia/auto ERREUR: $status" -ForegroundColor Red
    Write-Host "   $content" -ForegroundColor Gray
}

Write-Host "`n✅ Tests terminés" -ForegroundColor Green 