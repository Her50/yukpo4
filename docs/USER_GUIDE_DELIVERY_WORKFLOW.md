# 📖 Guide Utilisateur : Améliorations Workflow de Livraison

## Vue d'ensemble

Ce guide explique comment utiliser les nouvelles fonctionnalités de gestion des commandes et de livraison pour les **clients** et les **prestataires**.

---

## 👤 Guide Client

### 📱 Application Mobile

#### 1. Passer une commande

1. **Rechercher un produit** dans l'application
2. **Sélectionner un produit** avec les badges de disponibilité :
   - ⚡ **Livraison rapide** : Disponible immédiatement
   - ⏱️ **Prêt en X min** : Temps de préparation indiqué
   - 📅 **Disponible [jours]** : Jours de disponibilité
3. **Cliquer sur "Se faire livrer"**
4. **Confirmer la commande**

#### 2. Si le produit n'est pas disponible

Si le produit n'est pas disponible, vous verrez :
- Un message indiquant que le produit n'est pas disponible
- Une liste de **produits similaires** suggérés
- Vous pouvez cliquer sur un produit similaire pour le commander

#### 3. Suivre votre commande

1. **Accéder à "Mes commandes"** dans le menu
2. **Voir le statut** de votre commande :
   - ⏳ **En attente** : Le prestataire doit valider
   - ✅ **Validée** : Le prestataire a accepté, préparation en cours
   - 🚀 **Prête** : Prête pour la livraison, coursier en route
   - ❌ **Rejetée** : Le prestataire a rejeté la commande
   - 🚫 **Annulée** : Commande annulée (timeout ou autre raison)

#### 4. Notifications

Vous recevrez des notifications pour :
- ✅ Commande validée
- 🚀 Commande prête
- ❌ Commande rejetée (avec produits similaires)
- 🚫 Commande annulée

---

### 🌐 Site Web

#### 1. Passer une commande

1. **Rechercher un produit** sur le site
2. **Voir les badges de disponibilité** sur chaque produit :
   - ⚡ Livraison rapide
   - ⏱️ Prêt en X min
   - 📅 Disponible [jours]
   - ⚠️ Taux d'annulation (si élevé)
3. **Cliquer sur "Se faire livrer"**
4. **Confirmer la commande**

#### 2. Produits similaires

Si un produit n'est pas disponible :
- Une page **"Produits similaires"** s'affiche automatiquement
- Vous pouvez voir des alternatives avec leurs caractéristiques
- Cliquer sur un produit pour le commander

#### 3. Suivre votre commande

- Accéder à votre profil → **"Mes commandes"**
- Voir le statut en temps réel
- Recevoir des notifications par email

---

## 🏪 Guide Prestataire

### 📱 Application Mobile

#### 1. Recevoir une commande

1. **Notification sonore** : Vous recevez une notification sonore pour chaque nouvelle commande
2. **Accéder à "Mes commandes"** dans le menu
3. **Voir les commandes en attente** avec :
   - ID de commande
   - Produit concerné
   - Temps de préparation estimé
   - Délai de validation (⏰)

#### 2. Valider une commande

1. **Ouvrir la commande** dans "Mes commandes"
2. **Cliquer sur "Valider"**
3. **Si produit immédiatement disponible** :
   - La commande passe directement à "Prête"
   - Le matching coursier démarre immédiatement
4. **Sinon** :
   - La commande passe à "Validée"
   - Vous pouvez indiquer une heure de préparation

#### 3. Rejeter une commande

1. **Ouvrir la commande**
2. **Cliquer sur "Rejeter"**
3. **Indiquer la raison** du rejet :
   - Produit en rupture de stock
   - Produit indisponible
   - Autre raison
4. **Confirmer le rejet**
5. Le client recevra des **produits similaires** suggérés

#### 4. Vérifier l'identité du coursier

Quand un coursier arrive pour récupérer le colis :

1. **Ouvrir la livraison** dans l'application
2. **Cliquer sur "Vérifier coursier"**
3. **Voir le code PIN à 6 chiffres** ou scanner le QR code
4. **Demander au coursier** d'entrer le code
5. **Vérifier** que le code correspond
6. **Remettre le colis** au coursier vérifié

#### 5. Gérer le stock

1. **Accéder à la configuration du produit**
2. **Mettre à jour les quantités** par lieu de stock
3. **Ajouter/supprimer des lieux** de stock si nécessaire

#### 6. Dashboard Analytics

1. **Accéder au Dashboard** dans le menu
2. **Voir les statistiques** :
   - 📊 Nombre total de commandes
   - ⏱️ Délais de préparation (moyen, médian)
   - ❌ Taux de rejet
   - 🚫 Taux d'annulation
   - 💰 Pénalités (si applicable)
   - 📈 Performance par produit

---

### 🌐 Site Web

#### 1. Gestion des commandes

1. **Accéder à "Gestion des commandes"** dans le menu prestataire
2. **Voir toutes les commandes** avec filtres par statut
3. **Valider/Rejeter** directement depuis le tableau
4. **Voir les détails** de chaque commande

#### 2. Analytics Prestataire

1. **Accéder à "Analytics"** dans le menu
2. **Sélectionner une période** (7, 30, ou 90 jours)
3. **Voir les métriques détaillées** :
   - Statistiques commandes
   - Délais de préparation
   - Analyse des rejets
   - Analyse des annulations
   - Pénalités
   - Performance par produit
   - Comparaison disponibilité immédiate vs délai
4. **Exporter les données** (CSV/PDF) pour rapports

#### 3. Configuration produits

1. **Configurer la disponibilité** de chaque produit :
   - ✅ **Disponible immédiatement** : Cocher si le produit est prêt instantanément
   - ⏱️ **Temps de préparation** : Indiquer le temps en minutes
   - 📅 **Jours de disponibilité** : Sélectionner les jours (Lun-Ven, etc.)
   - 🕐 **Plages horaires** : Définir les heures de pickup

#### 4. Vérification coursier

1. **Ouvrir la livraison** dans le dashboard
2. **Générer un code de vérification**
3. **Afficher le QR code** ou donner le code PIN au coursier
4. **Vérifier** que le code correspond

---

## 🎯 Fonctionnalités Clés

### ⚡ Disponibilité Immédiate

Si vous marquez un produit comme **"Disponible immédiatement"** :
- ✅ Le produit apparaît avec le badge "⚡ Livraison rapide"
- ✅ Après validation, le statut passe directement à "Prête"
- ✅ Le matching coursier démarre immédiatement
- ✅ Livraison en moins de 30 minutes possible

### ⏱️ Temps de Préparation Dynamique

Le système calcule automatiquement le temps de préparation :
- 📊 Basé sur les données historiques de votre catégorie
- 🔄 Recalculé automatiquement toutes les 24h
- 📈 Utilise la médiane pour plus de robustesse
- ⚙️ Vous pouvez aussi définir un temps manuel

### 📅 Disponibilité par Jours

Configurez les jours où vos produits sont disponibles :
- **Tous les jours** : Disponible 7/7
- **Lun-Ven** : Disponible du lundi au vendredi
- **Week-end** : Disponible samedi et dimanche
- **Jours personnalisés** : Sélectionner des jours spécifiques

### 🕐 Plages Horaires

Définissez les heures de pickup pour chaque jour :
- Exemple : Lun 08:00-18:00, Mar 09:00-17:00
- Le système vérifie automatiquement si un produit est disponible maintenant

### ⚠️ Taux d'Annulation

Les clients voient le taux d'annulation de vos produits :
- ✅ **< 5%** : Badge vert "Fiable"
- ⚠️ **10-20%** : Badge jaune "Quelques annulations"
- ⚠️ **20-30%** : Badge orange "Annulations modérées"
- ❌ **> 30%** : Badge rouge "Annulations fréquentes"

**Conseil** : Maintenez un taux d'annulation bas en validant rapidement les commandes.

### 🔐 Vérification Coursier

Pour sécuriser la remise des colis :
1. **Générer un code PIN** unique pour chaque livraison
2. **Le coursier doit entrer ce code** pour confirmer son identité
3. **Vous pouvez aussi scanner un QR code** pour vérification rapide
4. **Le code expire** après un certain temps

---

## 📊 Comprendre les Statistiques

### Statistiques Commandes

- **Total** : Nombre total de commandes
- **En attente** : Commandes en attente de validation
- **Validées** : Commandes acceptées
- **Prêtes** : Commandes prêtes pour livraison
- **Rejetées** : Commandes rejetées
- **Annulées** : Commandes annulées

### Délais de Préparation

- **Temps moyen** : Moyenne de tous les temps de préparation
- **Temps médian** : Valeur médiane (plus robuste)
- **Temps min/max** : Valeurs extrêmes
- **Par produit** : Statistiques détaillées par produit

### Analyse des Rejets

- **Taux de rejet** : Pourcentage de commandes rejetées
- **Raisons** : Raisons les plus fréquentes de rejet
- **Par produit** : Taux de rejet par produit

### Analyse des Annulations

- **Taux d'annulation** : Pourcentage global
- **Par type** : Timeout, rejet, annulation prestataire, coursier indisponible
- **Par produit** : Taux d'annulation par produit
- **Évolution** : Tendance dans le temps
- **Produits à risque** : Produits avec taux > 20%

### Pénalités

- **Nombre total** : Nombre de pénalités
- **Montant total** : Montant débité
- **Montant moyen** : Moyenne par pénalité
- **Évolution** : Tendance dans le temps

---

## 💡 Conseils et Bonnes Pratiques

### Pour les Prestataires

1. **Validez rapidement** : Réduisez les timeouts en validant les commandes rapidement
2. **Marquez les produits disponibles immédiatement** : Augmentez les ventes avec la livraison rapide
3. **Gérez votre stock** : Mettez à jour les quantités régulièrement
4. **Configurez les jours/horaires** : Indiquez clairement quand vos produits sont disponibles
5. **Analysez vos statistiques** : Utilisez le dashboard pour optimiser vos performances
6. **Vérifiez les coursiers** : Utilisez toujours le code PIN pour sécuriser les remises

### Pour les Clients

1. **Vérifiez les badges** : Regardez les badges de disponibilité avant de commander
2. **Considérez les produits similaires** : Si un produit n'est pas disponible, regardez les alternatives
3. **Suivez vos commandes** : Vérifiez régulièrement le statut de vos commandes
4. **Activez les notifications** : Recevez des alertes en temps réel

---

## ❓ Questions Fréquentes

### Q: Que se passe-t-il si je ne valide pas une commande à temps ?

**R:** La commande est automatiquement annulée après le délai de validation. Le client recevra des produits similaires suggérés.

### Q: Comment puis-je marquer un produit comme "disponible immédiatement" ?

**R:** Dans la configuration du produit, cochez la case "Disponible immédiatement". Le produit apparaîtra avec le badge "⚡ Livraison rapide".

### Q: Les statistiques sont-elles mises à jour en temps réel ?

**R:** Les statistiques sont recalculées automatiquement toutes les 24h. Les données affichées sont mises à jour en temps réel lors de la consultation.

### Q: Puis-je exporter mes statistiques ?

**R:** Oui, sur le site web, vous pouvez exporter vos statistiques en CSV ou PDF depuis la page Analytics.

### Q: Comment fonctionne la vérification du coursier ?

**R:** Quand un coursier arrive, vous générez un code PIN unique. Le coursier doit entrer ce code dans son application pour confirmer son identité. Vous pouvez aussi scanner un QR code.

---

## 🆘 Support

Pour toute question ou problème :
- 📧 Email : support@yukpomnang.com
- 💬 Chat : Disponible dans l'application
- 📱 Téléphone : Voir les informations de contact dans l'application

---

## 📚 Références

- Documentation API : `docs/API_DELIVERY_WORKFLOW_IMPROVEMENTS.md`
- Document d'analyse : `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md`

