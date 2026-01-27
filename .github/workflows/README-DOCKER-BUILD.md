# 🚀 Docker Build Optimized - Documentation

## Vue d'ensemble

Ce workflow GitHub Actions build automatiquement l'image Docker optimisée du backend et la pousse vers :
- **GitHub Container Registry (ghcr.io)** : Pour tous les builds
- **AWS ECR** : Automatiquement pour les pushes sur `main`, ou manuellement via `workflow_dispatch`

## Optimisations

### Réduction de taille
- **Avant** : ~2.4GB
- **Après** : ~328MB
- **Réduction** : ~87%

### Accélération des builds
- **Cache GitHub Actions** : Cache des layers Docker entre les builds
- **Cache local BuildKit** : Cache des dépendances Rust (Cargo registry, git, target/)
- **Cache mount** : Utilisation de `--mount=type=cache` dans le Dockerfile pour accélérer les builds
- **Builds incrémentaux** : Seules les couches modifiées sont reconstruites

### Temps de build
- **Premier build** : ~40-45 minutes
- **Builds suivants (avec cache)** : ~10-20 minutes (si seul le code source change)
- **Builds avec changements de dépendances** : ~25-35 minutes

## Déclencheurs

### Automatique
- **Push sur `main`** : Build + Push vers ghcr.io + Push vers AWS ECR
- **Push sur `develop`** : Build + Push vers ghcr.io uniquement
- **Pull Request** : Build uniquement (pas de push)

### Manuel
- **workflow_dispatch** : Permet de déclencher manuellement avec options :
  - `push_to_registry` : Push vers ghcr.io
  - `push_to_aws` : Push vers AWS ECR

## Configuration AWS

### Secrets GitHub requis
Pour que le push vers AWS ECR fonctionne, configurez ces secrets dans GitHub :
- `AWS_ACCESS_KEY_ID` : Clé d'accès AWS
- `AWS_SECRET_ACCESS_KEY` : Clé secrète AWS

### Configuration ECR
- **Account ID** : `846505724644`
- **Region** : `us-east-1` (modifié pour correspondre à ECS)
- **Repository** : `yukpomnang-backend`

## Tags d'image

Les images sont taguées avec :
- `latest` : Pour la branche principale
- `optimized` : Indique que c'est l'image optimisée
- `<branch>-<sha>` : Tag avec le SHA du commit
- `<version>` : Si un tag de version est créé

## Utilisation

### Build local
```bash
cd backend
docker build -f Dockerfile.cloud.optimized -t yukpomnang-backend:optimized .
```

### Pull depuis ghcr.io
```bash
docker pull ghcr.io/<owner>/<repo>/yukpomnang-backend-optimized:latest
```

### Pull depuis AWS ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 846505724644.dkr.ecr.us-east-1.amazonaws.com
docker pull 846505724644.dkr.ecr.us-east-1.amazonaws.com/yukpomnang-backend:latest
```

## Monitoring

### Vérifier le statut
1. Aller dans l'onglet "Actions" de GitHub
2. Sélectionner le workflow "Docker Build Optimized"
3. Voir les logs et le résumé

### Résumé du build
Chaque build génère un résumé avec :
- Taille de l'image
- Tags créés
- Statut du push vers ECR (si applicable)

## Dépannage

### Build échoue
1. Vérifier les logs dans GitHub Actions
2. Vérifier que `.sqlx/` est présent dans le repo
3. Vérifier que `Cargo.toml` et `Cargo.lock` sont à jour

### Push vers ECR échoue
1. Vérifier que les secrets AWS sont configurés
2. Vérifier les permissions IAM de l'utilisateur AWS
3. Vérifier que le repository ECR existe

### Build trop lent
1. Vérifier que le cache GitHub Actions est activé
2. Vérifier que BuildKit est utilisé (activé par défaut dans GitHub Actions)
3. Considérer utiliser un runner auto-hébergé avec plus de ressources

