param(
    [Parameter(Mandatory = $true)]
    [int]$ServiceId,

    [Parameter(Mandatory = $true)]
    [int]$ProductIndex,

    [string]$BaseUrl = $env:API_BASE_URL,
    [string]$Token = $env:AUTH_TOKEN,
    [int]$TimeoutSeconds = 240
)

if (-not $BaseUrl) {
    $BaseUrl = "http://localhost:3000"
}

if (-not $Token) {
    Write-Host "[test-video] ❌ Aucun token fourni. Utilisez AUTH_TOKEN ou le paramètre -Token." -ForegroundColor Red
    exit 1
}

Write-Host "[test-video] ▶️ Lancement du test end-to-end (service $ServiceId, produit $ProductIndex)..." -ForegroundColor Cyan

$payload = @{
    style                      = "tiktok"
    duration_seconds           = 30
    headline                   = "Test auto : vitrine Yukpo"
    call_to_action             = "Commandez maintenant via Yukpo ✅"
    include_price              = $true
    include_promotion          = $true
    include_contact            = $true
    use_product_gallery        = $true
    use_service_mediatech      = $true
    include_publicite_assets   = $true
    publish_to_chat            = $false
    publish_to_product_card    = $false
    auto_storyboard            = $true
    music_mode                 = "pulse"
    voiceover_lang             = "fr"
    voiceover_script           = "Découvrez notre service Yukpo et profitez de la livraison express aujourd'hui."
    generate_square_variant    = $true
    generate_landscape_variant = $false
    generate_subtitles         = $true
    subtitle_lang              = "fr"
    use_ai_templates           = $true
    style_effects              = @("kenburns", "bloom")
    style_transitions          = @("crossfade")
    distribute_channels        = @("chat", "product", "shorts")
} | ConvertTo-Json -Depth 6

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
}

try {
    $response = Invoke-RestMethod `
        -Uri "$BaseUrl/api/media/product/$ServiceId/$ProductIndex/generate-video" `
        -Method Post `
        -Headers $headers `
        -Body $payload `
        -TimeoutSec $TimeoutSeconds
}
catch {
    Write-Host "[test-video] ❌ Échec de la génération vidéo: $_" -ForegroundColor Red
    exit 1
}

Write-Host "[test-video] ✅ Génération lancée." -ForegroundColor Green
Write-Host ($response | ConvertTo-Json -Depth 5)

if (-not $response.success) {
    Write-Host "[test-video] ⚠️ L'API a répondu success=false. Fin du test." -ForegroundColor Yellow
    exit 1
}

Start-Sleep -Seconds 2

try {
    $qualityResponse = Invoke-RestMethod `
        -Uri "$BaseUrl/api/media/quality?limit=1" `
        -Method Get `
        -Headers $headers `
        -TimeoutSec 30

    Write-Host "[test-video] 📊 Derniers scores qualité:" -ForegroundColor Cyan
    Write-Host ($qualityResponse | ConvertTo-Json -Depth 4)
}
catch {
    Write-Host "[test-video] ⚠️ Impossible de récupérer /api/media/quality : $_" -ForegroundColor Yellow
}

Write-Host "[test-video] ✅ Test terminé." -ForegroundColor Green

