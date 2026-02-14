# 🔧 Instructions : Activer le Proxy Cloudflare pour api.yukpomnang.com

**Date** : 2026-02-14  
**Objectif** : Activer HTTPS automatique via Cloudflare

---

## 🎯 ACTION REQUISE

### Modifier l'Enregistrement DNS "api"

**Dans l'interface Cloudflare** :

1. **Trouver l'enregistrement** :
   - Type : `A` (ou `UN`)
   - Nom : `api`
   - Contenu : `52.215.47.205`
   - Statut du proxy : **DNS uniquement** (nuage gris) ⚠️

2. **Cliquer sur "Modifier"** (bouton à droite de l'enregistrement)

3. **Dans la fenêtre de modification** :
   - **Ne pas changer** le Type (A)
   - **Ne pas changer** le Nom (api)
   - **Ne pas changer** le Contenu (52.215.47.205)
   - **CHANGER** le Statut du proxy :
     - **Actuellement** : DNS uniquement (nuage gris) ❌
     - **Changer pour** : Proxy (nuage orange) ✅

4. **Sauvegarder** les modifications

---

## ✅ RÉSULTAT ATTENDU

**Après modification** :
- Type : `A`
- Nom : `api`
- Contenu : `52.215.47.205`
- Statut du proxy : **Proxy** (nuage orange) ✅
- TTL : Auto

---

## 🔍 VÉRIFICATION

**Après avoir activé le proxy** :

1. **Attendre 1-2 minutes** pour la propagation

2. **Tester HTTPS** :
   ```bash
   curl -v https://api.yukpomnang.com/health
   ```

   **Résultat attendu** :
   - Status: 200 OK
   - Certificat SSL valide (via Cloudflare)

3. **Tester depuis l'application mobile** :
   - Ouvrir l'application mobile
   - Tenter une connexion/requête API
   - Vérifier que ça fonctionne

---

## ⚠️ IMPORTANT

**Pourquoi activer le proxy ?**

- ✅ **HTTPS automatique** : Cloudflare fournit un certificat SSL gratuit
- ✅ **Protection DDoS** : Protection contre les attaques
- ✅ **Cache CDN** : Amélioration des performances
- ✅ **Résout le problème HTTPS** : `https://api.yukpomnang.com` fonctionnera

**Note** : Le proxy Cloudflare est recommandé pour les APIs publiques.

---

## 📊 AVANT/APRÈS

| Élément | Avant | Après |
|---------|-------|-------|
| Statut du proxy | DNS uniquement (gris) | Proxy (orange) |
| HTTPS | ❌ Timeout | ✅ Fonctionnel |
| Certificat SSL | ❌ Aucun | ✅ Cloudflare |
| Protection DDoS | ❌ Aucune | ✅ Cloudflare |

---

**Date** : 2026-02-14  
**Action** : Activer le proxy Cloudflare pour l'enregistrement `api`

