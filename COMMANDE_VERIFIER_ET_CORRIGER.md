# 🔍 Vérifier et Corriger le Téléchargement

## ✅ **Vérification Détaillée**

```bash
# Voir le contenu complet d'un fichier
cat ~/migrations/00000001_create_extensions.sql

# Voir les premières lignes
head -10 ~/migrations/00000001_create_extensions.sql

# Voir la taille du fichier
ls -lh ~/migrations/00000001_create_extensions.sql
```

---

## ✅ **Problème Possible : Token ou Repository**

Le token peut ne pas avoir accès au repository, ou le repository peut être dans une branche différente. Essayons :

### Option 1 : Vérifier le Token

```bash
# Tester le token avec une requête API GitHub
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Si ça retourne vos infos, le token fonctionne
```

### Option 2 : Essayer avec la Branche Main Explicite

```bash
# Télécharger avec la branche main explicite
curl -L "https://raw.githubusercontent.com/Her50/yukpo4/main/backend/migrations/00000001_create_extensions.sql" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3.raw" \
    -o test.sql

# Vérifier
head -5 test.sql
```

### Option 3 : Utiliser l'API GitHub Directement

```bash
# Utiliser l'API GitHub pour obtenir le contenu
curl -L "https://api.github.com/repos/Her50/yukpo4/contents/backend/migrations/00000001_create_extensions.sql" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3.raw" \
    -o test2.sql

# Vérifier
head -5 test2.sql
```

---

## ✅ **Solution Alternative : Créer les Migrations Localement**

Si le téléchargement ne fonctionne pas, vous pouvez créer les migrations directement depuis votre machine Windows et les copier via AWS Systems Manager ou créer un script qui les génère.

