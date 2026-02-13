# 📋 Plan d'Action en Attendant l'Activation du Load Balancer

## 🎯 Objectif

Préparer tout ce qui est possible pendant que AWS Support active Elastic Load Balancing (24-48h).

---

## ✅ Tâches Immédiates (Aujourd'hui)

### 1. 🔴 PRIORITÉ : Résoudre le Problème des Images Produits

**Problème :** Les images ne s'affichent pas lors des recherches.

**Cause probable :** `UPLOAD_BASE_URL` non configuré sur le serveur actuel.

**Action :**
1. Se connecter au serveur backend actuel (Hetzner ou autre)
2. Vérifier : `env | grep UPLOAD_BASE_URL`
3. Si vide, configurer :
   ```bash
   # Pour Wasabi
   export UPLOAD_BASE_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
   
   # Redémarrer le backend
   ```
4. Tester une recherche de produits
5. Vérifier que les images s'affichent

**Temps estimé :** 10 minutes

---

### 2. Configurer les Variables SSM Parameter Store

**Action :**
1. Créer un bucket S3 pour les médias (ou utiliser Wasabi)
2. Configurer toutes les variables dans SSM Parameter Store :
   - `S3_BUCKET`
   - `S3_REGION`
   - `S3_ACCESS_KEY` (SecureString)
   - `S3_SECRET_KEY` (SecureString)
   - `UPLOAD_BASE_URL` (CRITIQUE)
   - `LAUNCH_PHASE_START_DATE`

**Voir :** `CONFIGURER_VARIABLES_ENVIRONNEMENT_AWS.md`

**Temps estimé :** 15 minutes

---

### 3. Créer le Bucket S3 pour les Médias

**Action :**
1. Allez dans S3 : https://console.aws.amazon.com/s3/
2. Créez un bucket : `yukpo-backend-media`
3. Région : `eu-west-1`
4. Configurez les permissions :
   - Activer l'accès public (ou utiliser CloudFront)
   - Configurer CORS
5. Notez l'ARN du bucket

**Temps estimé :** 10 minutes

---

### 4. Préparer les Migrations

**Action :**
1. Vérifier que le script `scripts/run_migrations_aws.py` est à jour
2. Tester la connexion à RDS :
   ```bash
   # Récupérer DATABASE_URL depuis SSM
   aws ssm get-parameter \
     --name "/yukpo/production/DATABASE_URL" \
     --with-decryption \
     --region eu-west-1 \
     --query 'Parameter.Value' \
     --output text
   ```
3. Tester la connexion :
   ```bash
   psql "DATABASE_URL_RECUPEREE"
   ```

**Temps estimé :** 15 minutes

---

## 🔄 Tâches de Préparation (Cette Semaine)

### 5. Tester le Build Docker Localement

**Action :**
1. Build l'image Docker :
   ```bash
   cd backend
   docker build -f Dockerfile.cloud.optimized -t yukpo-backend:test .
   ```
2. Vérifier que l'image se construit sans erreur
3. Tester l'image localement :
   ```bash
   docker run -p 8080:8080 \
     -e DATABASE_URL="postgresql://..." \
     -e REDIS_URL="redis://..." \
     yukpo-backend:test
   ```

**Temps estimé :** 30 minutes

---

### 6. Préparer GitHub Actions

**Action :**
1. Vérifier que les secrets GitHub sont configurés :
   - `AWS_ACCESS_KEY_ID` ✅ (déjà fait)
   - `AWS_SECRET_ACCESS_KEY` ✅ (déjà fait)
2. Tester le workflow manuellement :
   - GitHub > Actions > "Docker Build Optimized"
   - "Run workflow" > Cocher "Push to AWS ECR"
3. Vérifier que l'image est pushée dans ECR

**Temps estimé :** 20 minutes

---

### 7. Configurer CloudFront (Optionnel mais Recommandé)

**Action :**
1. Créer une distribution CloudFront pointant vers le bucket S3
2. Configurer OAI (Origin Access Identity) pour la sécurité
3. Mettre à jour `UPLOAD_BASE_URL` avec l'URL CloudFront
4. Avantages :
   - ✅ CDN global (meilleure latence pour l'Afrique)
   - ✅ HTTPS automatique
   - ✅ Cache intelligent

**Temps estimé :** 30 minutes

---

## ⏳ En Attendant AWS Support (24-48h)

### 8. Surveiller le Case AWS Support

**Action :**
1. Vérifier régulièrement le statut du case
2. Répondre rapidement si AWS demande des informations supplémentaires
3. Une fois activé, relancer `terraform apply`

---

## 🚀 Une Fois le Load Balancer Activé

### 9. Finaliser le Déploiement Terraform

**Action :**
```bash
cd infra/aws
terraform apply
```

Cela créera :
- ✅ Application Load Balancer
- ✅ ECS Service
- ✅ Auto-scaling policies
- ✅ Health checks

---

### 10. Tester l'Application

**Action :**
1. Récupérer l'URL du Load Balancer :
   ```bash
   terraform output alb_dns_name
   ```
2. Tester l'endpoint `/health`
3. Tester une recherche de produits
4. Vérifier que les images s'affichent

---

## 📊 Résumé des Priorités

### 🔴 URGENT (Aujourd'hui)
1. ✅ Résoudre le problème des images (`UPLOAD_BASE_URL`)
2. ✅ Configurer les variables SSM Parameter Store
3. ✅ Créer le bucket S3

### 🟠 IMPORTANT (Cette Semaine)
4. ✅ Préparer les migrations
5. ✅ Tester le build Docker
6. ✅ Préparer GitHub Actions

### 🟢 OPTIONNEL (Amélioration)
7. ✅ Configurer CloudFront
8. ✅ Optimiser les performances

---

## ⏱️ Temps Total Estimé

- **Urgent :** ~35 minutes
- **Important :** ~1h30
- **Optionnel :** ~30 minutes

**Total :** ~2h35 de travail préparatoire

---

## ✅ Checklist Complète

- [ ] Résoudre problème images (`UPLOAD_BASE_URL`)
- [ ] Créer bucket S3
- [ ] Configurer variables SSM Parameter Store
- [ ] Tester connexion RDS
- [ ] Tester build Docker
- [ ] Tester GitHub Actions workflow
- [ ] Configurer CloudFront (optionnel)
- [ ] Surveiller case AWS Support
- [ ] Relancer Terraform une fois Load Balancer activé
- [ ] Tester l'application complète

---

## 💡 Note

Pendant que vous attendez le Load Balancer, vous pouvez :
- ✅ Résoudre le problème des images (action immédiate)
- ✅ Préparer toute l'infrastructure
- ✅ Tester les builds et migrations
- ✅ Configurer CloudFront pour améliorer les performances

**Une fois le Load Balancer activé, le déploiement final prendra seulement 5-10 minutes !** 🚀

