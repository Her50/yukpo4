# Serveur local simple pour tester CORS
Write-Host "🚀 Démarrage du serveur de test local..." -ForegroundColor Green
Write-Host "📁 Répertoire: $(Get-Location)" -ForegroundColor Cyan
Write-Host "🌐 URL: http://localhost:8080" -ForegroundColor Yellow
Write-Host "🛑 Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Red
Write-Host ""

# Créer un serveur HTTP simple
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()

Write-Host "✅ Serveur démarré sur http://localhost:8080" -ForegroundColor Green
Write-Host "📄 Ouvrez http://localhost:8080/test-cors-debug.html dans votre navigateur" -ForegroundColor Yellow
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($request.HttpMethod) $localPath" -ForegroundColor Gray
        
        if ($localPath -eq "/" -or $localPath -eq "/index.html") {
            $localPath = "/test-cors-debug.html"
        }
        
        $filePath = Join-Path (Get-Location) $localPath.TrimStart('/')
        
        if (Test-Path $filePath) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            
            # Ajouter les headers CORS
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
            
            # Définir le type de contenu
            if ($filePath.EndsWith('.html')) {
                $response.ContentType = "text/html; charset=utf-8"
            }
            elseif ($filePath.EndsWith('.js')) {
                $response.ContentType = "application/javascript"
            }
            elseif ($filePath.EndsWith('.css')) {
                $response.ContentType = "text/css"
            }
            else {
                $response.ContentType = "text/plain"
            }
            
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.StatusCode = 200
        }
        else {
            $errorMessage = "File not found: $localPath"
            $errorBytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
            $response.ContentLength64 = $errorBytes.Length
            $response.ContentType = "text/plain; charset=utf-8"
            $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
            $response.StatusCode = 404
        }
        
        $response.Close()
    }
}
catch {
    Write-Host "❌ Erreur serveur: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    $listener.Stop()
    Write-Host "🛑 Serveur arrêté." -ForegroundColor Yellow
}
