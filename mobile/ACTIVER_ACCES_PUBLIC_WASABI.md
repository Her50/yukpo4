# ✅ Activer l'Accès Public Wasabi - Étapes

## 🎯 Vous avez trouvé la bonne section !

Vous voyez **"Public Access Override"** avec un message d'alerte jaune :
> "Public Access to your buckets is currently disabled"

## 📝 Étapes à suivre

### Étape 1 : Ouvrir "Public Access Override"
1. La section **"Public Access Override"** est déjà ouverte (chevon vers le haut)
2. Si elle est fermée, cliquez dessus pour l'ouvrir

### Étape 2 : Activer l'accès public
1. Dans la section "Public Access Override", vous devriez voir :
   - Des **cases à cocher** (checkboxes)
   - Des **options** pour activer l'accès public
   - Peut-être des **boutons** "Enable" ou "Allow"

2. **Désactivez** toutes les restrictions (ou activez l'accès public) :
   - ☐ Décochez toutes les cases qui bloquent l'accès public
   - Ou cochez les cases qui autorisent l'accès public
   - Ou cliquez sur un bouton **"Enable Public Access"**

3. **Sauvegardez** les changements

### Étape 3 : Trouver la Bucket Policy
Après avoir activé l'accès public, vous devez ajouter une Bucket Policy.

**Où chercher :**
1. **Regardez dans les autres sections** de la même page :
   - "Bucket Policy" (peut-être plus bas sur la page)
   - "Access Control" 
   - "CORS Configuration"

2. **Ou cherchez dans un autre onglet** :
   - Retournez aux onglets en haut
   - Cherchez "Permissions" ou "Policy"

3. **Ou dans le menu** :
   - Cherchez un menu (⋮) avec "Edit Bucket Policy"

### Étape 4 : Ajouter la Bucket Policy
Une fois que vous trouvez la section "Bucket Policy", collez ce code :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::yukpo-video-prod/*"
    }
  ]
}
```

## ⚠️ Important
1. **D'abord** : Activez l'accès public dans "Public Access Override"
2. **Ensuite** : Ajoutez la Bucket Policy

## 🔍 Actions immédiates

1. **Dans "Public Access Override"** :
   - Voyez-vous des cases à cocher ?
   - Voyez-vous un bouton "Enable" ou "Allow" ?
   - Faites une capture d'écran ou décrivez ce que vous voyez dans cette section

2. **Regardez sur toute la page** :
   - Y a-t-il une section "Bucket Policy" quelque part ?
   - Y a-t-il d'autres sections que vous n'avez pas encore ouvertes ?

Dites-moi ce que vous voyez dans la section "Public Access Override" !



