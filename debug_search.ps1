# Debug de la recherche - Test direct du microservice
Write-Host "Debug de la recherche" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green

# Test direct du microservice
Write-Host "`nTest direct du microservice Pinecone..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
    active = $true
} | ConvertTo-Json -Depth 10

Write-Host "Envoi de la requete au microservice..." -ForegroundColor Yellow
Write-Host "Payload: $payload" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "Reponse du microservice recue" -ForegroundColor Green
    Write-Host "Nombre de resultats: $($response.results.Count)" -ForegroundColor Cyan
    
    if ($response.results -and $response.results.Count -gt 0) {
        Write-Host "Resultats trouves!" -ForegroundColor Green
        $response.results | ForEach-Object { 
            Write-Host "- ID: $($_.id), Score: $($_.score)" -ForegroundColor Yellow 
        }
    } else {
        Write-Host "Aucun resultat trouve" -ForegroundColor Yellow
    }
    
    Write-Host "`nReponse complete:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "Erreur lors de l'appel au microservice: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 