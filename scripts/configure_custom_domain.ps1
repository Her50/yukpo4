# Script de configuration du domaine personnalisé yukpo.cm pour Cloud Run
# Prérequis : Le domaine doit être acheté et vous devez avoir accès au DNS

$DOMAIN = "yukpo.cm"
$SERVICE_NAME = "yukpo-backend"
$REGION = "europe-west1"
$PROJECT_ID = "yukpo-project"

Write-Host "🌐 Configuration du domaine personnalisé $DOMAIN pour Cloud Run" -ForegroundColor Cyan
Write-Host ""

# Étape 1 : Vérifier le service Cloud Run
Write-Host "📋 Étape 1 : Vérification du service Cloud Run..." -ForegroundColor Yellow
gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format="value(status.url)"

# Étape 2 : Mapper le domaine au service Cloud Run
Write-Host ""
Write-Host "📋 Étape 2 : Mapping du domaine $DOMAIN au service $SERVICE_NAME..." -ForegroundColor Yellow
Write-Host "Cette commande va créer le mapping. Vous devrez ensuite configurer les DNS." -ForegroundColor Gray

gcloud run domain-mappings create --service=$SERVICE_NAME --domain=$DOMAIN --region=$REGION --project=$PROJECT_ID

# Étape 3 : Obtenir les enregistrements DNS à configurer
Write-Host ""
Write-Host "📋 Étape 3 : Récupération des enregistrements DNS à configurer..." -ForegroundColor Yellow
Write-Host "Copiez ces informations et configurez-les chez votre registrar DNS :" -ForegroundColor Green

gcloud run domain-mappings describe --domain=$DOMAIN --region=$REGION --project=$PROJECT_ID

Write-Host ""
Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes manuelles :" -ForegroundColor Cyan
Write-Host "1. Connectez-vous à votre registrar DNS (Namecheap, GoDaddy, etc.)"
Write-Host "2. Ajoutez les enregistrements DNS affichés ci-dessus"
Write-Host "3. Attendez la propagation DNS (5-60 minutes)"
Write-Host "4. Vérifiez avec : nslookup $DOMAIN"
Write-Host ""
Write-Host "🔗 Une fois configuré, vos liens seront :" -ForegroundColor Cyan
Write-Host "   - https://$DOMAIN/product/123"
Write-Host "   - https://$DOMAIN/service/456"
Write-Host "   - https://$DOMAIN/download"
