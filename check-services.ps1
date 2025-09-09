# Script pour verifier l'etat des services
Write-Host "Verification des services Yukpo..." -ForegroundColor Green

# Verifier le backend (port 8001)
Write-Host "`nBackend (port 8001):" -ForegroundColor Yellow
$backend = netstat -an | findstr ":8001"
if ($backend) {
    Write-Host "Backend en cours d'execution" -ForegroundColor Green
    Write-Host $backend
} else {
    Write-Host "Backend non demarre" -ForegroundColor Red
}

# Verifier le frontend
Write-Host "`nFrontend (port 5173):" -ForegroundColor Yellow
$frontend = netstat -an | findstr ":5173"
if ($frontend) {
    Write-Host "Frontend en cours d'execution" -ForegroundColor Green
    Write-Host $frontend
} else {
    Write-Host "Frontend non demarre" -ForegroundColor Red
}

# Verifier le microservice d'embedding
Write-Host "`nMicroservice Embedding (port 8000):" -ForegroundColor Yellow
$embedding = netstat -an | findstr ":8000"
if ($embedding) {
    Write-Host "Microservice d'embedding en cours d'execution" -ForegroundColor Green
    Write-Host $embedding
} else {
    Write-Host "Microservice d'embedding non demarre" -ForegroundColor Red
}

Write-Host "`nURLs:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend: http://127.0.0.1:8001" -ForegroundColor White
Write-Host "Documentation: http://127.0.0.1:8001/docs" -ForegroundColor White
Write-Host "Embedding: http://localhost:8000" -ForegroundColor White
Write-Host "Embedding Docs: http://localhost:8000/docs" -ForegroundColor White 