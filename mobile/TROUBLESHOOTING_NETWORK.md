# Guide de dépannage - Erreurs de création de service

## Problème : "Network request failed"

Cette erreur indique un problème de connectivité réseau lors de la création d'un service. Voici les solutions :

### 🔍 Diagnostic automatique

1. **Utilisez le bouton de diagnostic réseau** (icône WiFi dans le header du formulaire)
2. Le diagnostic teste automatiquement la connectivité à l'API backend
3. Consultez les résultats pour identifier le problème

### 🛠️ Solutions par type d'erreur

#### 1. Erreur de connexion réseau
**Symptômes :** "Network request failed", "Impossible de se connecter au serveur"

**Solutions :**
- Vérifiez votre connexion internet (WiFi/4G)
- Essayez de basculer entre WiFi et données mobiles
- Redémarrez votre connexion réseau
- Vérifiez que l'application a les permissions réseau

#### 2. Timeout de requête
**Symptômes :** "La requête a expiré", "Timeout"

**Solutions :**
- Votre service contient peut-être trop de données
- Réduisez le nombre d'images par produit
- Raccourcissez les vidéos
- Supprimez les produits non essentiels
- Essayez de créer le service en plusieurs étapes

#### 3. Données trop volumineuses
**Symptômes :** "413", "trop volumineux", "Payload too large"

**Solutions :**
- Compressez vos images avant de les ajouter
- Limitez à 3-5 images maximum par produit
- Utilisez des vidéos courtes (< 30 secondes)
- Supprimez les documents non essentiels

### 🔧 Améliorations techniques implémentées

#### Mécanisme de retry automatique
- **3 tentatives automatiques** en cas d'échec
- **Délai progressif** entre les tentatives (1s, 2s, 3s)
- **Timeout adaptatif** (30s, 40s, 50s selon la tentative)

#### Diagnostics réseau
- **Test de connectivité** avant chaque requête importante
- **Mesure du temps de réponse** de l'API
- **Logs détaillés** pour le debugging

#### Gestion d'erreur améliorée
- **Messages d'erreur spécifiques** selon le type de problème
- **Logs d'erreur détaillés** copiés automatiquement
- **Conseils contextuels** pour résoudre le problème

### 📊 Surveillance des performances

#### Taille des payloads
- **Alerte automatique** si le payload > 50MB
- **Compression des médias** avant envoi
- **Optimisation des données** pour réduire la taille

#### Logs de diagnostic
- **Timestamp** de chaque requête
- **Taille du payload** en KB/MB
- **Temps de réponse** de l'API
- **Statut de connectivité** réseau

### 🚨 Actions d'urgence

Si le problème persiste :

1. **Redémarrez l'application** complètement
2. **Videz le cache** de l'application
3. **Vérifiez les mises à jour** de l'application
4. **Contactez le support** avec les logs d'erreur copiés

### 📱 Informations système

Pour le support technique, fournissez :
- **Version de l'application**
- **Type de connexion** (WiFi/4G)
- **Logs d'erreur** (copiés automatiquement)
- **Résultats du diagnostic réseau**
- **Taille du service** que vous essayez de créer

### 🔄 Processus de retry

Le système retry automatiquement dans ces cas :
- **Erreurs 500, 502, 503, 504** (erreurs serveur)
- **Timeouts** de requête
- **Erreurs de réseau** (Network request failed)
- **Erreurs de connexion** (Failed to fetch)

### ⚡ Optimisations recommandées

#### Pour les gros services :
1. **Créez d'abord** le service avec les informations de base
2. **Ajoutez les médias** progressivement via l'édition
3. **Utilisez la compression** des images
4. **Limitez les produits** à 10-15 maximum par service

#### Pour les connexions lentes :
1. **Utilisez le WiFi** plutôt que les données mobiles
2. **Évitez les heures de pointe** (19h-22h)
3. **Créez les services** en plusieurs étapes
4. **Sauvegardez régulièrement** vos données

---

*Ce guide est mis à jour automatiquement avec les améliorations de l'application.*

