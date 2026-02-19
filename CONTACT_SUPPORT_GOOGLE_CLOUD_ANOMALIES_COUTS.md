# 📞 Contacter Google Cloud - Anomalies de Coûts et Annulation de Facture

**Date** : 2026-02-18  
**Contexte** : Demander l'annulation d'une facture et obtenir une explication de l'utilisation

---

## 🚨 Situation Actuelle

D'après votre tableau de bord de facturation Google Cloud :
- ⚠️ **Activité suspecte détectée**
- ⚠️ **Problèmes liés au compte de paiement**
- 💰 **Solde élevé** : 64 488,94 $US
- 📅 **Dernier paiement** : 10,00 $US le 24 nov. 2025

---

## 📞 Méthodes de Contact Support Google Cloud

### Option 1 : Support via Console GCP (Recommandé)

#### Étape 1 : Accéder au Support

1. **Aller sur** [Google Cloud Console](https://console.cloud.google.com/)
2. **Sélectionner votre projet** : `yukpo-project` (ID: 738929393617)
3. **Menu en haut à droite** → Cliquer sur **"?" (Aide)** ou **"Support"**
4. **Ou directement** : https://console.cloud.google.com/support

#### Étape 2 : Créer un Ticket de Support

1. **Cliquer sur** "Créer un ticket" ou "Nouveau ticket"
2. **Catégorie** : Sélectionner **"Facturation"** ou **"Anomalies de coûts"**
3. **Priorité** : **Urgente** ou **Élevée** (pour factures importantes)
4. **Sujet** : 
   ```
   Demande d'annulation de facture - Anomalies de coûts non autorisées
   ```

#### Étape 3 : Remplir le Formulaire

**Informations à fournir** :

```
Bonjour,

Je contacte le support Google Cloud concernant des anomalies de coûts importantes 
sur mon compte de facturation "yukpo" (Projet ID: 738929393617).

SITUATION :
- Solde actuel : 64 488,94 $US
- Dernier paiement : 10,00 $US le 24 nov. 2025
- Activité suspecte détectée sur le compte
- Problèmes liés au compte de paiement signalés

DEMANDES :
1. Annulation de la facture pour les coûts non autorisés/anormaux
2. Explication détaillée de l'utilisation ayant généré ces coûts
3. Identification de la source des anomalies (services, APIs, ressources)
4. Mise en place de protections pour éviter de futures anomalies

INFORMATIONS PROJET :
- Projet ID : 738929393617
- Nom du projet : yukpo-project
- Compte de facturation : yukpo
- Région principale : europe-west1

Je n'ai pas autorisé ces dépenses importantes et souhaite comprendre 
l'origine de ces coûts avant tout paiement.

Merci de votre assistance urgente.

Cordialement,
[Votre nom]
```

---

### Option 2 : Support par Email

#### Email Direct Support Billing

1. **Email** : `billing-support@google.com`
2. **Sujet** : `[URGENT] Demande annulation facture - Projet 738929393617`
3. **Corps** : Utiliser le même texte que ci-dessus

---

### Option 3 : Support par Téléphone (Si Disponible)

1. **Vérifier votre niveau de support** :
   - Aller dans **Support** → **Support Plans**
   - Si vous avez un plan payant, vous avez accès au support téléphonique

2. **Numéros de téléphone** (selon votre région) :
   - **Europe** : Disponible via console (selon plan)
   - **Vérifier dans** : Console → Support → Contact

---

## 📊 Informations à Préparer Avant le Contact

### 1. Détails du Compte de Facturation

```bash
# Via gcloud CLI
gcloud billing accounts list
gcloud billing accounts describe [BILLING_ACCOUNT_ID]
```

### 2. Rapport d'Utilisation Détaillé

1. **Dans Console GCP** :
   - **Billing** → **Reports** (Rapports)
   - **Sélectionner la période** concernée
   - **Exporter** le rapport CSV/PDF

2. **URL directe** :
   ```
   https://console.cloud.google.com/billing/[BILLING_ACCOUNT_ID]/reports
   ```

### 3. Identification des Services Coûteux

1. **Billing** → **Reports** → **Group by** : "Service"
2. **Identifier** les services avec coûts élevés :
   - Compute Engine (VM/GPU)
   - Cloud Run
   - Cloud Storage
   - APIs (Places, Translation, etc.)
   - Cloud SQL
   - Autres services

### 4. Vérifier les Ressources Actives

```bash
# Lister toutes les instances Compute Engine
gcloud compute instances list --project=yukpo-project

# Lister les services Cloud Run
gcloud run services list --project=yukpo-project --region=europe-west1

# Lister les buckets Cloud Storage
gsutil ls -p yukpo-project

# Lister les instances Cloud SQL
gcloud sql instances list --project=yukpo-project
```

---

## 🔍 Analyser les Anomalies Avant le Contact

### Étape 1 : Vérifier les Budgets et Alertes

1. **Billing** → **Budgets & alerts**
2. **Vérifier** si des alertes ont été déclenchées
3. **Exporter** les rapports d'alerte

### Étape 2 : Vérifier l'Historique des Coûts

1. **Billing** → **Reports**
2. **Comparer** les coûts mensuels :
   - Mois précédent vs mois actuel
   - Identifier les pics anormaux

### Étape 3 : Vérifier les APIs Actives

1. **APIs & Services** → **Enabled APIs**
2. **Identifier** les APIs coûteuses :
   - Places API
   - Translation API
   - Autres APIs avec facturation

### Étape 4 : Vérifier les Quotas et Limites

1. **APIs & Services** → **Quotas**
2. **Vérifier** si des quotas ont été dépassés
3. **Exporter** les rapports de quota

---

## 📝 Template de Demande Complète

### Pour le Support Google Cloud

```
Sujet : [URGENT] Demande annulation facture - Anomalies coûts - Projet 738929393617

Bonjour Support Google Cloud,

Je contacte concernant des anomalies de coûts importantes sur mon compte 
de facturation Google Cloud.

INFORMATIONS COMPTE :
- Projet ID : 738929393617
- Nom du projet : yukpo-project
- Compte de facturation : yukpo
- Région : europe-west1

SITUATION :
- Solde actuel : 64 488,94 $US
- Dernier paiement autorisé : 10,00 $US (24 nov. 2025)
- Activité suspecte détectée par le système
- Problèmes de compte de paiement signalés

DEMANDES :
1. ✅ ANNULATION de la facture pour les coûts non autorisés
2. ✅ EXPLICATION détaillée de l'utilisation (services, APIs, ressources)
3. ✅ IDENTIFICATION de la source des anomalies
4. ✅ MISE EN PLACE de protections (budgets, alertes, limites)

SERVICES UTILISÉS (Normalement) :
- Cloud Run (backend)
- Cloud SQL (PostgreSQL)
- Cloud Storage (fichiers)
- Places API (géolocalisation)
- Translation API (traductions)

ACTIONS DÉJÀ EFFECTUÉES :
- Vérification des ressources actives
- Export des rapports de facturation
- Vérification des budgets et alertes

Je n'ai pas autorisé ces dépenses importantes et souhaite une résolution 
urgente avant tout prélèvement.

Merci de votre assistance.

Cordialement,
[Votre nom]
[Votre email]
[Date]
```

---

## 🛡️ Protections à Demander

### 1. Budgets et Alertes Stricts

```
Demander la mise en place de :
- Budget mensuel avec alerte à 50 $US
- Alerte à 80 $US (avant dépassement)
- Blocage automatique à 100 $US
```

### 2. Limites de Quota

```
Demander des limites sur :
- Compute Engine (instances, GPU)
- Cloud Run (concurrence, CPU)
- APIs (Places, Translation)
- Cloud Storage (stockage, transfert)
```

### 3. Notifications Email

```
Activer les notifications pour :
- Tous les coûts > 10 $US/jour
- Nouvelles ressources créées
- Quotas dépassés
- Changements de configuration
```

---

## ⚡ Actions Immédiates à Prendre

### 1. Arrêter les Ressources Coûteuses (Si Possible)

```bash
# Arrêter toutes les instances Compute Engine
gcloud compute instances stop [INSTANCE_NAME] --zone=[ZONE] --project=yukpo-project

# Mettre à l'échelle Cloud Run à 0
gcloud run services update yukpo-backend --min-instances=0 --max-instances=0 --region=europe-west1 --project=yukpo-project

# Désactiver les APIs coûteuses (si non critiques)
gcloud services disable [API_NAME] --project=yukpo-project
```

### 2. Vérifier les Permissions

```bash
# Vérifier qui a accès au projet
gcloud projects get-iam-policy yukpo-project

# Vérifier les clés de service actives
gcloud iam service-accounts keys list --iam-account=[SERVICE_ACCOUNT] --project=yukpo-project
```

### 3. Exporter les Données de Facturation

1. **Billing** → **Reports**
2. **Exporter** en CSV/PDF
3. **Sauvegarder** pour référence

---

## 📞 URLs Directes Utiles

- **Support GCP** : https://console.cloud.google.com/support
- **Facturation** : https://console.cloud.google.com/billing
- **Rapports** : https://console.cloud.google.com/billing/[ACCOUNT_ID]/reports
- **Budgets** : https://console.cloud.google.com/billing/[ACCOUNT_ID]/budgets
- **Anomalies** : https://console.cloud.google.com/billing/[ACCOUNT_ID]/anomalies

---

## ✅ Checklist Avant Contact

- [ ] Exporter les rapports de facturation (CSV/PDF)
- [ ] Identifier les services avec coûts élevés
- [ ] Lister toutes les ressources actives
- [ ] Vérifier les budgets et alertes configurés
- [ ] Préparer le template de demande
- [ ] Avoir les informations du compte (ID, nom, région)
- [ ] Vérifier les permissions du compte
- [ ] Documenter les actions déjà effectuées

---

## 🎯 Résultat Attendu

Après contact avec le support, vous devriez obtenir :

1. ✅ **Annulation** de la facture (si justifiée)
2. ✅ **Explication détaillée** de l'utilisation
3. ✅ **Rapport** des services/APIs responsables
4. ✅ **Mise en place** de protections (budgets, alertes)
5. ✅ **Recommandations** pour éviter de futures anomalies

---

## 📚 Ressources Complémentaires

- **Documentation GCP Billing** : https://cloud.google.com/billing/docs
- **Support Plans** : https://cloud.google.com/support/docs/overview
- **Gérer les budgets** : https://cloud.google.com/billing/docs/how-to/budgets
- **Détecter les anomalies** : https://cloud.google.com/billing/docs/how-to/detect-anomalies

---

**Note** : Google Cloud est généralement compréhensif pour les anomalies de coûts, surtout si elles sont dues à une erreur de configuration ou à une activité suspecte. Contactez-les rapidement pour maximiser vos chances d'obtenir une annulation.


