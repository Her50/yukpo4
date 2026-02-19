# 🔑 Instructions : Création Token Cloudflare pour DNS

**Date**: 2026-02-14  
**Objectif**: Créer un token API Cloudflare pour configurer automatiquement le DNS

---

## 📋 Étapes pour Créer le Token

### Étape 1 : Cliquer sur "Créer un jeton"

Dans le dashboard Cloudflare (section "Jetons API"), cliquez sur le bouton bleu **"Créer un jeton"** (en haut à droite de la section "Jetons API").

### Étape 2 : Utiliser un Template

1. Dans la page de création, vous verrez des templates prédéfinis
2. **Recommandé** : Cliquez sur **"Modifier le DNS de la zone"** (Edit zone DNS)
   - OU cherchez "Zone DNS Edit" dans les templates

### Étape 3 : Configurer les Permissions

Si vous créez un token personnalisé :

1. **Nom du jeton** : `yukpo-dns-config` (ou un nom de votre choix)

2. **Permissions** :
   - **Zone** → **DNS** → **Modifier** (Edit)
   - OU sélectionnez toutes les permissions DNS si nécessaire

3. **Ressources de zone** :
   - Sélectionnez **"Inclure"** (Include)
   - **Zone spécifique** → Sélectionnez `yukpomnang.com`

4. **Ressources de compte** :
   - Laissez par défaut (pas nécessaire pour DNS)

### Étape 4 : Créer et Copier le Token

1. Cliquez sur **"Continuer vers le résumé"** (Continue to summary)
2. Vérifiez les permissions
3. Cliquez sur **"Créer un jeton"**
4. **⚠️ IMPORTANT** : Copiez le token immédiatement (il ne sera affiché qu'une seule fois !)
   - Le token ressemble à : `abc123def456ghi789jkl012mno345pqr678stu901vwx234yz`

---

## 🚀 Utilisation du Token

Une fois le token créé, exécutez cette commande :

```powershell
cd C:\Users\23767\yukpomnang2
powershell -ExecutionPolicy Bypass -File scripts\configurer-dns-cloudflare-powershell.ps1 `
    -Subdomain "api" `
    -TargetIP "54.171.220.203" `
    -CloudflareAPIKey "VOTRE_TOKEN_ICI"
```

**Remplacez `VOTRE_TOKEN_ICI` par le token que vous venez de copier.**

---

## ✅ Vérification

Après exécution, le script va :
1. ✅ Se connecter à l'API Cloudflare
2. ✅ Trouver la zone `yukpomnang.com`
3. ✅ Créer ou mettre à jour l'enregistrement A pour `api.yukpomnang.com`
4. ✅ Pointer vers l'IP du backend : `54.171.220.203`

Attendez 2-5 minutes pour la propagation DNS, puis testez :
```powershell
nslookup api.yukpomnang.com
```

---

## 🔒 Sécurité

- ⚠️ Ne partagez jamais votre token API
- ⚠️ Le token donne accès à la modification du DNS de votre domaine
- ⚠️ Si le token est compromis, supprimez-le et créez-en un nouveau

---

**Besoin d'aide ?** Dites-moi quand vous avez créé le token et je l'utiliserai pour configurer le DNS automatiquement !



