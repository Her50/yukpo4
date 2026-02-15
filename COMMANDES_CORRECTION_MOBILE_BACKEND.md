# 🔧 Commandes de Correction : Mobile → Backend

**Date** : 2026-02-14  
**Problèmes identifiés** : CORS non configuré, HTTPS timeout

---

## ⚡ CORRECTION 1 : Configurer CORS (PRIORITÉ 1)

### Option A : Via AWS Console (Recommandé)

**Étapes** :
1. AWS Console → ECS → Définitions de tâches → `yukpo-backend`
2. Cliquer sur la dernière révision
3. Créer une nouvelle révision
4. Container Definitions → Cliquer sur le conteneur `backend`
5. Variables d'environnement → Ajouter :
   ```
   Nom: ALLOWED_ORIGINS
   Valeur: *
   ```
6. Créer la révision
7. Mettre à jour le service avec la nouvelle révision

---

### Option B : Via AWS CLI

```bash
# 1. Récupérer la Task Definition actuelle
aws ecs describe-task-definition \
  --task-definition yukpo-backend \
  --region eu-west-1 \
  --query 'taskDefinition' > /tmp/task-def-current.json

# 2. Ajouter ALLOWED_ORIGINS (nécessite jq)
jq '.containerDefinitions[0].environment += [{"name": "ALLOWED_ORIGINS", "value": "*"}]' \
  /tmp/task-def-current.json > /tmp/task-def-updated.json

# 3. Nettoyer le JSON (supprimer les champs non nécessaires)
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
  /tmp/task-def-updated.json > /tmp/task-def-final.json

# 4. Créer une nouvelle révision
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region eu-west-1 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# 5. Mettre à jour le service
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --task-definition "$NEW_TASK_DEF" \
  --region eu-west-1 \
  --force-new-deployment
```

**⚠️ Note** : Cette méthode nécessite `jq` et peut nécessiter des ajustements selon la structure JSON.

---

## ✅ CORRECTION 2 : Activer HTTPS via Cloudflare Proxy

### Via Cloudflare Dashboard (Recommandé)

**Étapes** :
1. Aller sur https://dash.cloudflare.com
2. Sélectionner `yukpomnang.com`
3. DNS → Enregistrements
4. Modifier l'enregistrement A pour `api`
5. **Activer le proxy** (nuage orange) - **IMPORTANT**
6. Sauvegarder

**Résultat** : HTTPS fonctionnera automatiquement via Cloudflare

---

### Via Cloudflare API (Si vous avez un token)

```bash
# Variables
ZONE_ID="98970e23637def46d0a62c789ed66039"  # Zone ID de yukpomnang.com
API_TOKEN="VOTRE_TOKEN_CLOUDFLARE"
RECORD_NAME="api"
IP="52.215.47.205"

# Récupérer l'ID de l'enregistrement existant
RECORD_ID=$(curl -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$RECORD_NAME.yukpomnang.com" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')

# Mettre à jour l'enregistrement avec proxy activé
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "content": "'$IP'",
    "proxied": true
  }'
```

---

## 📋 VÉRIFICATION APRÈS CORRECTIONS

### Test CORS

```bash
# Test depuis PowerShell
$headers = @{
    "Origin" = "capacitor://localhost"
}
try {
    $response = Invoke-WebRequest -Uri "http://52.215.47.205:8080/health" -Headers $headers -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "CORS Headers:"
    $response.Headers | Where-Object { $_ -like "*access-control*" }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
```

### Test HTTPS

```bash
# Test HTTPS via DNS (après activation du proxy Cloudflare)
try {
    $response = Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Content: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
```

---

## 🎯 CHECKLIST DE CORRECTION

- [ ] **CORS configuré** : Variable `ALLOWED_ORIGINS` ajoutée dans la Task Definition
- [ ] **Service ECS mis à jour** : Nouvelle révision déployée
- [ ] **Proxy Cloudflare activé** : Nuage orange sur l'enregistrement DNS `api`
- [ ] **HTTPS fonctionnel** : Test `https://api.yukpomnang.com/health` retourne 200 OK
- [ ] **Application mobile testée** : Connexion réussie depuis l'app

---

## 📊 RÉSULTATS ATTENDUS

### Après Correction 1 (CORS)

- ✅ Variable `ALLOWED_ORIGINS` présente dans la Task Definition
- ✅ Service ECS redéployé avec la nouvelle révision
- ✅ Requêtes depuis l'application mobile acceptées par CORS

### Après Correction 2 (HTTPS)

- ✅ Proxy Cloudflare activé (nuage orange)
- ✅ HTTPS fonctionnel : `https://api.yukpomnang.com/health` retourne 200 OK
- ✅ Certificat SSL automatique via Cloudflare

---

**Date** : 2026-02-14  
**Statut** : 🔧 Commandes de correction prêtes


