# 🧪 Guide de Test GPS - Yukpomnang

## ✅ Composants GPS Réécrits

### 1. **GPSTrackingManager.tsx** (Nouveau)
- **Fonctionnalité**: Manager GPS en arrière-plan
- **Sécurité**: Pas de démarrage automatique
- **Activation**: Uniquement si `gpsEnabled = true` dans les paramètres
- **Délai**: 5 secondes après le login

### 2. **useGPSTracking.ts** (Réécrit)
- **Fonctionnalité**: Hook GPS simplifié
- **Sécurité**: Pas de démarrage automatique
- **Timeouts**: 10 secondes pour les permissions
- **Précision**: Balanced (évite les blocages)

### 3. **SimpleGPSManager.tsx** (Nouveau)
- **Fonctionnalité**: Interface GPS pour les écrans
- **Boutons**: Démarrer/Arrêter GPS
- **Affichage**: Position actuelle
- **Actions**: Actualiser position

## 🧪 Tests à Effectuer

### Test 1: Démarrage de l'Application
```bash
# 1. Lancer l'app
npx expo start --clear

# 2. Vérifier les logs
# ✅ Attendre: "GPSTrackingManager] GPS activé: false"
# ✅ Pas de crash au démarrage
# ✅ Écran de connexion visible
```

### Test 2: Activation GPS dans les Paramètres
```bash
# 1. Se connecter
# 2. Aller dans Paramètres
# 3. Activer GPS
# 4. Vérifier les logs
# ✅ Attendre: "GPSTrackingManager] 🚀 Démarrage du tracking GPS..."
# ✅ Attendre: "GPSTrackingManager] ✅ Tracking GPS démarré avec succès"
```

### Test 3: Interface GPS Simple
```bash
# 1. Aller sur un écran avec SimpleGPSManager
# 2. Cliquer "Démarrer GPS"
# 3. Vérifier l'affichage de la position
# ✅ Position GPS affichée
# ✅ Coordonnées visibles
# ✅ Bouton "Arrêter" disponible
```

### Test 4: Permissions GPS
```bash
# 1. Désactiver GPS dans les paramètres système
# 2. Essayer d'activer GPS dans l'app
# ✅ Message d'erreur: "Permissions GPS refusées"
# ✅ Pas de crash
```

### Test 5: Envoi au Backend
```bash
# 1. Activer GPS
# 2. Vérifier les logs backend
# ✅ Attendre: "GPSTrackingManager] ✅ Position envoyée au backend"
# ✅ Pas d'erreur réseau
```

## 🔧 Dépannage

### Problème: Crash au Démarrage
```bash
# Solution: Vérifier que gpsEnabled = false par défaut
# Dans AsyncStorage: gpsEnabled = false
```

### Problème: GPS Ne Démarre Pas
```bash
# Solution: Vérifier les permissions
# Aller dans Paramètres > Applications > Yukpomnang > Permissions
# Activer "Localisation"
```

### Problème: Position Non Affichée
```bash
# Solution: Vérifier la précision
# Utiliser Location.Accuracy.Balanced
# Éviter Location.Accuracy.High (peut bloquer)
```

## 📱 Utilisation

### Pour les Développeurs
```typescript
// Utiliser SimpleGPSManager dans un écran
import SimpleGPSManager from '../components/SimpleGPSManager';

<SimpleGPSManager />
```

### Pour les Utilisateurs
1. **Activation**: Aller dans Paramètres > GPS
2. **Interface**: Utiliser SimpleGPSManager sur les écrans
3. **Vérification**: Vérifier la position affichée

## 🚨 Points d'Attention

### ✅ Sécurité
- Pas de démarrage automatique
- Timeouts sur toutes les opérations
- Gestion d'erreur robuste
- Pas de blocage de l'interface

### ✅ Performance
- Précision Balanced (pas High)
- Mise à jour toutes les 5 minutes
- Distance minimum 50 mètres
- Pas de polling constant

### ✅ UX
- Messages d'erreur clairs
- Boutons d'action simples
- Affichage de la position
- Feedback visuel

## 🎯 Résultat Attendu

### ✅ Fonctionnalités
- GPS démarre sans crash
- Position affichée correctement
- Envoi au backend fonctionnel
- Interface utilisateur claire

### ✅ Performance
- Démarrage de l'app en < 3 secondes
- Pas de blocage de l'interface
- GPS en arrière-plan stable
- Gestion d'erreur gracieuse

## 📊 Métriques de Succès

- **Démarrage**: App visible en < 3 secondes
- **GPS**: Activation en < 10 secondes
- **Position**: Affichage en < 5 secondes
- **Backend**: Envoi en < 2 secondes
- **Stabilité**: Pas de crash pendant 24h

---

**Note**: Le système GPS a été complètement réécrit pour éliminer les crashes. Tous les composants sont maintenant sécurisés et ne démarrent plus automatiquement.
