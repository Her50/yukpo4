# Guide de Démarrage Docker et Services 🐳

## Étape 1 : Démarrer Docker Desktop

### Méthode Automatique
```powershell
.\scripts\start_docker.ps1
```

### Méthode Manuelle
1. Ouvrir le **menu Démarrer** (Windows)
2. Rechercher **"Docker Desktop"**
3. Cliquer sur **"Docker Desktop"**
4. Attendre que l'icône Docker apparaisse dans la **barre des tâches** (en bas à droite)
5. Attendre que l'icône soit **stable** (pas de spinner/animation)

**⏱️ Temps d'attente :** 30-60 secondes pour que Docker soit complètement prêt

---

## Étape 2 : Vérifier que Docker est Prêt

Ouvrir un **nouveau PowerShell** (important : nouveau terminal) et exécuter :

```powershell
docker --version
```

Vous devriez voir : `Docker version 24.x.x` ou similaire

Si vous voyez une erreur, attendez encore quelques secondes et réessayez.

---

## Étape 3 : Démarrer Tous les Services

### Méthode Automatique (Recommandée)
```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\verifier_docker_et_demarrer.ps1
```

Ce script :
- ✅ Vérifie que Docker est accessible
- ✅ Affiche l'état des conteneurs existants
- ✅ Démarre tous les services avec `docker-compose`
- ✅ Vérifie que PostgreSQL et LiveKit sont en cours d'exécution

### Méthode Manuelle
```powershell
cd C:\Users\23767\yukpomnang2
docker-compose up -d
```

---

## Étape 4 : Vérifier l'État des Services

```powershell
# Voir tous les conteneurs
docker ps -a

# Voir les services docker-compose
docker-compose ps

# Voir les logs
docker-compose logs -f
```

---

## Services Disponibles

D'après votre `docker-compose.yml`, les services suivants sont configurés :

1. **PostgreSQL** (`yukpo-postgres`)
   - Port : `5432`
   - Base de données : `yukpomnang`

2. **LiveKit** (`livekit`)
   - Port HTTP : `7880`
   - Port WebRTC : `7881`
   - Port RTP : `7882/udp`

3. **SRS** (Streaming Server)
   - Port RTMP : `1935`
   - Port HLS : `8080`

4. **Backend Rust**
   - Port : `3001`

5. **Frontend React**
   - Port : `3000`

---

## Commandes Utiles

### Démarrer les services
```powershell
docker-compose up -d
```

### Arrêter les services
```powershell
docker-compose down
```

### Redémarrer un service spécifique
```powershell
docker-compose restart livekit
docker-compose restart postgres
```

### Voir les logs
```powershell
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f livekit
docker-compose logs -f postgres
```

### Vérifier le statut
```powershell
docker-compose ps
```

### Démarrer seulement LiveKit
```powershell
.\scripts\restart_livekit.ps1
```

---

## Dépannage

### Docker n'est pas accessible

**Symptôme :** `docker: command not found`

**Solutions :**
1. Vérifier que Docker Desktop est démarré (icône dans la barre des tâches)
2. Attendre 30-60 secondes après le démarrage
3. Ouvrir un **nouveau PowerShell** (le PATH est mis à jour)
4. Redémarrer Docker Desktop si nécessaire

### Conteneur PostgreSQL en erreur

**Symptôme :** `Exited (255)` ou erreurs de permissions

**Solution :**
```powershell
# Arrêter le conteneur
docker stop yukpo-postgres

# Supprimer le conteneur (⚠️ perte de données locales)
docker rm yukpo-postgres

# Redémarrer avec docker-compose
docker-compose up -d postgres
```

### LiveKit ne démarre pas

**Solution :**
```powershell
# Vérifier les logs
docker-compose logs livekit

# Redémarrer LiveKit
.\scripts\restart_livekit.ps1
```

### Port déjà utilisé

**Symptôme :** `port is already allocated`

**Solution :**
```powershell
# Trouver quel processus utilise le port
netstat -ano | findstr :7880

# Arrêter le processus ou changer le port dans docker-compose.yml
```

---

## Vérification Finale

Une fois tout démarré, vérifiez :

1. **PostgreSQL :**
   ```powershell
   docker ps | findstr postgres
   # Devrait afficher "Up" dans la colonne STATUS
   ```

2. **LiveKit :**
   ```powershell
   curl http://localhost:7880/
   # Devrait répondre (même avec une erreur 404, c'est OK)
   ```

3. **Tous les services :**
   ```powershell
   docker-compose ps
   # Tous les services devraient être "Up"
   ```

---

**Date de création :** 2025-11-28

