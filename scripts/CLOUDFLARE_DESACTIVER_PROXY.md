# Instructions pour désactiver le proxy Cloudflare

## ⚠️ ACTION REQUISE : Désactiver le proxy Cloudflare

Le proxy Cloudflare est actuellement **ACTIVÉ** (nuage orange) pour le domaine `yukpomnang.com`. 
Cela empêche l'accès direct au backend AWS.

## 📋 Étapes à suivre

1. **Aller sur le dashboard Cloudflare**
   - URL: https://dash.cloudflare.com
   - Se connecter avec vos identifiants

2. **Sélectionner le domaine**
   - Cliquer sur le domaine `yukpomnang.com`

3. **Aller dans l'onglet DNS**
   - Menu de gauche → **DNS** → **Records**

4. **Trouver l'enregistrement A**
   - Chercher l'enregistrement de type **A** pour `yukpomnang.com`
   - Il devrait pointer vers l'IP de votre ALB AWS

5. **Désactiver le proxy**
   - Si le nuage est **ORANGE** (proxy activé) :
     - Cliquer sur le nuage orange
     - Il devrait passer en **GRIS** (DNS only)
   - Si le nuage est déjà gris, c'est bon !

6. **Attendre la propagation**
   - Attendre 1-2 minutes pour la propagation DNS
   - Vérifier avec : `nslookup yukpomnang.com`
   - L'IP devrait maintenant pointer directement vers AWS (pas vers Cloudflare)

## ✅ Vérification

Après avoir désactivé le proxy, exécuter :

```powershell
.\scripts\auto-fix-backend-access.ps1
```

Le script devrait maintenant détecter que le proxy est désactivé.

## 🔍 Pourquoi désactiver le proxy ?

- Le proxy Cloudflare cache les requêtes et peut bloquer l'accès direct au backend
- Pour les liens partagés à l'extérieur, il faut un accès direct au backend
- Le proxy peut causer des problèmes de connectivité avec les health checks

## 📝 Note

Si vous avez besoin du proxy Cloudflare pour d'autres raisons (DDoS protection, CDN, etc.),
vous pouvez :
- Créer un sous-domaine (ex: `api.yukpomnang.com`) sans proxy pour le backend
- Utiliser le proxy uniquement pour le frontend
- Configurer des règles de page pour désactiver le proxy sur certaines routes



