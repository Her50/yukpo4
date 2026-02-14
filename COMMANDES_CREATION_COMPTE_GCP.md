# 📋 Commandes : Création Compte GCP + Automatisation

**Date** : 2026-02-14  
**Usage** : Commandes pour créer le compte GCP et lancer l'automatisation

---

## 🔗 ÉTAPE 1 : Créer le Compte GCP

**Lien direct** :
```
https://cloud.google.com/free
```

**Ou** :
```
https://console.cloud.google.com/
```

**Étapes** :
1. Cliquer sur "Démarrer gratuitement" ou "Get started for free"
2. Se connecter avec votre compte Google
3. Remplir le formulaire (pays, type de compte)
4. Ajouter une carte de crédit (vérification uniquement, pas de frais dans les limites gratuites)
5. Accepter les conditions

**⏱️ Temps estimé** : 5-10 minutes

---

## ✅ ÉTAPE 2 : Vérifier le Compte

**Ouvrir** :
```
https://console.cloud.google.com/
```

**Vérifier** :
- ✅ Vous êtes connecté
- ✅ Vous voyez le tableau de bord GCP
- ✅ Votre compte est actif

---

## 🚀 ÉTAPE 3 : Lancer l'Automatisation

**Une fois le compte créé et vérifié**, exécuter :

```powershell
cd C:\Users\23767\yukpomnang2
.\scripts\migrate-to-gcp-complete.ps1
```

**Ce qui va se passer** :
1. ✅ Vérification/installation de Google Cloud CLI
2. ✅ Connexion à GCP (navigateur s'ouvrira)
3. ✅ Création du projet "yukpo-project"
4. ✅ Activation des APIs nécessaires
5. ✅ Création de Cloud SQL (PostgreSQL)
6. ✅ Configuration du Service Account
7. ✅ Configuration des secrets GitHub
8. ✅ Génération des mots de passe

**⏱️ Temps estimé** : 10-15 minutes (principalement la création de Cloud SQL)

---

## 📋 INFORMATIONS À PRÉPARER

**Avant de lancer** :
- ✅ Compte GCP créé
- ✅ Carte de crédit enregistrée (pour vérification)
- ✅ Compte GitHub connecté (pour les secrets)

---

## ⚠️ NOTES IMPORTANTES

**Crédit gratuit** :
- ✅ $300 de crédit pour 90 jours
- ✅ Services Always Free disponibles
- ✅ Aucun frais si vous restez dans les limites gratuites

**Pendant l'exécution** :
- ⚠️ Un navigateur peut s'ouvrir pour la connexion
- ⚠️ La création de Cloud SQL prend 5-10 minutes
- ⚠️ Le script affichera les secrets générés (à sauvegarder)

---

**Date** : 2026-02-14  
**Statut** : Commandes prêtes - Attendre création du compte

