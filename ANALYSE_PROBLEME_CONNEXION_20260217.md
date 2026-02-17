# Analyse Problème Connexion - 2026-02-17

**Date**: 2026-02-17  
**Problème**: Impossible de se connecter à l'application mobile

---

## 🔍 Problèmes Identifiés dans les Logs

### 1. ❌ Erreur Critique : Port 8080 Occupé

**Erreur** :
```
[MAIN] ❌ ERREUR CRITIQUE: Impossible de bind serveur minimal sur 0.0.0.0:8080 après 10 tentatives - Address already in use (os error 98)
```

**Cause** :
- Le serveur Python minimal (démarré par `startup-wrapper.sh`) occupe le port 8080
- Rust essaie de créer son propre serveur minimal et ne peut pas bind sur le port
- Le wrapper tue le serveur Python APRÈS que Rust ait échoué

**Impact** :
- L'application Rust ne démarre pas correctement
- Les requêtes `/api/auth/login` retournent **501** (Not Implemented)
- L'application n'est pas accessible

---

### 2. ✅ Variables d'Environnement Présentes

D'après les logs :
- ✅ `DATABASE_URL: ✅ Présente`
- ✅ `MONGODB_URL: ✅ Présente`
- ✅ `REDIS_URL: ✅ Présente`
- ✅ `JWT_SECRET: ✅ Présente`

**Conclusion** : Les secrets sont bien chargés, ce n'est pas un problème de variables.

---

### 3. ❌ Erreur 501 sur `/api/auth/login`

**Erreur** :
```json
{
  "requestUrl": "https://yukpo-backend-376093909298.europe-west1.run.app/api/auth/login",
  "status": 501,
  "responseSize": "501"
}
```

**Cause** : L'application Rust ne démarre pas à cause du conflit de port, donc les routes ne sont pas disponibles.

---

## ✅ Solutions Appliquées

### Solution 1: Modifier le Wrapper pour Tuer Python AVANT Rust

**Fichier** : `backend/scripts/startup-wrapper.sh`

**Changement** :
1. Démarrer le serveur Python minimal
2. Attendre 5 secondes (Cloud Run détecte le serveur)
3. **Tuer le serveur Python AVANT de démarrer Rust**
4. Démarrer Rust avec `exec` (Rust devient le processus principal)

**Avant** :
```bash
# Rust démarre en arrière-plan
/app/yukpomnang_backend &
# Attendre 10 secondes
# Tuer Python
```

**Après** :
```bash
# Attendre 5 secondes
# Tuer Python
# Démarrer Rust avec exec (processus principal)
exec /app/yukpomnang_backend
```

---

### Solution 2: Rust Attend le Port Libre (Sans Créer de Serveur Minimal)

**Fichier** : `backend/src/main.rs`

**Changement** :
- Si Cloud Run : Rust attend que le port soit libéré (jusqu'à 20 secondes)
- **Ne PAS créer de serveur minimal dans Rust** (le wrapper Python le gère)
- Continuer directement avec les initialisations (dotenv, logging, DB, etc.)

**Avant** :
- Rust essayait de créer un serveur minimal et échouait

**Après** :
- Rust attend que le port soit libre
- Continue sans créer de serveur minimal
- Le serveur complet démarre normalement

---

## 📋 Séquence Corrigée

### Avant (Échec)
```
1. Wrapper démarre serveur Python → Port 8080 occupé
2. Wrapper démarre Rust en arrière-plan
3. Rust essaie de bind → ÉCHEC (port occupé)
4. Wrapper tue Python (trop tard)
5. Rust a déjà échoué → Application ne démarre pas
```

### Après (Succès Attendu)
```
1. Wrapper démarre serveur Python → Port 8080 occupé
2. Attente 5 secondes → Cloud Run détecte le serveur
3. Wrapper tue Python → Port 8080 libéré
4. Wrapper démarre Rust avec exec
5. Rust attend que le port soit libre (vérification)
6. Rust démarre le serveur complet → Application prête
```

---

## ✅ Résultat Attendu

Après ces corrections :
- ✅ Le serveur Python répond aux health checks Cloud Run
- ✅ Le port est libéré avant que Rust ne démarre
- ✅ Rust démarre correctement sans conflit
- ✅ Les routes `/api/auth/login` sont disponibles
- ✅ La connexion mobile fonctionne

---

## 🔍 Vérification

Après le prochain déploiement, vérifier dans les logs :
- ✅ `[WRAPPER] Port libéré, démarrage de Rust...`
- ✅ `[MAIN] ✅ Port 8080 libéré, on peut continuer`
- ✅ Pas d'erreur "Address already in use"
- ✅ Les requêtes `/api/auth/login` retournent 200 ou 401 (pas 501)

---

**Commits** :
- `7c851ac` : Corriger syntaxe Rust + wrapper tue Python avant Rust

