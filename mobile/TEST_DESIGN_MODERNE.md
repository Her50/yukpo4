# 🧪 Guide de Test - Design Moderne

## 🚀 Lancer l'Application

### Méthode 1 : Expo Go (Recommandé pour test rapide)

```bash
cd mobile
npx expo start --clear
```

Puis :
1. Ouvrez Expo Go sur votre téléphone
2. Scannez le QR code
3. L'app se chargera avec le nouveau design !

### Méthode 2 : Build APK

```bash
cd mobile
npx eas build --platform android --profile preview --non-interactive
```

## ✅ Points à Vérifier

### Page d'Accueil (HomeScreen)

#### Header
- [ ] Le nom d'utilisateur s'affiche correctement
- [ ] Le solde de tokens est visible avec l'icône dorée 💰
- [ ] Le badge de notification (3) est en haut à droite
- [ ] Le tout est dans une carte blanche avec ombre

#### Titre
- [ ] "Yuk" est en **orange** (#FF8C00)
- [ ] "po" est en **noir** (#1A1A1A)
- [ ] "mnang" est en **gris** (#666)
- [ ] Le sous-titre est clair (pas de `{'\n'}` visible)

#### Sélecteur de Mode
- [ ] 2 boutons côte à côte : "Rechercher" | "Créer un service"
- [ ] Le bouton actif a un fond **orange**
- [ ] Le texte actif est **blanc**
- [ ] Le bouton inactif a un fond **gris clair**
- [ ] Icons changent : 🔍 pour rechercher, ➕ pour créer

#### Zone de Saisie
- [ ] Placeholder change selon le mode sélectionné
- [ ] Bouton GPS avec icône de localisation
- [ ] Quand GPS sélectionné : coordonnées affichées
- [ ] Bouton ❌ rouge pour supprimer la localisation

#### Bouton d'Action Principal
- [ ] Grand bouton avec gradient orange (clair → foncé)
- [ ] Icône à gauche, texte au centre, flèche à droite (→)
- [ ] Texte change : "Rechercher" ou "Créer maintenant"
- [ ] Ombre colorée orange sous le bouton
- [ ] Désactivé si champ vide (gris et opaque)

#### Section Statistiques
- [ ] 3 cartes blanches côte à côte
- [ ] Icônes : ⚡ Rapide | 🛡️ Sécurisé | 👥 Communauté
- [ ] Chaque carte a une ombre légère

#### Comment ça marche
- [ ] Titre "Comment ça marche ?" en gras
- [ ] 3 étapes numérotées (1, 2, 3)
- [ ] Numéros dans des cercles **oranges**
- [ ] Description claire pour chaque étape

### ❌ Ce qui NE DOIT PAS être visible
- [ ] ❌ Texte `{'\n'}` littéral
- [ ] ❌ Section "Accès rapide" avec 4 boutons
- [ ] ❌ Onglet "Menu" en bas
- [ ] ❌ QuickActionsMenu modal

### Barre de Navigation (En Bas)

#### Vérifier les 5 Onglets
1. [ ] 🏠 **Accueil** - Icône maison
2. [ ] 💼 **Services** - Icône porte-documents
3. [ ] 💰 **Tokens** - Icône portefeuille
4. [ ] 📊 **Stats** - Icône graphique
5. [ ] 👤 **Profil** - Icône personne

#### Comportement
- [ ] L'onglet actif est en **orange** (#FF8C00)
- [ ] Les onglets inactifs sont **gris** (#999)
- [ ] Les icônes sont pleines quand actif, outline quand inactif
- [ ] Texte en dessous de chaque icône
- [ ] Hauteur de 65px environ
- [ ] Ombre légère au-dessus de la barre

### Test de Navigation

#### Depuis l'Accueil
- [ ] Cliquer sur "Services" → Doit afficher Mes Services
- [ ] Cliquer sur "Tokens" → Doit afficher Recharge Tokens
- [ ] Cliquer sur "Stats" → Doit afficher Dashboard
- [ ] Cliquer sur "Profil" → Doit afficher Profil
- [ ] Retour sur "Accueil" → Retour à la page d'accueil

#### Navigation Secondaire
- [ ] Taper du texte et cliquer "Rechercher" → Va vers RechercheBesoin
- [ ] Mode "Créer" + texte + clic → Va vers CreateService
- [ ] Depuis chaque page, le bouton retour fonctionne
- [ ] Depuis les pages secondaires, on revient aux onglets

### Test des Fonctionnalités

#### Mode Recherche
1. [ ] Sélectionner "Rechercher"
2. [ ] Taper "coiffeur"
3. [ ] Ajouter GPS (optionnel)
4. [ ] Cliquer "Rechercher"
5. [ ] Doit naviguer vers RechercheBesoin

#### Mode Création
1. [ ] Sélectionner "Créer un service"
2. [ ] Taper "Je propose des cours de piano"
3. [ ] Ajouter GPS
4. [ ] Cliquer "Créer maintenant"
5. [ ] Doit naviguer vers CreateService

#### GPS
1. [ ] Cliquer sur le bouton GPS
2. [ ] Modal de sélection GPS s'ouvre
3. [ ] Sélectionner une position
4. [ ] Coordonnées affichées
5. [ ] Cliquer sur ❌ → Coordonnées disparaissent

### Problèmes Potentiels à Vérifier

#### Si `{'\n'}` apparaît encore :
→ Le fichier HomeScreen.tsx n'a pas été remplacé correctement

#### Si "Accès rapide" est toujours là :
→ Vérifier que HomeScreen-modern.tsx a bien été copié sur HomeScreen.tsx

#### Si l'onglet "Menu" est encore là :
→ Vérifier que AppNavigator-modern.tsx a bien été copié sur AppNavigator.tsx

#### Si les gradients ne fonctionnent pas :
→ Vérifier que expo-linear-gradient est installé : `npm list expo-linear-gradient`

#### Si une page manque (erreur de navigation) :
→ Vérifier que tous les écrans existent dans `src/screens/`

## 🐛 Debug Logs à Vérifier

Dans DevLogs (en bas), vous devriez voir :
```
[AppNavigator] user exists: true
[AppNavigator] loading: false
[AppNavigator] ✅ Affichage MainStack
```

## 📸 Captures d'Écran Attendues

### Page d'Accueil - En Haut
```
┌─────────────────────────────────────────┐
│ Bonjour 👋                 🔔 (3)     │
│ [Nom Utilisateur]                      │
│ 💰 [X tokens]                          │
└─────────────────────────────────────────┘
```

### Titre
```
    Yukpomnang
    (Orange)(Noir)(Gris)
    
Trouvez ou créez un service
      en quelques secondes
```

### Sélecteur
```
┌──────────────────────────────────────┐
│ [🔍 Rechercher] | [➕ Créer un service] │
│   (Orange/Blanc)  (Gris/Noir)        │
└──────────────────────────────────────┘
```

### Bouton Principal
```
┌───────────────────────────────────────┐
│ [🔍] Rechercher [→]                   │
│  (Gradient Orange avec ombre)         │
└───────────────────────────────────────┘
```

### Barre de Navigation
```
┌─────────────────────────────────────────┐
│  🏠     💼      💰      📊      👤    │
│ Accueil Services Tokens Stats  Profil │
│ Orange   Gris    Gris   Gris   Gris  │
└─────────────────────────────────────────┘
```

## ✅ Checklist Finale

- [ ] Aucun `{'\n'}` visible
- [ ] Pas de section "Accès rapide"
- [ ] 5 onglets en bas (pas de "Menu")
- [ ] Design moderne avec couleurs orange/blanc/gris
- [ ] Gradients sur le bouton principal
- [ ] Ombres sur les cartes
- [ ] Navigation fonctionne entre tous les onglets
- [ ] GPS fonctionne
- [ ] Mode recherche/création switch correctement

## 🎯 Si Tout Fonctionne

Vous devriez avoir :
- ✅ Une interface moderne et épurée
- ✅ Navigation intuitive à 5 onglets
- ✅ Couleurs vibrantes et professionnelles
- ✅ UX fluide sans friction
- ✅ Feedback visuel sur toutes les actions

## 🚨 En Cas de Problème

1. **Vérifier les fichiers :**
   ```bash
   cd mobile
   cat src/screens/HomeScreen.tsx | Select-String "Accès rapide"
   # Ne doit rien retourner
   
   cat src/navigation/AppNavigator.tsx | Select-String "QuickMenu"
   # Ne doit rien retourner
   ```

2. **Vérifier les packages :**
   ```bash
   npm list expo-linear-gradient
   # Doit être installé
   ```

3. **Nettoyer le cache :**
   ```bash
   npx expo start --clear
   ```

4. **Rebuild :**
   ```bash
   npx eas build --platform android --profile preview
   ```

---

**Testez maintenant et partagez-moi des captures d'écran ! 📸**


