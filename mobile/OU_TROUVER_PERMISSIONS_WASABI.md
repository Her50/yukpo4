# 🔍 Où trouver les Permissions/Bucket Policy dans Wasabi

## 📍 Vous êtes ici
Vous êtes dans le bucket `yukpo-video-prod` et vous voyez :
- Bucket Details
- Objects (avec le dossier "uploads")
- Boutons "Create Folder" et "Upload Files"

## 🎯 Où chercher les Permissions

### Option 1 : Onglets en haut (le plus probable)
Regardez **en haut de la page**, près du titre "yukpo-video-prod" :
- Cherchez des **onglets** ou **liens** comme :
  - **"Objects"** (actif actuellement)
  - **"Permissions"** ← CLIQUEZ ICI
  - **"Settings"** ou **"Configuration"**
  - **"Access Control"**
  - **"Policy"**

### Option 2 : Menu à trois points (⋮)
1. Cherchez un **menu à trois points** (⋮) ou **menu déroulant** :
   - À côté du nom du bucket "yukpo-video-prod"
   - Ou dans la carte "Bucket Details"
   - Ou en haut à droite
2. Cliquez dessus
3. Cherchez **"Edit Permissions"**, **"Bucket Policy"**, ou **"Access Control"**

### Option 3 : Bouton "Manage" ou "Settings"
1. Dans la carte **"Bucket Details"**, cherchez :
   - Un bouton **"Edit"** ou **"Manage"**
   - Un bouton **"Settings"** ou **"Configure"**
   - Un icône d'engrenage ⚙️
2. Cliquez dessus

### Option 4 : Menu latéral
1. Si vous voyez un **menu latéral** ou **sidebar** à droite ou à gauche
2. Cherchez **"Permissions"**, **"Access"**, ou **"Policy"**

## 🔍 Instructions détaillées

### Si vous voyez des onglets :
```
[yukpo-video-prod]
Objects | Permissions | Settings | ...
```
→ Cliquez sur **"Permissions"**

### Si vous voyez un menu ⋮ :
1. Cliquez sur le menu (⋮) à côté de "yukpo-video-prod"
2. Sélectionnez **"Edit Permissions"** ou **"Bucket Policy"**

### Si vous voyez "Bucket Details" :
1. Dans la carte "Bucket Details"
2. Cherchez un bouton **"Edit"**, **"Manage"**, ou **"Configure"**
3. Cliquez dessus
4. Cherchez l'onglet **"Permissions"** ou **"Access Control"**

## 📸 Ce que vous devriez voir après

Une fois dans les Permissions, vous devriez voir :
- Une section **"Bucket Policy"**
- Un bouton **"Edit Policy"** ou **"Add Policy"**
- Un éditeur de texte/JSON où coller le code

## ❓ Si vous ne trouvez toujours pas

1. **Faites une capture d'écran** de toute la page (haut en bas)
2. Ou dites-moi :
   - Y a-t-il des **onglets** en haut ?
   - Y a-t-il un **menu (⋮)** quelque part ?
   - Y a-t-il un bouton **"Settings"** ou **"Manage"** ?

## 🎯 Code à coller (une fois que vous trouvez)

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



