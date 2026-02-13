# 🎯 Solution : Utiliser us-east-1 au lieu de eu-west-1

## 🔍 Découverte

**Différence clé identifiée :**
- **Ancien compte** : Utilisait `us-east-1` (Virginie) ✅
- **Nouveau compte** : Utilise `eu-west-1` (Irlande) ❌

**Hypothèse :** `us-east-1` est souvent moins restrictive pour les nouveaux comptes car c'est la région "par défaut" d'AWS.

---

## ✅ Solution : Changer la Région vers us-east-1

### Avantages de us-east-1

1. **Moins restrictive** pour nouveaux comptes
2. **Plus de services disponibles** immédiatement
3. **Meilleure compatibilité** avec tous les services AWS
4. **L'ancien compte fonctionnait** avec cette région

### Inconvénients

1. ⚠️ **Latence plus élevée** pour utilisateurs en Afrique
   - `us-east-1` → Afrique : ~150-200ms
   - `eu-west-1` → Afrique : ~100-150ms
   - `af-south-1` → Afrique : ~20-50ms

2. ⚠️ **Coûts légèrement différents** (mais généralement similaires)

---

## 🔧 Comment Changer la Région

### Étape 1 : Modifier terraform.tfvars

```hcl
# infra/aws/terraform.tfvars
aws_region = "us-east-1"  # Au lieu de "eu-west-1"
```

### Étape 2 : Modifier GitHub Actions

```yaml
# .github/workflows/docker-build-optimized.yml
env:
  AWS_REGION: us-east-1  # Au lieu de eu-west-1
```

### Étape 3 : Mettre à Jour les Variables SSM

```powershell
# Mettre à jour S3_REGION dans SSM
aws ssm put-parameter `
  --name "/yukpo/production/S3_REGION" `
  --value "us-east-1" `
  --type "String" `
  --region us-east-1 `
  --overwrite

# Mettre à jour UPLOAD_BASE_URL
aws ssm put-parameter `
  --name "/yukpo/production/UPLOAD_BASE_URL" `
  --value "https://yukpo-backend-media.s3.us-east-1.amazonaws.com" `
  --type "String" `
  --region us-east-1 `
  --overwrite
```

### Étape 4 : Supprimer les Ressources dans eu-west-1 (Optionnel)

Si vous voulez tout déplacer vers us-east-1 :

```powershell
cd infra/aws
terraform destroy  # Supprime les ressources dans eu-west-1
```

### Étape 5 : Recréer dans us-east-1

```powershell
cd infra/aws
terraform apply  # Crée tout dans us-east-1
```

---

## ⚠️ Alternative : Garder eu-west-1 et Contacter AWS Support

Si vous préférez garder `eu-west-1` (meilleure latence pour l'Afrique) :

1. **Contacter AWS Support** pour activer ELB dans `eu-west-1`
2. **Délai** : 24-48 heures généralement
3. **Avantage** : Meilleure latence pour vos utilisateurs en Afrique

---

## 🎯 Recommandation

### Option 1 : Changer vers us-east-1 (Rapide)

**Avantages :**
- ✅ Probablement pas besoin d'activation AWS Support
- ✅ Fonctionne immédiatement
- ✅ Même région que l'ancien compte (qui fonctionnait)

**Inconvénients :**
- ⚠️ Latence plus élevée pour l'Afrique

### Option 2 : Garder eu-west-1 (Meilleure Latence)

**Avantages :**
- ✅ Meilleure latence pour l'Afrique
- ✅ Région plus proche de vos utilisateurs

**Inconvénients :**
- ⚠️ Nécessite activation AWS Support (24-48h)
- ⚠️ Attente nécessaire

---

## 💡 Ma Recommandation

**Pour démarrer rapidement :** Utilisez `us-east-1` (comme l'ancien compte).

**Pour optimiser la latence :** Gardez `eu-west-1` et contactez AWS Support.

**Compromis :** Utilisez `us-east-1` maintenant, puis migrez vers `eu-west-1` ou `af-south-1` une fois que tout fonctionne.

---

## 🔄 Migration Future vers af-south-1

Une fois que tout fonctionne dans `us-east-1`, vous pouvez migrer vers `af-south-1` (Cape Town) pour la meilleure latence :

1. Créer les ressources dans `af-south-1`
2. Migrer les données
3. Mettre à jour les DNS
4. Supprimer les ressources dans `us-east-1`

Mais pour l'instant, **us-east-1 est la solution la plus rapide**.

