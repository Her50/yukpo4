# Explication - Message "AWS Cloud" dans les Logs GCP

**Date** : 18 Février 2026 01:35

## 🚨 Problème Identifié

Dans les logs Cloud Run (GCP), on voit le message :
```
🚀 Démarrage de Yukpomnang Backend - AWS Cloud...
```

Alors que l'application est déployée sur **Google Cloud Platform**, pas AWS.

## 🔍 Cause du Problème

### Configuration du Dockerfile

Le `Dockerfile.cloud.optimized` utilise cette logique :
```dockerfile
ENTRYPOINT ["/bin/bash", "-c", "if [ \"$CLOUD_RUN\" = \"true\" ]; then /app/startup-wrapper.sh; else /app/start-cloud.sh; fi"]
```

**Logique** :
- Si `CLOUD_RUN=true` → Utilise `startup-wrapper.sh` (pour Cloud Run)
- Sinon → Utilise `start-cloud.sh` (pour AWS ECS)

### Pourquoi le Message "AWS Cloud" Apparaît

Le message "🚀 Démarrage de Yukpomnang Backend - AWS Cloud..." vient de `start-cloud.sh` ligne 6.

**Causes possibles** :
1. **`CLOUD_RUN` n'est pas défini** au moment où l'ENTRYPOINT s'exécute
2. **`CLOUD_RUN` n'est pas `"true"`** (peut-être `"True"` ou autre valeur)
3. **Le script `start-cloud.sh` est appelé** au lieu de `startup-wrapper.sh`

### Vérification

Dans le workflow GitHub Actions, `CLOUD_RUN` est bien défini :
```yaml
"CLOUD_RUN": "true",
```

Mais il est possible que :
- La variable n'est pas propagée correctement
- L'ENTRYPOINT s'exécute avant que la variable soit disponible
- Il y a un problème de timing

## ✅ Solution Appliquée

### Correction du Script `start-cloud.sh`

Le script détecte maintenant automatiquement l'environnement :

```bash
# Détecter l'environnement cloud
if [ "$CLOUD_RUN" = "true" ]; then
    echo "🚀 Démarrage de Yukpomnang Backend - Google Cloud Run..."
elif [ -n "$AWS_REGION" ] || [ -n "$ECS_CONTAINER_METADATA_URI" ]; then
    echo "🚀 Démarrage de Yukpomnang Backend - AWS Cloud..."
else
    echo "🚀 Démarrage de Yukpomnang Backend..."
fi
```

**Avantages** :
- Détection automatique de l'environnement
- Message adapté selon l'environnement
- Plus de confusion entre AWS et GCP

## 📋 Vérifications à Faire

1. **Vérifier que `CLOUD_RUN=true` est bien défini** dans Cloud Run
2. **Vérifier que `startup-wrapper.sh` est utilisé** (pas `start-cloud.sh`)
3. **Vérifier les logs** pour confirmer que le bon script est appelé

## 🔧 Commandes de Vérification

```bash
# Vérifier la variable CLOUD_RUN dans Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" \
  | grep CLOUD_RUN

# Vérifier les logs pour voir quel script est appelé
gcloud logging read 'textPayload:"WRAPPER" OR textPayload:"start-cloud"' --limit=10
```

## 📝 Notes

- Le script `start-cloud.sh` est conçu pour **AWS ECS/Fargate**
- Le script `startup-wrapper.sh` est conçu pour **Google Cloud Run**
- L'ENTRYPOINT du Dockerfile choisit automatiquement le bon script selon `CLOUD_RUN`
- Si `CLOUD_RUN` n'est pas défini, `start-cloud.sh` sera utilisé par défaut (d'où le message "AWS Cloud")


