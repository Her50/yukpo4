# 🚀 Guide : Création du Compte GCP

**Date** : 2026-02-14  
**Objectif** : Créer un compte Google Cloud Platform et lancer l'automatisation

---

## 📋 ÉTAPE 1 : Créer le Compte GCP

### Lien Direct

**Page de création de compte GCP** :
```
https://cloud.google.com/free
```

**Ou directement** :
```
https://console.cloud.google.com/
```

---

### Étapes de Création

1. **Aller sur** : https://cloud.google.com/free
2. **Cliquer sur** : "Démarrer gratuitement" ou "Get started for free"
3. **Se connecter** avec votre compte Google :
   - Si vous avez un compte Google : Utilisez-le
   - Si vous n'avez pas de compte : Créez-en un (gratuit)
4. **Remplir le formulaire** :
   - **Type de compte** : Personnel ou Professionnel
   - **Pays/Région** : Votre pays
   - **Acceptez les conditions**
5. **Informations de paiement** :
   - **Carte de crédit** : Requise (mais pas de frais si vous restez dans les limites gratuites)
   - **Adresse de facturation**
   - ⚠️ **IMPORTANT** : Vous recevrez $300 de crédit gratuit pour 90 jours
   - ⚠️ **Aucun frais** si vous restez dans les limites gratuites

---

## ✅ ÉTAPE 2 : Vérifier le Compte

**Après création** :
1. Aller sur https://console.cloud.google.com/
2. Vérifier que vous êtes connecté
3. Vérifier que vous avez accès au tableau de bord

---

## 🚀 ÉTAPE 3 : Lancer l'Automatisation

**Une fois le compte créé**, exécuter :

```powershell
.\scripts\migrate-to-gcp-complete.ps1
```

**Le script va** :
- ✅ Vérifier/installer Google Cloud CLI
- ✅ Vous connecter à GCP
- ✅ Créer le projet
- ✅ Créer toutes les ressources
- ✅ Configurer GitHub Actions

---

## ⚠️ IMPORTANT

**Avant de lancer le script** :
- ✅ Avoir créé le compte GCP
- ✅ Être connecté à GCP dans le navigateur
- ✅ Avoir une carte de crédit enregistrée (pour la vérification)

**Le script vous demandera de vous connecter** si ce n'est pas déjà fait.

---

## 💡 CRÉDIT GRATUIT GCP

**Vous recevrez** :
- ✅ **$300 de crédit** pour 90 jours
- ✅ **Services Always Free** (gratuits en permanence) :
  - Cloud SQL : 1 instance db-f1-micro gratuite
  - Cloud Run : 2 millions de requêtes/mois gratuites
  - Cloud Storage : 5 GB gratuits
  - Et plus...

---

**Date** : 2026-02-14  
**Statut** : Guide créé - Prêt à créer le compte



