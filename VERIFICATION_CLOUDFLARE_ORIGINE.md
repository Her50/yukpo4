# 🔍 Vérification Configuration Cloudflare - Origine AWS

## 📋 Résumé

Vérification de la configuration Cloudflare pour confirmer que `cdn.yukpomnang.com` pointe vers AWS (CloudFront ou S3).

---

## ✅ Vérifications Effectuées

### 1. Configuration DNS

**Résultat** :
- ✅ `cdn.yukpomnang.com` pointe vers **Cloudflare** (A record avec proxy)
- IPs Cloudflare détectées : `104.21.28.135`, `172.67.170.213`
- Type : A record (pas de CNAME)

### 2. Réponse HTTP

**Résultat** :
- Status : `403 Forbidden` (normal pour un CDN sans chemin spécifique)
- En-têtes Cloudflare détectés : `CF-RAY`, `Server-Timing`
- ✅ Confirme que le trafic passe bien par Cloudflare

---

## ⚠️ Limitation

**Impossible de vérifier directement l'origine** sans :
- Credentials Cloudflare API, OU
- Accès au Dashboard Cloudflare

---

## 🔧 Méthodes de Vérification

### Méthode 1 : Cloudflare Dashboard (Recommandée)

**Étapes** :

1. **Accéder au Dashboard** :
   - URL : https://dash.cloudflare.com
   - Se connecter avec votre compte Cloudflare

2. **Sélectionner le domaine** :
   - Aller dans **Domaines** → **yukpomnang.com**

3. **Vérifier les DNS Records** :
   - Onglet **DNS** → **Records**
   - Chercher le record `cdn` (ou `cdn.yukpomnang.com`)
   - Vérifier :
     - **Type** : A (proxied) ou CNAME
     - **Proxy status** : Proxied (orange cloud) ✅

4. **Vérifier l'origine (Origin Server)** :
   - Onglet **SSL/TLS** → **Origin Server**
   - Vérifier l'**Origin Certificate** ou la configuration
   - OU aller dans **Workers & Pages** → **Routes** pour voir les routes configurées

5. **Vérifier les Workers/Routes (si utilisés)** :
   - Onglet **Workers & Pages**
   - Chercher des routes pour `cdn.yukpomnang.com/*`
   - Vérifier l'origine configurée dans les routes

6. **Vérifier les Page Rules (si utilisés)** :
   - Onglet **Rules** → **Page Rules**
   - Chercher des règles pour `cdn.yukpomnang.com/*`
   - Vérifier les redirections ou transformations

---

### Méthode 2 : API Cloudflare (Si credentials disponibles)

**Prérequis** :
- `CLOUDFLARE_API_TOKEN` (token API avec permissions)
- `CLOUDFLARE_ZONE_ID` (ID de la zone yukpomnang.com)

**Commandes** :

```powershell
# Récupérer le Zone ID
$zoneId = "VOTRE_ZONE_ID"
$apiToken = "VOTRE_API_TOKEN"

# Vérifier les DNS records
$headers = @{
    "Authorization" = "Bearer $apiToken"
    "Content-Type" = "application/json"
}
$dnsRecords = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?name=cdn.yukpomnang.com" -Headers $headers -Method Get
$dnsRecords.result | Format-Table name, type, content, proxied

# Vérifier les Workers Routes (si utilisés)
$routes = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/workers/routes" -Headers $headers -Method Get
$routes.result | Where-Object { $_.pattern -like "*cdn.yukpomnang.com*" } | Format-Table pattern, script
```

---

### Méthode 3 : Test Indirect

**Tester l'accès à un fichier** :

```powershell
# Tester l'accès à un fichier spécifique
$testUrl = "https://cdn.yukpomnang.com/test.txt"
try {
    $response = Invoke-WebRequest -Uri $testUrl -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Headers:"
    $response.Headers | Format-List
    
    # Vérifier les en-têtes qui indiquent l'origine
    if ($response.Headers['X-Amz-Request-Id']) {
        Write-Host "✅ Origine: AWS S3" -ForegroundColor Green
    }
    if ($response.Headers['X-Cache']) {
        Write-Host "✅ Origine: CloudFront" -ForegroundColor Green
    }
    if ($response.Headers['Server'] -like "*CloudFront*") {
        Write-Host "✅ Origine: CloudFront" -ForegroundColor Green
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## 🎯 Origines Attendues

### Option 1 : CloudFront (Recommandé)

**Distributions CloudFront disponibles** :
- `d1tbx3th3llqe7.cloudfront.net` → Origin: `yukpomnang-static.s3.us-east-1.amazonaws.com`
- `d3jyvgg46kev8.cloudfront.net` → Origin: `yukpomnang-media-prod.s3.us-east-1.amazonaws.com`

**Configuration Cloudflare** :
- CNAME : `cdn.yukpomnang.com` → `d1tbx3th3llqe7.cloudfront.net` (proxied)
- OU A record avec proxy vers CloudFront

### Option 2 : S3 Directement

**Buckets S3 disponibles** :
- `yukpomnang-static.s3.us-east-1.amazonaws.com`
- `yukpomnang-media-prod.s3.us-east-1.amazonaws.com`

**Configuration Cloudflare** :
- CNAME : `cdn.yukpomnang.com` → `yukpomnang-static.s3.us-east-1.amazonaws.com` (proxied)

---

## ✅ Checklist de Vérification

- [ ] DNS record `cdn` configuré dans Cloudflare
- [ ] Proxy activé (orange cloud) ✅
- [ ] Origine pointant vers CloudFront OU S3
- [ ] SSL/TLS configuré (Full ou Full Strict)
- [ ] Cache configuré correctement
- [ ] Headers CORS configurés si nécessaire

---

## 📝 Notes

- Le **403 Forbidden** est normal si aucun fichier n'est accessible à la racine
- Les en-têtes `CF-RAY` confirment que le trafic passe par Cloudflare
- Pour vérifier l'origine, il faut soit :
  - Accéder au Dashboard Cloudflare
  - Utiliser l'API Cloudflare avec credentials
  - Tester l'accès à un fichier spécifique et analyser les en-têtes

---

## 🚀 Prochaines Étapes

1. **Accéder au Dashboard Cloudflare** pour vérifier la configuration
2. **Vérifier que l'origine pointe vers AWS** (CloudFront ou S3)
3. **Tester l'accès à un fichier** pour confirmer que tout fonctionne
4. **Mettre à jour la documentation** avec la configuration réelle

---

**Date** : 2026-01-31  
**Statut** : ⚠️ Vérification manuelle requise dans Cloudflare Dashboard



