# 🔧 Correction Variables d'Environnement Cloud Run

**Date** : 2026-02-14  
**Problème** : `Bad syntax for dict arg: [https://yukpo.com]` dans `--set-env-vars`

---

## 🎯 PROBLÈME IDENTIFIÉ

L'erreur se produit car `--set-env-vars` ne peut pas gérer correctement les valeurs contenant des caractères spéciaux comme :
- Virgules dans les valeurs (ex: `ALLOWED_ORIGINS=https://api.yukpo.com,https://yukpo.com`)
- Caractères spéciaux non échappés

**Erreur** :
```
ERROR: (gcloud.run.deploy) argument --set-env-vars: Bad syntax for dict arg: [https://yukpo.com]
```

---

## ✅ SOLUTION APPLIQUÉE

**Changement** : Utilisation de `--env-vars-file` avec un fichier JSON au lieu de `--set-env-vars`

### Avant (ne fonctionne pas avec valeurs complexes)
```yaml
--set-env-vars "KEY1=value1,KEY2=value,with,commas"
```

### Après (fonctionne avec toutes les valeurs)
```yaml
--env-vars-file env-vars.json
```

Avec `env-vars.json` :
```json
{
  "KEY1": "value1",
  "KEY2": "value,with,commas",
  "ALLOWED_ORIGINS": "https://api.yukpo.com,https://yukpo.com"
}
```

---

## 📋 FICHIERS MODIFIÉS

1. ✅ `.github/workflows/docker-build-optimized.yml`
   - Création d'un fichier JSON `env-vars.json`
   - Utilisation de `--env-vars-file` au lieu de `--set-env-vars`
   - Support de `jq` pour construire le JSON proprement
   - Fallback avec `sed` si `jq` n'est pas disponible

2. ✅ `.github/workflows/gcp-deploy.yml`
   - Même correction appliquée

---

## 🔧 DÉTAILS TECHNIQUES

### Construction du fichier JSON

**Avec jq (recommandé)** :
```bash
echo '{}' | jq \
  --arg db_url "$DATABASE_URL" \
  --arg allowed_origins "https://api.yukpo.com,https://yukpo.com" \
  '. + {
    "DATABASE_URL": $db_url,
    "ALLOWED_ORIGINS": $allowed_origins
  }' > env-vars.json
```

**Sans jq (fallback)** :
```bash
DB_URL_ESCAPED=$(echo "$DATABASE_URL" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
cat > env-vars.json << EOF
{
  "DATABASE_URL": "$DB_URL_ESCAPED",
  "ALLOWED_ORIGINS": "https://api.yukpo.com,https://yukpo.com"
}
EOF
```

### Ajout de variables depuis GitHub Secrets

Le script parcourt tous les secrets avec préfixe `GCP_ENV_` et les ajoute au JSON :

```bash
for secret in $(gh secret list --json name -q '.[].name' | grep "^GCP_ENV_"); do
  VAR_NAME=$(echo $secret | sed 's/^GCP_ENV_//')
  VAR_VALUE=$(gh secret get $secret)
  jq --arg key "$VAR_NAME" --arg val "$VAR_VALUE" '. + {($key): $val}' env-vars.json > env-vars.tmp.json
  mv env-vars.tmp.json env-vars.json
done
```

---

## ✅ AVANTAGES

1. ✅ **Gère tous les caractères spéciaux** : virgules, guillemets, etc.
2. ✅ **Plus lisible** : format JSON structuré
3. ✅ **Plus maintenable** : facile d'ajouter/modifier des variables
4. ✅ **Compatible** : fonctionne avec toutes les valeurs

---

## 🎯 RÉSULTAT

Après cette correction :
- ✅ Les variables d'environnement sont correctement passées à Cloud Run
- ✅ Les valeurs avec virgules (comme `ALLOWED_ORIGINS`) fonctionnent
- ✅ Le déploiement Cloud Run réussit

---

**Date** : 2026-02-14  
**Statut** : ✅ **CORRIGÉ**

