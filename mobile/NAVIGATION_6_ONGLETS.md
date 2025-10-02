# 📱 Navigation Mobile - 6 Onglets

## 🎯 Configuration Actuelle

### Les 6 Onglets

1. **🏠 Accueil** - HomeScreen
   - Recherche ou création de service
   - Saisie intelligente avec IA
   
2. **💼 Mes Services** - MesServicesScreen  
   - Route API : `/api/prestataire/services`
   - Liste des services que vous proposez
   - Gestion (activer/désactiver/supprimer)

3. **🕐 Historique** - SoldeDetailScreen
   - Route API : `/api/user/credit/history/{userId}`
   - Route API : `/api/user/payments/history/{userId}`
   - Historique de consommation de tokens
   - Historique des paiements

4. **💰 Recharge** - RechargeTokensScreen
   - Route API : `/api/users/balance`
   - Route API : `/api/users/recharge`
   - Recharger vos tokens
   - Voir votre solde

5. **📊 Dashboard** - DashboardPrestataireScreen
   - Route API : `/api/dashboard/prestataire?period=30d`
   - Statistiques de vos services
   - Vues, interactions, revenus

6. **👤 Profil** - ProfileScreen
   - Route API : `/api/user/me`
   - Informations personnelles
   - Paramètres
   - Déconnexion

## ⚠️ Problème : 6 Onglets c'est Trop

Sur mobile, **5 onglets maximum** est recommandé pour une bonne UX.

### Options de Regroupement

#### Option A : Fusionner Recharge + Historique
```
🏠 Accueil | 💼 Services | 💰 Tokens | 📊 Dashboard | 👤 Profil
                           (Recharge + Historique en onglets internes)
```

#### Option B : Mettre Historique dans Dashboard
```
🏠 Accueil | 💼 Services | 💰 Recharge | 📊 Dashboard | 👤 Profil
                                        (+ onglet Historique)
```

#### Option C : Mettre Historique dans Profil  
```
🏠 Accueil | 💼 Services | 💰 Recharge | 📊 Dashboard | 👤 Profil
                                                       (+ Historique)
```

#### Option D : Garder 6 onglets (avec police plus petite)
```
🏠 | 💼 | 🕐 | 💰 | 📊 | 👤
Acc  Serv Hist Rech Dash Prof
```

## 🎯 Ma Recommandation : Option A

Fusionner Recharge et Historique dans un seul onglet **"Tokens"** avec 2 sous-onglets :
- 💰 Recharge
- 📋 Historique

**Avantages :**
- ✅ 5 onglets principaux (optimal)
- ✅ Recharge et Historique logiquement regroupés
- ✅ Navigation claire

## 📊 Routes Vérifiées Frontend → Mobile

| Écran | Route API Frontend | Route API Mobile | Status |
|---|---|---|---|
| **Mes Services** | `/api/prestataire/services` | `/api/prestataire/services` | ✅ |
| **Historique Conso** | `/api/user/credit/history/{userId}` | `/api/user/credit/history/{userId}` | ✅ |
| **Historique Paiements** | `/api/user/payments/history/{userId}` | `/api/user/payments/history/{userId}` | ✅ |
| **Recharge** | `/api/users/recharge` | `/api/users/recharge` | ✅ |
| **Balance** | `/api/users/balance` | `/api/users/balance` | ✅ |
| **Dashboard** | `/api/dashboard/prestataire` | `/api/dashboard/prestataire` | ✅ |
| **Profil** | `/api/user/me` | `/api/user/me` | ✅ |

## ✅ Actuellement Modifié

J'ai **temporairement** créé 6 onglets :
- 🏠 Accueil
- 💼 Mes Services (renommé de "Services")
- 🕐 Historique (ajouté)
- 💰 Recharge
- 📊 Dashboard  
- 👤 Profil

**Quelle option préférez-vous ?**
- A : Fusionner Recharge + Historique
- B : Mettre Historique dans Dashboard
- C : Mettre Historique dans Profil
- D : Garder les 6 onglets (navigation plus chargée)


