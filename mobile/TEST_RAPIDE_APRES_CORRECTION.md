# 🧪 TEST RAPIDE APRÈS CORRECTIONS - 22 OCTOBRE 2025

**Objectif**: Vérifier que l'application ne crash plus au démarrage

---

## 🚀 LANCER L'APPLICATION

### Option 1 : Expo Go (Recommandé pour test rapide)

```powershell
# Dans le dossier mobile
cd C:\Users\23767\yukpomnang\mobile

# Lancer Expo
npx expo start
```

**Ensuite** :
- Scanner le QR code avec votre téléphone (Expo Go)
- OU appuyer sur `a` pour Android Emulator
- OU appuyer sur `w` pour Web

---

### Option 2 : Script PowerShell (Si disponible)

```powershell
.\START.ps1
```

---

## ✅ CHECKLIST DE TEST

### 1. **Démarrage de l'application** (CRITIQUE)

- [ ] L'application démarre **sans crash**
- [ ] Pas d'erreur "WebSocket connection failed"
- [ ] Pas d'erreur "useLanguage must be used within provider"
- [ ] Écran de chargement s'affiche correctement
- [ ] Navigation vers HomeScreen réussie

**Console attendue** :
```
[App] 🚀 Yukpomnang - Application stable avec support multilingue sécurisé
[App] 📱 Version: 1.0.0 - Stable + LanguageProvider safe (useLanguageSafe hook)
```

---

### 2. **HomeScreen** (CRITIQUE)

- [ ] HomeScreen s'affiche sans erreur
- [ ] Solde utilisateur visible
- [ ] Bouton "Rechercher" ou "Créer" visible
- [ ] Pas de crash lors de la navigation focus
- [ ] Carousel de publicités s'affiche (si disponible)

**Console attendue** :
```
[HomeScreen] Utilisateur chargé: { name, email, credits, role }
[HomeScreen] 🔄 Écran focus - Rafraîchissement du solde...
```

---

### 3. **Navigation** (IMPORTANT)

- [ ] Navigation vers "Mes Services" fonctionne
- [ ] Navigation vers "Dashboard" fonctionne
- [ ] Navigation vers "Mon Compte" fonctionne
- [ ] Retour sur HomeScreen ne cause pas de crash
- [ ] Pas de memory leak après 5+ navigations

---

### 4. **Fonctionnalités Multilingue** (NOUVEAU)

- [ ] Sélecteur de langue visible dans HomeScreen
- [ ] Changement de langue fonctionne (fr ↔ en)
- [ ] Traductions s'appliquent correctement
- [ ] Pas de crash si provider absent

**Test de fallback** :
- Les traductions fonctionnent même en cas d'erreur
- Texte par défaut en français si traduction manquante

---

### 5. **Fonctionnalités Core**

- [ ] Création de service fonctionne
- [ ] Recherche de services fonctionne
- [ ] GPS modal s'ouvre sans crash
- [ ] Notifications s'affichent
- [ ] Chat s'ouvre (mode polling 30s)

---

### 6. **Stabilité Prolongée** (CRITIQUE)

- [ ] Application reste stable après 5 minutes
- [ ] Pas de ralentissement progressif
- [ ] Pas de crash en arrière-plan
- [ ] Mémoire stable (pas de leak)

**Test** :
1. Laisser l'app ouverte 5 minutes
2. Naviguer entre les écrans
3. Passer l'app en arrière-plan puis revenir
4. Vérifier qu'il n'y a pas de crash

---

## 🔍 POINTS DE VIGILANCE

### Erreurs à surveiller (NE DOIVENT PAS APPARAÎTRE)

❌ **Erreurs critiques éliminées** :
```
Error: useLanguage must be used within a LanguageProvider
WebSocket connection failed
Cannot read property 'addListener' of undefined
Maximum update depth exceeded
```

✅ **Warnings acceptables** :
```
[LanguageContext] Provider non disponible, utilisation du fallback français
[HomeScreen] Erreur rafraîchissement solde: (erreur réseau OK)
```

---

## 📊 COMPARAISON AVANT/APRÈS

| Aspect | Avant (Crash) | Après (Attendu) |
|--------|---------------|-----------------|
| Démarrage | ❌ Crash immédiat | ✅ Démarrage fluide |
| WebSocket | ❌ Reconnexions infinies | ✅ Désactivé (notifications OK) |
| Language | ❌ Crash si absent | ✅ Fallback safe |
| Navigation | ❌ Memory leak | ✅ Listeners stables |
| Stabilité 5min | ❌ Crash progressif | ✅ Stable |

---

## 🐛 SI CRASH PERSISTE

### Vérifier les logs Metro

Lors du crash, noter :
1. **Ligne exacte de l'erreur**
2. **Stack trace complète**
3. **Composant concerné**
4. **Moment du crash** (démarrage, navigation, etc.)

### Informations à fournir

```
🔴 CRASH DÉTECTÉ

Moment: [Démarrage / Navigation / Fonctionnalité]
Composant: [HomeScreen / App.tsx / etc.]
Erreur: [Message complet]
Stack trace: [Copier-coller]
```

---

## ✅ SI TEST RÉUSSI

### Prochaines étapes

1. ✅ **Tester 24h en conditions réelles**
2. ✅ **Valider sur plusieurs appareils**
3. ⏱️ **Réintégrer WebSocket** (optionnel, avec délai 5s)
4. ⏱️ **Optimiser les timers** (5min au lieu de 30s)

---

## 📱 COMMANDES UTILES

### Nettoyer le cache (si problème)

```powershell
# Dans mobile/
npx expo start -c

# OU
rm -rf node_modules
rm -rf .expo
npm install
npx expo start
```

### Voir les logs en détail

```powershell
# Android
adb logcat | findstr "Yukpo"

# iOS
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "Expo"'
```

### Redémarrer Metro

```powershell
# Ctrl+C pour arrêter
# Puis
npx expo start --clear
```

---

## 🎯 RÉSULTAT ATTENDU

**SI TOUT VA BIEN** :
- ✅ Application démarre en 2-3 secondes
- ✅ Aucun crash pendant 5+ minutes
- ✅ Navigation fluide sans memory leak
- ✅ Support multilingue fonctionne
- ✅ Toutes les fonctionnalités core opérationnelles

**SUCCÈS** = Vous pouvez utiliser l'application normalement ! 🎉

---

**Date**: 22 Octobre 2025  
**Version**: 1.0.0 - Stable + Language Safe  
**Durée de test recommandée**: 10-15 minutes minimum


