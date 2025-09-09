# Test complet du système Yukpo
# Test 1: Service tarissable avec produits
# Test 2: Service avec GPS fixe
# Test 3: Service avec données modales

Write-Host "🧪 Test complet du système Yukpo" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Test 1: Service tarissable avec produits
Write-Host "\n Test 1 Service tarissable avec produits" -ForegroundColor Yellow
$test1 = [PSCustomObject]@{
    texte = "Je veux creer un service de vente de fournitures scolaires a Douala. Je vends des cahiers, stylos, cartables et autres fournitures. Le service est tarissable."
    gps_mobile = "4.0511,9.7679"
}
Write-Host "Donnees de test 1:" -ForegroundColor Cyan
$test1 | ConvertTo-Json -Depth 3

# Test 2: Service avec GPS fixe
Write-Host "\n Test 2 Service avec GPS fixe" -ForegroundColor Yellow
$test2 = [PSCustomObject]@{
    texte = "Je propose des cours de mathematiques a domicile dans le quartier Akwa a Douala. Mon service a un emplacement fixe."
    gps_mobile = "4.0511,9.7679"
}
Write-Host "Donnees de test 2:" -ForegroundColor Cyan
$test2 | ConvertTo-Json -Depth 3

# Test 3: Service avec donnees modales
Write-Host "\n Test 3 Service avec donnees modales" -ForegroundColor Yellow
$test3 = [PSCustomObject]@{
    texte = "Je vends des meubles occasion en tres bon etat. Photos disponibles."
    gps_mobile = "4.0511,9.7679"
}
Write-Host "Donnees de test 3:" -ForegroundColor Cyan
$test3 | ConvertTo-Json -Depth 3

Write-Host "`n✅ Tests préparés. Ouvrez le navigateur sur http://localhost:5173" -ForegroundColor Green
Write-Host "1. Testez chaque scenario dans l interface" -ForegroundColor White
Write-Host "2. Verifiez que les champs conditionnels apparaissent" -ForegroundColor White
Write-Host "3. Verifiez que la navigation fonctionne" -ForegroundColor White