# Script pour obtenir les credentials AWS à configurer dans GitHub Secrets
# Aide à préparer les valeurs pour les secrets GitHub Actions

Write-Host ""
Write-Host "=== Credentials AWS pour GitHub Secrets ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier que AWS CLI est configuré
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Host "[OK] AWS CLI configure" -ForegroundColor Green
    Write-Host "  Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "  User ARN: $($identity.Arn)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[ERROR] AWS CLI non configure" -ForegroundColor Red
    Write-Host "  Configurez AWS CLI avec: aws configure" -ForegroundColor Yellow
    exit 1
}

# Instructions pour obtenir les credentials
Write-Host "=== Instructions ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour configurer les secrets GitHub Actions, vous avez 2 options :" -ForegroundColor White
Write-Host ""
Write-Host "Option 1 : Utiliser les credentials existants (si vous avez des Access Keys)" -ForegroundColor Cyan
Write-Host "  1. Allez dans AWS Console > IAM > Users > Votre utilisateur > Security credentials" -ForegroundColor Gray
Write-Host "  2. Si vous avez des Access Keys existantes, utilisez-les" -ForegroundColor Gray
Write-Host "  3. Sinon, créez-en de nouvelles (voir Option 2)" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2 : Créer de nouvelles Access Keys pour GitHub Actions" -ForegroundColor Cyan
Write-Host "  1. Allez dans AWS Console > IAM > Users" -ForegroundColor Gray
Write-Host "  2. Créez un nouvel utilisateur : github-actions-ecr-push" -ForegroundColor Gray
Write-Host "  3. Attachez la politique : AmazonEC2ContainerRegistryPowerUser" -ForegroundColor Gray
Write-Host "  4. Créez des Access Keys pour cet utilisateur" -ForegroundColor Gray
Write-Host "  5. Notez l'Access Key ID et Secret Access Key" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Configuration dans GitHub ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Une fois que vous avez les credentials :" -ForegroundColor White
Write-Host ""
Write-Host "1. Allez sur : https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Cliquez sur 'New repository secret'" -ForegroundColor White
Write-Host ""
Write-Host "3. Ajoutez le premier secret :" -ForegroundColor White
Write-Host "   Name:  AWS_ACCESS_KEY_ID" -ForegroundColor Yellow
Write-Host "   Value: [Votre Access Key ID]" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Cliquez sur 'New repository secret' à nouveau" -ForegroundColor White
Write-Host ""
Write-Host "5. Ajoutez le deuxième secret :" -ForegroundColor White
Write-Host "   Name:  AWS_SECRET_ACCESS_KEY" -ForegroundColor Yellow
Write-Host "   Value: [Votre Secret Access Key]" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Vérification ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Après avoir configuré les secrets, testez avec :" -ForegroundColor White
Write-Host "  git push origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puis vérifiez dans GitHub > Actions que le workflow s'exécute correctement" -ForegroundColor White
Write-Host ""


