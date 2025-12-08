# Script pour trouver les routes dupliquées dans le backend
$routes = @{}
$duplicates = @{}

Get-ChildItem -Path "backend/src/routes" -Filter "*.rs" | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw
    
    # Trouver toutes les routes avec .route("...
    $matches = [regex]::Matches($content, '\.route\s*\(\s*"([^"]+)"')
    
    foreach ($match in $matches) {
        $route = $match.Groups[1].Value
        $method = "GET" # Par défaut, on cherche GET
        
        # Essayer de détecter la méthode HTTP
        $beforeRoute = $content.Substring([Math]::Max(0, $match.Index - 200), [Math]::Min(200, $match.Index))
        if ($beforeRoute -match '\.(get|post|put|delete|patch)\s*\(') {
            $method = $matches[0].Groups[1].Value.ToUpper()
        }
        
        $key = "$method $route"
        
        if ($routes.ContainsKey($key)) {
            if (-not $duplicates.ContainsKey($key)) {
                $duplicates[$key] = @()
                $duplicates[$key] += $routes[$key]
            }
            $duplicates[$key] += $file
        }
        else {
            $routes[$key] = $file
        }
    }
}

# Vérifier aussi les routes WebSocket
Get-ChildItem -Path "backend/src/websocket" -Filter "*.rs" | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw
    
    $matches = [regex]::Matches($content, '\.route\s*\(\s*"([^"]+)"')
    
    foreach ($match in $matches) {
        $route = $match.Groups[1].Value
        $key = "GET $route"
        
        if ($routes.ContainsKey($key)) {
            if (-not $duplicates.ContainsKey($key)) {
                $duplicates[$key] = @()
                $duplicates[$key] += $routes[$key]
            }
            $duplicates[$key] += $file
        }
        else {
            $routes[$key] = $file
        }
    }
}

if ($duplicates.Count -gt 0) {
    Write-Host "`n=== ROUTES DUPLIQUÉES TROUVÉES ===" -ForegroundColor Red
    foreach ($key in $duplicates.Keys) {
        Write-Host "`n$key" -ForegroundColor Yellow
        foreach ($file in $duplicates[$key]) {
            Write-Host "  - $file" -ForegroundColor Cyan
        }
    }
}
else {
    Write-Host "`n✅ Aucune route dupliquée trouvée!" -ForegroundColor Green
}

