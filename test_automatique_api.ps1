# Test automatique de l'API Yukpo
# Teste les endpoints backend directement avec analyse des reponses

Write-Host "🧪 Test automatique de l'API Yukpo" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green

# Configuration
$baseUrl = "http://localhost:8000"
$apiUrl = "$baseUrl/api"

# Fonction pour envoyer une requete et analyser la reponse
function Test-APIEndpoint {
    param(
        [string]$Name,
        [string]$Endpoint,
        [string]$Method = "POST",
        [object]$Body = $null
    )
    
    Write-Host "`n📋 Test: $Name" -ForegroundColor Yellow
    Write-Host "Endpoint: $Method $Endpoint" -ForegroundColor Cyan
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            Write-Host "Body: $jsonBody" -ForegroundColor Gray
            $response = Invoke-RestMethod -Uri "$apiUrl$Endpoint" -Method $Method -Headers $headers -Body $jsonBody
        } else {
            $response = Invoke-RestMethod -Uri "$apiUrl$Endpoint" -Method $Method -Headers $headers
        }
        
        Write-Host "✅ Succes" -ForegroundColor Green
        Write-Host "Reponse: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor White
        return $true, $response
        
    } catch {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode
            Write-Host "Status Code: $statusCode" -ForegroundColor Red
        }
        return $false, $null
    }
}

# Test 1: Service tarissable avec produits
Write-Host "`n🔍 Test 1: Service tarissable avec produits" -ForegroundColor Magenta
$test1Data = @{
    texte = "Je veux creer un service de vente de fournitures scolaires a Douala. Je vends des cahiers, stylos, cartables et autres fournitures. Le service est tarissable."
    gps_mobile = "4.0511,9.7679"
}

$success1, $response1 = Test-APIEndpoint -Name "Test 1 - Service tarissable" -Endpoint "/orchestration-ia" -Body $test1Data

if ($success1) {
    # Analyse de la reponse
    Write-Host "`n📊 Analyse de la reponse Test 1:" -ForegroundColor Blue
    if ($response1.intention -eq "creation_service") {
        Write-Host "✅ Intention correcte: creation_service" -ForegroundColor Green
    } else {
        Write-Host "❌ Intention incorrecte: $($response1.intention)" -ForegroundColor Red
    }
    
    if ($response1.data.is_tarissable -eq $true) {
        Write-Host "✅ Service detecte comme tarissable" -ForegroundColor Green
    } else {
        Write-Host "❌ Service non detecte comme tarissable" -ForegroundColor Red
    }
    
    if ($response1.data.produits) {
        Write-Host "✅ Liste de produits detectee" -ForegroundColor Green
        Write-Host "Produits: $($response1.data.produits -join ', ')" -ForegroundColor White
    } else {
        Write-Host "❌ Aucun produit detecte" -ForegroundColor Red
    }
}

# Test 2: Service avec GPS fixe
Write-Host "`n🔍 Test 2: Service avec GPS fixe" -ForegroundColor Magenta
$test2Data = @{
    texte = "Je propose des cours de mathematiques a domicile dans le quartier Akwa a Douala. Mon service a un emplacement fixe."
    gps_mobile = "4.0511,9.7679"
}

$success2, $response2 = Test-APIEndpoint -Name "Test 2 - Service GPS fixe" -Endpoint "/orchestration-ia" -Body $test2Data

if ($success2) {
    Write-Host "`n📊 Analyse de la reponse Test 2:" -ForegroundColor Blue
    if ($response2.data.gps_fixe -eq $true) {
        Write-Host "✅ GPS fixe detecte" -ForegroundColor Green
    } else {
        Write-Host "❌ GPS fixe non detecte" -ForegroundColor Red
    }
}

# Test 3: Service avec donnees modales (simulation)
Write-Host "`n🔍 Test 3: Service avec donnees modales" -ForegroundColor Magenta
$test3Data = @{
    texte = "Je vends des meubles occasion en tres bon etat. Photos disponibles."
    gps_mobile = "4.0511,9.7679"
}

$success3, $response3 = Test-APIEndpoint -Name "Test 3 - Service modales" -Endpoint "/orchestration-ia" -Body $test3Data

if ($success3) {
    Write-Host "`n📊 Analyse de la reponse Test 3:" -ForegroundColor Blue
    Write-Host "✅ Service avec donnees modales traite" -ForegroundColor Green
}

# Test 4: Creation de service (si les tests precedents reussissent)
if ($success1) {
    Write-Host "`n🔍 Test 4: Creation de service en base" -ForegroundColor Magenta
    
    # Preparation des donnees pour la creation
    $serviceData = @{
        intention = "creation_service"
        data = $response1.data
        metadata = @{
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            source = "test_automatique"
        }
    }
    
    $success4, $response4 = Test-APIEndpoint -Name "Test 4 - Creation service" -Endpoint "/services" -Body $serviceData
    
    if ($success4) {
        Write-Host "`n📊 Analyse de la creation:" -ForegroundColor Blue
        if ($response4.id) {
            Write-Host "✅ Service cree avec ID: $($response4.id)" -ForegroundColor Green
        } else {
            Write-Host "❌ Service non cree" -ForegroundColor Red
        }
    }
}

# Resume final
Write-Host "`n📈 Resume des tests:" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host "Test 1 (Tarissable): $(if($success1) {'✅'} else {'❌'})" -ForegroundColor $(if($success1) {'Green'} else {'Red'})
Write-Host "Test 2 (GPS fixe): $(if($success2) {'✅'} else {'❌'})" -ForegroundColor $(if($success2) {'Green'} else {'Red'})
Write-Host "Test 3 (Modales): $(if($success3) {'✅'} else {'❌'})" -ForegroundColor $(if($success3) {'Green'} else {'Red'})
Write-Host "Test 4 (Creation): $(if($success4) {'✅'} else {'❌'})" -ForegroundColor $(if($success4) {'Green'} else {'Red'})

$totalTests = 4
$passedTests = @($success1, $success2, $success3, $success4) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count

Write-Host "`n🎯 Resultat: $passedTests/$totalTests tests reussis" -ForegroundColor $(if($passedTests -eq $totalTests) {'Green'} else {'Yellow'})

if ($passedTests -eq $totalTests) {
    Write-Host "🎉 Tous les tests sont passes ! Le systeme fonctionne correctement." -ForegroundColor Green
} else {
    Write-Host "⚠️ Certains tests ont echoue. Verifiez les logs ci-dessus." -ForegroundColor Yellow
} 