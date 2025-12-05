# 🚀 Configuration Automatique Cloudflare → Wasabi

## Script PowerShell

Un script a été créé pour configurer automatiquement Cloudflare :
**`scripts/configure-cloudflare-wasabi.ps1`**

## 📋 Prérequis

1. **Cloudflare API Token** :
   - https://dash.cloudflare.com/profile/api-tokens
   - Créez un token avec permissions :
     - ✅ **Workers:Edit**
     - ✅ **Zone:Edit**
     - ✅ **Account:Read**

2. **Zone ID** :
   - Cloudflare Dashboard → `yukpomnang.com` → Overview
   - Copiez le **Zone ID** (affiché sur la droite)

3. **Account ID** :
   - Cloudflare Dashboard → Workers & Pages
   - Copiez l'**Account ID** (en haut à droite)

## 🎯 Utilisation

### Option 1 : Exécution interactive

```powershell
cd scripts
.\configure-cloudflare-wasabi.ps1
```

Le script vous demandera les credentials.

### Option 2 : Avec paramètres

```powershell
.\configure-cloudflare-wasabi.ps1 `
    -CloudflareApiToken "votre-token" `
    -ZoneId "votre-zone-id" `
    -AccountId "votre-account-id" `
    -Domain "yukpomnang.com" `
    -CdnSubdomain "cdn" `
    -WasabiOrigin "https://yukpo-video-prod.s3.eu-central-1.wasabisys.com"
```

## ✅ Ce que fait le script

1. ✅ **Vérifie/crée le CNAME DNS** pour `cdn.yukpomnang.com`
2. ✅ **Crée/met à jour le Worker** `cdn-video-proxy`
3. ✅ **Configure la route** `cdn.yukpomnang.com/*` → Worker
4. ✅ **Teste la configuration**

## 🔍 Vérification

Après exécution, attendez 2-5 minutes puis testez :

```bash
# Test DNS
nslookup cdn.yukpomnang.com

# Test Worker
curl -I https://cdn.yukpomnang.com
```

## ⚠️ Si le script échoue

Si l'API ne fonctionne pas, configurez manuellement :

1. **Worker** : Cloudflare Dashboard → Workers & Pages → Create Worker
   - Nom : `cdn-video-proxy`
   - Code : Voir `CONFIGURATION_CLOUDFLARE_WORKER.md`

2. **Route** : Workers → Triggers → Routes
   - Pattern : `cdn.yukpomnang.com/*`
   - Worker : `cdn-video-proxy`

## 📝 Notes

- Le Worker peut prendre quelques minutes à se propager
- Vérifiez les logs dans Cloudflare Dashboard si problème
- Le script sauvegarde le code Worker dans un fichier temporaire si l'upload API échoue



