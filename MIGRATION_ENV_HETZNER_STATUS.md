# 📊 Statut Migration Variables d'Environnement vers Hetzner

## ✅ Ce qui a été fait

1. **Récupération complète des variables AWS** ✅
   - 28 variables récupérées depuis AWS SSM Parameter Store
   - Variables depuis Secrets Manager (si disponibles)
   - Variables depuis ECS Task Definition

2. **Adaptation pour Hetzner** ✅
   - `DATABASE_URL` → `postgresql://user:pass@postgres:5432/dbname`
   - `REDIS_URL` → `redis://redis:6379/0`
   - S3 → Wasabi (endpoint, clés, bucket)
   - URLs → Hetzner (LiveKit, SRS, Video Renderer)

3. **Script bash généré** ✅
   - Fichier: `create-env-hetzner.sh`
   - Contient toutes les variables adaptées
   - Prêt à être exécuté sur Hetzner

## ⚠️ Problème rencontré

Les connexions SSH depuis Windows PowerShell se bloquent avec timeout, même avec des timeouts explicites. Cela est dû à des problèmes de connexion réseau ou de configuration SSH.

## 🚀 Solution : Exécution manuelle (rapide)

### Option 1 : Via SCP (recommandé)

```powershell
# Depuis votre machine Windows
scp create-env-hetzner.sh root@46.224.14.85:/tmp/

# Puis connectez-vous et exécutez
ssh root@46.224.14.85
bash /tmp/create-env-hetzner.sh
```

### Option 2 : Copier-coller direct

1. Ouvrez `create-env-hetzner.sh` dans un éditeur
2. Copiez tout le contenu
3. Connectez-vous à Hetzner : `ssh root@46.224.14.85`
4. Collez le contenu dans un fichier :
   ```bash
   nano /tmp/create-env-hetzner.sh
   # Collez le contenu, puis Ctrl+X, Y, Enter
   ```
5. Exécutez : `bash /tmp/create-env-hetzner.sh`

### Option 3 : Création directe du .env

Si vous préférez créer directement le fichier `.env` :

1. Connectez-vous à Hetzner : `ssh root@46.224.14.85`
2. Créez le répertoire : `mkdir -p /opt/yukpo && cd /opt/yukpo`
3. Ouvrez le fichier `create-env-hetzner.sh` localement et copiez la section entre `cat > .env << 'ENVEOF'` et `ENVEOF`
4. Collez dans un fichier `.env` sur Hetzner

## 📋 Variables incluses

Le script inclut toutes les variables nécessaires :
- ✅ Variables de base (HOST, PORT, ENVIRONMENT, RUST_LOG)
- ✅ DATABASE_URL (adapté pour Docker postgres:5432)
- ✅ REDIS_URL (adapté pour Docker redis:6379)
- ✅ S3/Wasabi (endpoint, clés, bucket, région)
- ✅ URLs Hetzner (LiveKit, SRS, Video Renderer)
- ✅ Toutes les clés API (OpenAI, Sora, Google Maps, etc.)
- ✅ Variables de sécurité (JWT_SECRET, tokens)
- ✅ Variables de gratuité (LAUNCH_PHASE_START_DATE, etc.)

## 🔄 Prochaines étapes

Une fois le fichier `.env` créé sur Hetzner :

1. Vérifiez que le fichier existe : `ls -la /opt/yukpo/.env`
2. Vérifiez le contenu : `head -20 /opt/yukpo/.env`
3. Redémarrez les services Docker si nécessaire
4. Vérifiez les logs : `docker-compose logs backend`

## 📝 Note

Le fichier `create-env-hetzner.sh` est prêt et contient toutes les variables nécessaires. La seule étape restante est de l'exécuter sur Hetzner, ce qui prend moins d'une minute.

