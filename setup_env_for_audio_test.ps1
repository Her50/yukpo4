# Script de configuration des variables d'environnement pour les tests de transcription audio
Write-Host "🎤 Configuration des variables d'environnement pour la transcription audio" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green

# Vérifier si la clé OpenAI est déjà configurée
$current_openai_key = $env:OPENAI_API_KEY

if (-not $current_openai_key) {
    Write-Host "⚠️  Clé OpenAI non configurée" -ForegroundColor Yellow
    Write-Host "`n📝 Pour configurer votre clé OpenAI :" -ForegroundColor Cyan
    Write-Host "1. Allez sur https://platform.openai.com/api-keys" -ForegroundColor White
    Write-Host "2. Créez une nouvelle clé API" -ForegroundColor White
    Write-Host "3. Copiez la clé (commence par 'sk-')" -ForegroundColor White
    Write-Host "4. Exécutez cette commande :" -ForegroundColor White
    Write-Host "   `$env:OPENAI_API_KEY='sk-votre-cle-ici'" -ForegroundColor Yellow
    Write-Host "`n💡 Ou ajoutez-la temporairement pour ce test :" -ForegroundColor Cyan
    
    # Demander à l'utilisateur d'entrer sa clé
    $openai_key = Read-Host "Entrez votre clé OpenAI (ou appuyez sur Entrée pour ignorer)"
    
    if ($openai_key -and $openai_key -ne "") {
        $env:OPENAI_API_KEY = $openai_key
        Write-Host "✅ Clé OpenAI configurée temporairement" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Test sans clé OpenAI (utilisera Hugging Face en fallback)" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Clé OpenAI déjà configurée" -ForegroundColor Green
}

# Configurer les autres variables nécessaires
Write-Host "`n🔧 Configuration des autres variables..." -ForegroundColor Cyan

# Variables de base de données
$env:DATABASE_URL = "postgresql://postgres:Hernandez87@localhost/yukpomnang"
$env:MONGODB_URL = "mongodb://localhost:27017"
$env:REDIS_URL = "redis://127.0.0.1/"
$env:PORT = "3001"
$env:ENABLE_AI_OPTIMIZATIONS = "true"

# Variables API
$env:YUKPO_API_KEY = "yukpo_backend_key_2024"
$env:EMBEDDING_API_KEY = "yukpo_embedding_key_2024"

# Variables Pinecone (si disponibles)
if (-not $env:PINECONE_API_KEY) {
    $env:PINECONE_API_KEY = "your-pinecone-api-key-here"
    Write-Host "⚠️  Clé Pinecone non configurée (utilisera la valeur par défaut)" -ForegroundColor Yellow
}

$env:PINECONE_INDEX = "service-embeddings"
$env:PINECONE_ENV = "us-east-1-aws"

# Variables de sécurité
$env:JWT_SECRET = "your_jwt_secret_here"
$env:ENCRYPTION_KEY = "your_encryption_key_here"

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green

# Vérifier la configuration
Write-Host "`n📋 Configuration actuelle :" -ForegroundColor Cyan
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor White
Write-Host "PORT: $env:PORT" -ForegroundColor White
Write-Host "OPENAI_API_KEY: $($env:OPENAI_API_KEY.Substring(0, [Math]::Min(10, $env:OPENAI_API_KEY.Length)))..." -ForegroundColor White
Write-Host "PINECONE_INDEX: $env:PINECONE_INDEX" -ForegroundColor White

Write-Host "`n🚀 Prêt pour les tests de transcription audio !" -ForegroundColor Green
Write-Host "Exécutez maintenant : .\test_audio_transcription.ps1" -ForegroundColor Yellow 