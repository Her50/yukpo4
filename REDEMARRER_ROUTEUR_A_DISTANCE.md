# 🔄 Redémarrer le Routeur à Distance

## ❌ Limitation

**Je ne peux pas redémarrer votre routeur physique directement** car :
- Le routeur est un appareil matériel qui nécessite une action physique (débrancher/rebrancher)
- Ou un accès à l'interface d'administration du routeur

---

## ✅ Alternatives Possibles

### Option 1 : Redémarrage via Interface Web du Routeur (Si Disponible)

**Si votre routeur supporte le redémarrage à distance**, vous pouvez :

1. **Trouver l'adresse IP du routeur** (passerelle par défaut)
2. **Accéder à l'interface web du routeur**
3. **Redémarrer depuis l'interface**

**Commandes pour trouver l'adresse IP du routeur** :
```powershell
# Trouver la passerelle par défaut (adresse IP du routeur)
Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object NextHop

# Ou plus simple
ipconfig | findstr "Passerelle"
```

**Ensuite** :
1. Ouvrir un navigateur
2. Aller à `http://[ADRESSE_IP]` (ex: `http://192.168.1.1`)
3. Se connecter avec les identifiants admin
4. Chercher "Redémarrer" ou "Reboot" dans les paramètres
5. Cliquer sur "Redémarrer"

### Option 2 : Redémarrage Physique (Le Plus Sûr)

**C'est la méthode la plus fiable** :

1. **Localiser le routeur/modem**
2. **Débrancher l'alimentation** (câble d'alimentation)
3. **Attendre 30 secondes**
4. **Rebrancher l'alimentation**
5. **Attendre 2-3 minutes** pour la reconnexion complète

### Option 3 : Script PowerShell pour Accéder au Routeur

Je peux créer un script qui :
- Trouve l'adresse IP du routeur
- Ouvre l'interface web dans votre navigateur
- Vous guide pour redémarrer manuellement

---

## 🔧 Script Automatique : Trouver et Ouvrir l'Interface du Routeur

Je peux créer un script qui :
1. Trouve automatiquement l'adresse IP du routeur
2. Ouvre l'interface web dans votre navigateur
3. Vous guide pour redémarrer

**Voulez-vous que je crée ce script ?**

---

## 📋 Informations Nécessaires

Pour redémarrer le routeur via l'interface web, vous aurez besoin de :
- **Adresse IP du routeur** (généralement `192.168.1.1` ou `192.168.0.1`)
- **Identifiants admin** (généralement sur une étiquette du routeur)
- **Accès à l'interface web** (si le routeur le supporte)

---

## 🎯 Recommandation

**La méthode la plus simple et fiable** :
1. **Débrancher physiquement le routeur** (30 secondes)
2. **Rebrancher**
3. **Attendre 2-3 minutes**

**Pourquoi** :
- ✅ Fonctionne à 100%
- ✅ Pas besoin d'identifiants
- ✅ Pas de risque d'erreur
- ✅ Réinitialise complètement le routeur

---

**Date** : 2026-01-30  
**Statut** : ⚠️ **Redémarrage physique recommandé**

