# 🚀 Instructions Finales : Création .env sur Hetzner

## ✅ Statut

- ✅ **28 variables AWS récupérées** depuis SSM Parameter Store
- ✅ **Script bash généré** : `create-env-hetzner.sh`
- ✅ **Variables adaptées** pour Hetzner (PostgreSQL, Redis, Wasabi, URLs)

## ⚠️ Problème SSH

Les connexions SSH depuis Windows PowerShell se bloquent avec timeout. Solution : exécution manuelle rapide (1 minute).

## 🎯 Solution Rapide (2 commandes)

### Étape 1 : Copier le script sur Hetzner

```powershell
scp create-env-hetzner.sh root@46.224.14.85:/tmp/
```

### Étape 2 : Exécuter sur Hetzner

```bash
ssh root@46.224.14.85
bash /tmp/create-env-hetzner.sh
```

C'est tout ! Le fichier `.env` sera créé dans `/opt/yukpo/.env` avec toutes les variables.

## 📋 Alternative : Copier-coller direct

Si `scp` ne fonctionne pas :

1. Ouvrez `create-env-hetzner.sh` dans un éditeur de texte
2. Copiez **tout le contenu**
3. Connectez-vous : `ssh root@46.224.14.85`
4. Créez le fichier :
   ```bash
   nano /tmp/create-env-hetzner.sh
   # Collez le contenu (Ctrl+Shift+V ou clic droit)
   # Sauvegarder : Ctrl+X, puis Y, puis Enter
   ```
5. Exécutez : `bash /tmp/create-env-hetzner.sh`

## ✅ Vérification

Après exécution, vérifiez :

```bash
# Vérifier que le fichier existe
ls -la /opt/yukpo/.env

# Vérifier le nombre de variables (devrait être ~30+)
wc -l /opt/yukpo/.env

# Voir les premières lignes
head -20 /opt/yukpo/.env
```

## 📝 Variables incluses

Le script inclut :
- ✅ DATABASE_URL (postgres:5432)
- ✅ REDIS_URL (redis:6379)
- ✅ S3/Wasabi (endpoint, clés, bucket)
- ✅ URLs Hetzner (LiveKit, SRS, Video Renderer)
- ✅ Toutes les clés API (OpenAI, Sora, Google Maps, etc.)
- ✅ Variables de sécurité (JWT_SECRET, tokens)
- ✅ Variables de base (HOST, PORT, ENVIRONMENT, RUST_LOG)

## 🔄 Après création du .env

1. Redémarrer les services Docker si nécessaire
2. Vérifier les logs : `docker-compose logs backend`
3. Tester la connexion à la base de données

---

**Temps estimé : 1-2 minutes** ⏱️

