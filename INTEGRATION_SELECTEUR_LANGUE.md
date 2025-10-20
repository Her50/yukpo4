# 🌍 Intégration Sélecteur de Langue - 7 Langues Mondiales

## ✅ MOBILE - TERMINÉ

### 🎯 Langues implémentées (7 plus parlées)

| Rang | Langue | Code | Nom natif | Locuteurs | Drapeau |
|------|--------|------|-----------|-----------|---------|
| 1 | Anglais | en | English | 1.5B | 🇬🇧 |
| 2 | Chinois | zh | 中文 | 1.1B | 🇨🇳 |
| 3 | Hindi | hi | हिन्दी | 600M | 🇮🇳 |
| 4 | Espagnol | es | Español | 560M | 🇪🇸 |
| 5 | Français | fr | Français | 280M | 🇫🇷 |
| 6 | Arabe | ar | العربية | 274M | 🇸🇦 |
| 7 | Russe | ru | Русский | 258M | 🇷🇺 |

---

### 📂 Fichiers créés

#### 1️⃣ `mobile/src/components/LanguageSelector.tsx` (300 lignes)

**Fonctionnalités** :
- ✅ **Version compacte** : Bouton `🇫🇷 FR ▼` pour le header
- ✅ **Modal élégant** : Liste déroulante avec drapeaux
- ✅ **Version complète** : Pour la page Settings
- ✅ **7 langues** : Avec nom natif, drapeau, nombre de locuteurs
- ✅ **Sélection visuelle** : Check mark sur langue sélectionnée
- ✅ **Animation** : Modal slide from bottom

**Composant** :
```tsx
<LanguageSelector
  selectedLanguage={language}
  onLanguageChange={setLanguage}
  compact={true}  // true = version header, false = version settings
/>
```

**Design** :
- Bouton arrondi avec drapeau + code langue
- Modal avec header, liste scrollable, footer info
- Couleurs modernColors
- Icônes SafeIcon

---

#### 2️⃣ `mobile/src/contexts/LanguageContext.tsx` (200 lignes)

**Fonctionnalités** :
- ✅ **Context React** : Gestion globale de la langue
- ✅ **Persistance** : Sauvegarde dans AsyncStorage
- ✅ **Hook** : `useLanguage()` pour accéder à la langue
- ✅ **Traductions de base** : 7 langues x 10 clés
- ✅ **Fonction `t()`** : Traduction simple (extensible avec i18n)

**Usage** :
```tsx
const { language, setLanguage, t } = useLanguage();

// Changer la langue
setLanguage('es'); // Espagnol

// Utiliser une traduction
<Text>{t('home.title')}</Text>  // "Inicio" en espagnol
```

**Traductions incluses** :
```typescript
translations = {
  fr: {
    'home.title': 'Accueil',
    'services.title': 'Mes Services',
    'button.create': 'Créer',
    ...
  },
  en: {
    'home.title': 'Home',
    'services.title': 'My Services',
    'button.create': 'Create',
    ...
  },
  es: {
    'home.title': 'Inicio',
    'services.title': 'Mis Servicios',
    'button.create': 'Crear',
    ...
  },
  // + zh, hi, ar, ru
}
```

---

### 🔧 Intégration dans l'app

#### 1️⃣ Provider global (`mobile/App.tsx`)

```tsx
// Import
import { LanguageProvider } from './src/contexts/LanguageContext';

// Wrapping
<LanguageProvider>
  <AuthProvider>
    ...
  </AuthProvider>
</LanguageProvider>
```

#### 2️⃣ HomeScreen header (`mobile/src/screens/HomeScreen.tsx`)

```tsx
// Import
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';

// Dans le composant
const { language, setLanguage } = useLanguage();

// Dans le header (après l'avatar)
<View style={styles.avatarContainer}>
  <UserAvatarMenu ... />
</View>

{/* 🌍 Sélecteur de langue */}
<LanguageSelector
  selectedLanguage={language}
  onLanguageChange={setLanguage}
  compact={true}
/>

<View style={styles.brandTitleContainer}>
  ...
</View>
```

---

## 🎨 Affichage Modal Sélecteur

```
┌──────────────────────────────────────┐
│ 🌍 Choisir la langue             ✕  │
├──────────────────────────────────────┤
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 🇬🇧  English                  │  │
│ │     English • 1.5B locuteurs   │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 🇨🇳  中文                       │  │
│ │     Chinese • 1.1B locuteurs   │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 🇪🇸  Español                   │  │
│ │     Spanish • 560M locuteurs   │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 🇫🇷  Français              ✓   │  │
│ │     French • 280M locuteurs    │  │
│ └────────────────────────────────┘  │
│                                      │
│ ... (autres langues)                 │
│                                      │
├──────────────────────────────────────┤
│ ℹ️  La traduction sera disponible   │
│    prochainement pour toutes langues │
└──────────────────────────────────────┘
```

---

## 🌐 FRONTEND - À FAIRE

### 1️⃣ Créer `frontend/src/components/LanguageSelector.tsx`

**Structure identique au mobile** avec adaptations React Web :
```tsx
import { useState } from 'react';
import { Globe, Check, ChevronDown, X } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speakers: '1.5B' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', speakers: '1.1B' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speakers: '600M' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speakers: '560M' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speakers: '280M' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', speakers: '274M' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', speakers: '258M' },
];

const LanguageSelector = ({ selectedLanguage = 'fr', onLanguageChange, compact = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentLanguage = LANGUAGES.find(lang => lang.code === selectedLanguage) || LANGUAGES[4];

  if (compact) {
    // Version compacte pour header
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full hover:bg-white/30 transition"
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <span className="text-xs font-bold text-white">{currentLanguage.code.toUpperCase()}</span>
          <ChevronDown className="w-3 h-3 text-white" />
        </button>

        {isOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-2xl p-4 w-80 max-h-96 overflow-auto z-50">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-lg">Choisir la langue</h3>
                </div>
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              {/* Liste des langues */}
              {LANGUAGES.map((lang) => {
                const isSelected = lang.code === selectedLanguage;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg mb-2 transition ${
                      isSelected
                        ? 'bg-indigo-50 border-2 border-indigo-600'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{lang.flag}</span>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{lang.nativeName}</p>
                        <p className="text-xs text-gray-500">
                          {lang.name} • {lang.speakers} locuteurs
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-6 h-6 text-indigo-600" />
                    )}
                  </button>
                );
              })}

              {/* Footer */}
              <div className="flex items-center space-x-2 pt-4 mt-4 border-t">
                <Globe className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500">
                  La traduction sera disponible prochainement
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Version complète (pour Settings)
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Langue de l'application</h3>
      {LANGUAGES.map((lang) => {
        const isSelected = lang.code === selectedLanguage;
        return (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition ${
              isSelected
                ? 'bg-indigo-50 border-2 border-indigo-600'
                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
            }`}
          >
            <div className="flex items-center space-x-4">
              <span className="text-3xl">{lang.flag}</span>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{lang.nativeName}</p>
                <p className="text-sm text-gray-500">
                  {lang.name} • {lang.speakers} locuteurs
                </p>
              </div>
            </div>
            {isSelected && <Check className="w-6 h-6 text-indigo-600" />}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSelector;
```

---

### 2️⃣ Créer `frontend/src/contexts/LanguageContext.tsx`

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr',
  setLanguage: () => {},
  t: (key) => key,
});

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>('fr');

  // Charger la langue sauvegardée
  useEffect(() => {
    const savedLanguage = localStorage.getItem('app_language');
    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    console.log('[Language] Langue changée:', lang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['fr']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Traductions (identiques au mobile)
const translations: { [lang: string]: { [key: string]: string } } = {
  // ... (copier depuis mobile/src/contexts/LanguageContext.tsx)
};
```

---

### 3️⃣ Intégrer dans `frontend/src/App.tsx`

```tsx
// Import
import { LanguageProvider } from './contexts/LanguageContext';

// Wrapping
<LanguageProvider>
  <AuthProvider>
    ...
  </AuthProvider>
</LanguageProvider>
```

---

### 4️⃣ Ajouter dans le header (HomePage ou Layout)

```tsx
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

const HomePage = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="relative">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          {/* Avatar + Langue */}
          <div className="flex items-center space-x-4">
            <UserAvatar />
            <LanguageSelector
              selectedLanguage={language}
              onLanguageChange={setLanguage}
              compact={true}
            />
          </div>

          {/* Titre Yukpo */}
          <h1 className="text-3xl font-bold">
            <span className="text-yellow-300">Yuk</span>
            <span className="text-white">po</span>
          </h1>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <button>🔔</button>
            <button>💬</button>
          </div>
        </div>
      </header>
      ...
    </div>
  );
};
```

---

## 🎯 FONCTIONNALITÉS

### Version Compacte (Header)
```
┌──────────────┐
│ 🇫🇷 FR  ▼   │  ← Clic pour ouvrir
└──────────────┘
```

### Modal Ouvert
```
┌─────────────────────────────────┐
│ 🌍 Choisir la langue        ✕  │
├─────────────────────────────────┤
│ 🇬🇧 English                     │
│    English • 1.5B locuteurs     │
├─────────────────────────────────┤
│ 🇨🇳 中文                         │
│    Chinese • 1.1B locuteurs     │
├─────────────────────────────────┤
│ 🇫🇷 Français                ✓  │ ← Sélectionné
│    French • 280M locuteurs      │
├─────────────────────────────────┤
│ ... autres langues               │
├─────────────────────────────────┤
│ ℹ️ Traduction prochainement      │
└─────────────────────────────────┘
```

---

## ✅ CHECKLIST

### Mobile
- [x] Composant `LanguageSelector.tsx` créé
- [x] Context `LanguageContext.tsx` créé
- [x] Provider ajouté dans `App.tsx`
- [x] Intégré dans HomeScreen header
- [x] 7 langues avec drapeaux
- [x] Persistance AsyncStorage
- [x] Traductions de base (10 clés)

### Frontend
- [ ] Créer `LanguageSelector.tsx`
- [ ] Créer `LanguageContext.tsx`
- [ ] Ajouter Provider dans App
- [ ] Intégrer dans header
- [ ] Tester sélection langue
- [ ] Vérifier localStorage

---

## 🔧 AMÉLIORATION FUTURE (i18n complet)

### Installation react-i18next
```bash
npm install react-i18next i18next
```

### Configuration
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./locales/en.json') },
      fr: { translation: require('./locales/fr.json') },
      es: { translation: require('./locales/es.json') },
      // ...
    },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });
```

### Usage avec i18n
```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('home.title')}</h1>
      <button onClick={() => i18n.changeLanguage('es')}>
        Español
      </button>
    </div>
  );
};
```

---

## 🎉 RÉSUMÉ

**Mobile** :
- ✅ Sélecteur de langue créé et intégré
- ✅ 7 langues mondiales
- ✅ Context global avec persistance
- ✅ Traductions de base
- ✅ Design moderne et élégant

**Frontend** :
- 📝 Documentation complète fournie
- 📝 Code prêt à copier
- 📝 Structure identique au mobile

**Localisation** : HomeScreen > Header > Après avatar > 🇫🇷 FR ▼

**Prochaine étape** : Implémenter traductions complètes avec i18n 🌍

