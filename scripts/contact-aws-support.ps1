# Script pour préparer le contact avec AWS Support
# Génère un message type pour demander réduction de facture

Write-Host "📧 Préparation Message AWS Support" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# Récupérer les informations de facture
Write-Host "Récupération des informations de facture..." -ForegroundColor Yellow

try {
    $startDate = (Get-Date).AddMonths(-1).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    
    $costs = aws ce get-cost-and-usage `
        --time-period Start=$startDate,End=$endDate `
        --granularity MONTHLY `
        --metrics BlendedCost `
        --group-by Type=DIMENSION,Key=SERVICE `
        --region eu-west-1 `
        --output json | ConvertFrom-Json
    
    Write-Host "`n✅ Informations récupérées`n" -ForegroundColor Green
    
    # Générer le message
    $message = @"
Bonjour AWS Support,

Je suis en phase de test/développement de mon application Yukpomnang et j'ai reçu une facture inattendue de plus de $600. Je n'étais pas au courant des coûts associés aux ressources AWS que j'ai déployées via Terraform.

DÉTAILS DE MA FACTURE :
"@
    
    if ($costs.ResultsByTime) {
        $totalCost = 0
        foreach ($result in $costs.ResultsByTime) {
            foreach ($group in $result.Groups) {
                $service = $group.Keys[0]
                $amount = [decimal]$group.Metrics.BlendedCost.Amount
                $totalCost += $amount
                
                if ($amount -gt 0) {
                    $message += "`n- $service : $($amount.ToString('F2')) USD"
                }
            }
        }
        $message += "`n`nTOTAL : $($totalCost.ToString('F2')) USD"
    }
    
    $message += @"

SITUATION :
- Phase de test/développement uniquement
- Pas de trafic de production
- Première utilisation d'AWS à cette échelle
- Coûts non anticipés lors du déploiement

DEMANDES :
1. Analyse de ma facture et identification des coûts élevés
2. Aide pour optimiser mon infrastructure immédiatement
3. Considération d'une réduction ou crédits pour cette facture étant donné :
   - Phase de test (pas de production)
   - Première facture élevée
   - Manque de connaissance des coûts AWS
4. Guidance pour éviter des coûts similaires à l'avenir

ACTIONS DÉJÀ PRISES :
- Identification des ressources sur-dimensionnées
- Plan d'optimisation prêt à être appliqué
- Réduction immédiate des ressources au minimum

Je suis prêt à optimiser mon infrastructure immédiatement pour réduire les coûts futurs.

Merci pour votre compréhension et votre aide.

Cordialement,
[Votre nom]
[Votre email]
"@
    
    # Sauvegarder le message
    $message | Out-File -FilePath "aws-support-message.txt" -Encoding UTF8
    
    Write-Host "✅ Message généré dans 'aws-support-message.txt'" -ForegroundColor Green
    Write-Host "`n📋 PROCHAINES ÉTAPES :" -ForegroundColor Yellow
    Write-Host "1. Ouvrir AWS Console → Support Center" -ForegroundColor White
    Write-Host "2. Créer un nouveau case (Account and Billing Support)" -ForegroundColor White
    Write-Host "3. Copier le contenu de 'aws-support-message.txt'" -ForegroundColor White
    Write-Host "4. Envoyer le message" -ForegroundColor White
    Write-Host "`n💡 Lien direct : https://console.aws.amazon.com/support/home" -ForegroundColor Cyan
    
} catch {
    Write-Host "⚠️ Impossible de récupérer les coûts automatiquement" -ForegroundColor Yellow
    Write-Host "   Création d'un message générique..." -ForegroundColor Yellow
    
    $message = @"
Bonjour AWS Support,

Je suis en phase de test/développement de mon application et j'ai reçu une facture inattendue de plus de $600. Je n'étais pas au courant des coûts associés aux ressources AWS.

SITUATION :
- Phase de test/développement uniquement
- Pas de trafic de production
- Première utilisation d'AWS à cette échelle
- Coûts non anticipés lors du déploiement

DEMANDES :
1. Analyse de ma facture et identification des coûts élevés
2. Aide pour optimiser mon infrastructure immédiatement
3. Considération d'une réduction ou crédits pour cette facture
4. Guidance pour éviter des coûts similaires à l'avenir

Je suis prêt à optimiser mon infrastructure immédiatement.

Merci,
[Votre nom]
"@
    
    $message | Out-File -FilePath "aws-support-message.txt" -Encoding UTF8
    Write-Host "✅ Message généré dans 'aws-support-message.txt'" -ForegroundColor Green
}

Write-Host "`n📄 Contenu du message :" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Get-Content "aws-support-message.txt"

