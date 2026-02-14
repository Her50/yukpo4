# 🌐 Instructions : Configuration DNS Cloudflare

**Date**: 2026-02-14  
**Domaine**: yukpomnang.com (géré par Cloudflare)  
**Sous-domaine**: api.yukpomnang.com

---

## ✅ État Actuel

- **Nameservers**: `isaac.ns.cloudflare.com` et `jillian.ns.cloudflare.com`
- **Backend IP**: `52.211.202.11:8080`
- **Statut**: Le domaine est géré par Cloudflare

---

## 🎯 Action Requise : Configurer api.yukpomnang.com

### Option 1 : Configuration Manuelle (Recommandé)

1. **Aller sur Cloudflare Dashboard** :
   - URL : https://dash.cloudflare.com
   - Se connecter avec votre compte Cloudflare

2. **Sélectionner le domaine** :
   - Cliquer sur `yukpomnang.com`

3. **Aller dans DNS** :
   - Menu de gauche → **DNS** → **Enregistrements**

4. **Créer/Modifier l'enregistrement** :
   - Si l'enregistrement `api` existe déjà, cliquer sur l'icône **✏️ (Modifier)**
   - Si l'enregistrement n'existe pas, cliquer sur **+ Ajouter un enregistrement**

5. **Configurer l'enregistrement** :
   ```
   Type: A
   Nom: api
   IPv4: 52.211.202.11
   Proxy: ⚠️ DÉSACTIVÉ (nuage gris, pas orange)
   TTL: Auto
   ```

6. **⚠️ IMPORTANT** : Désactiver le proxy (nuage gris)
   - Si le proxy est activé (nuage orange), les requêtes passent par Cloudflare
   - Cela peut causer des problèmes avec les webhooks et l'authentification OAuth
   - Pour `api.yukpomnang.com`, le proxy doit être **DÉSACTIVÉ**

7. **Sauvegarder** :
   - Cliquer sur **Enregistrer**

8. **Attendre la propagation** :
   - Généralement 2-5 minutes
   - Tester avec : `nslookup api.yukpomnang.com`

---

### Option 2 : Configuration Automatique (Avec API)

Si vous avez un **API Token Cloudflare** :

1. **Créer un API Token** :
   - Aller sur : https://dash.cloudflare.com/profile/api-tokens
   - Cliquer sur **Créer un token**
   - Permissions : **Zone DNS Edit**
   - Zone Resources : **Inclure** → `yukpomnang.com`

2. **Utiliser le script** :
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\configurer-dns-cloudflare-automatique.ps1 `
     -CloudflareAPIKey "VOTRE_TOKEN" `
     -Subdomain "api" `
     -TargetIP "52.211.202.11"
   ```

   **OU avec Global API Key** :
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\configurer-dns-cloudflare-automatique.ps1 `
     -CloudflareEmail "votre@email.com" `
     -CloudflareAPIKey "VOTRE_GLOBAL_API_KEY" `
     -Subdomain "api" `
     -TargetIP "52.211.202.11"
   ```

---

## ⚠️ Notes Importantes

### Proxy Cloudflare

- **Proxy DÉSACTIVÉ** (nuage gris) : Les requêtes vont directement au backend AWS
  - ✅ Fonctionne avec webhooks
  - ✅ Fonctionne avec OAuth
  - ✅ Pas de cache Cloudflare

- **Proxy ACTIVÉ** (nuage orange) : Les requêtes passent par Cloudflare
  - ⚠️ Peut causer des problèmes avec webhooks
  - ⚠️ Peut causer des problèmes avec OAuth
  - ✅ Protection DDoS
  - ✅ Cache Cloudflare

**Recommandation** : Pour `api.yukpomnang.com`, **désactiver le proxy**.

### IP Changeante

⚠️ **Attention** : L'IP `52.211.202.11` peut changer à chaque redémarrage ECS.

**Solution** : Activer le Load Balancer (déjà configuré dans Terraform) :
1. Appliquer Terraform : `cd infra/aws && terraform apply`
2. Récupérer le DNS du Load Balancer
3. Mettre à jour Cloudflare pour pointer vers le Load Balancer (CNAME au lieu de A)

---

## 🔍 Vérification

Après configuration, tester :

```bash
# Vérifier la résolution DNS
nslookup api.yukpomnang.com

# Vérifier l'accès HTTP
curl https://api.yukpomnang.com/health

# Vérifier que le proxy est désactivé
# L'IP retournée doit être 52.211.202.11 (pas une IP Cloudflare)
```

---

## 📝 Checklist

- [ ] Se connecter à Cloudflare Dashboard
- [ ] Sélectionner le domaine `yukpomnang.com`
- [ ] Aller dans DNS → Enregistrements
- [ ] Créer/Modifier l'enregistrement `api`
- [ ] Type : A
- [ ] IPv4 : `52.211.202.11`
- [ ] Proxy : **DÉSACTIVÉ** (nuage gris)
- [ ] TTL : Auto
- [ ] Sauvegarder
- [ ] Attendre 2-5 minutes
- [ ] Tester avec `nslookup api.yukpomnang.com`
- [ ] Tester avec `curl https://api.yukpomnang.com/health`

---

**Document généré le**: 2026-02-14

