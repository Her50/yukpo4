# Scripts de Démarrage LiveKit 🚀

## Scripts Disponibles

### 1. `start_livekit.sh` - Démarrage Docker Simple

Démarre LiveKit avec Docker directement.

```bash
./scripts/start_livekit.sh
```

**Fonctionnalités :**
- ✅ Crée automatiquement la configuration
- ✅ Installe Docker si nécessaire
- ✅ Ouvre les ports dans le firewall
- ✅ Démarre le conteneur Docker
- ✅ Vérifie la connexion

---

### 2. `start_livekit_docker_compose.sh` - Démarrage avec docker-compose

Démarre LiveKit avec docker-compose (plus de contrôle).

```bash
./scripts/start_livekit_docker_compose.sh
```

**Fonctionnalités :**
- ✅ Utilise docker-compose pour la gestion
- ✅ Configuration dans `docker-compose.livekit.yml`
- ✅ Healthcheck automatique
- ✅ Réseau dédié

---

## Configuration

Les scripts utilisent les variables d'environnement suivantes (optionnelles) :

```bash
export LIVEKIT_IP="46.224.14.85"
export LIVEKIT_PORT="7880"
export LIVEKIT_API_KEY="APIPHE9xDv5RPaP"
export LIVEKIT_API_SECRET="qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
```

Si non définies, les valeurs par défaut sont utilisées.

---

## Fichiers Créés

- `config/livekit.yaml` - Configuration LiveKit
- `docker-compose.livekit.yml` - Configuration docker-compose

---

## Commandes Utiles

### Docker Simple

```bash
# Logs
docker logs -f livekit-server

# Arrêter
docker stop livekit-server

# Redémarrer
docker restart livekit-server

# Statut
docker ps | grep livekit
```

### Docker Compose

```bash
# Logs
docker-compose -f scripts/docker-compose.livekit.yml logs -f

# Arrêter
docker-compose -f scripts/docker-compose.livekit.yml down

# Redémarrer
docker-compose -f scripts/docker-compose.livekit.yml restart

# Statut
docker-compose -f scripts/docker-compose.livekit.yml ps
```

---

## Vérification

Après le démarrage, le backend détectera automatiquement le serveur lors du prochain diagnostic (dans les 15-20 minutes pour cleanup, 1 minute pour analytics).

---

**Date de création :** 2025-11-28

