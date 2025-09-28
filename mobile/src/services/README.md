# Système de Traduction Mobile - Yukpomnang

## Vue d'ensemble

Le système de traduction mobile de Yukpomnang permet de traduire automatiquement l'interface utilisateur dans plusieurs langues en utilisant l'API Google Translate.

## Composants principaux

### 1. TranslationService (`translationService.ts`)

Service principal qui gère :
- La traduction de textes via l'API Google Translate
- La détection automatique de langue
- La mise en cache des traductions
- La gestion des langues supportées

**Utilisation :**
```typescript
import TranslationService from '../services/translationService';

const service = TranslationService.getInstance();
const result = await service.translateText('Bonjour', 'en');
console.log(result.translatedText); // "Hello"
```

### 2. Hook useTranslation (`useTranslation.ts`)

Hook React personnalisé qui fournit :
- L'état de traduction actuel
- Les fonctions de traduction
- La gestion de la langue courante
- La gestion du cache

**Utilisation :**
```typescript
import { useTranslation } from '../hooks/useTranslation';

const MyComponent = () => {
  const { translate, currentLanguage, setLanguage } = useTranslation();
  
  const handleTranslate = async () => {
    const translated = await translate('Bonjour', 'en');
    console.log(translated);
  };
  
  return (
    <View>
      <Text>Langue actuelle: {currentLanguage}</Text>
      <Button onPress={handleTranslate}>Traduire</Button>
    </View>
  );
};
```

### 3. Composant TranslatedText (`TranslatedText.tsx`)

Composant qui traduit automatiquement un texte :
- Traduction automatique au montage
- Gestion des états de chargement
- Fallback vers le texte original

**Utilisation :**
```typescript
import TranslatedText from '../components/TranslatedText';

<TranslatedText 
  text="Bonjour le monde" 
  targetLanguage="en"
  onTranslationComplete={(translated) => console.log(translated)}
/>
```

### 4. Composant LanguageSelector (`LanguageSelector.tsx`)

Interface de sélection de langue :
- Liste des langues supportées
- Sélection avec drapeaux
- Sauvegarde automatique de la préférence

**Utilisation :**
```typescript
import LanguageSelector from '../components/LanguageSelector';

<LanguageSelector
  visible={showLanguageModal}
  onClose={() => setShowLanguageModal(false)}
  onLanguageChange={(languageCode) => console.log('Langue changée:', languageCode)}
/>
```

## Configuration

### Variables d'environnement

Créez un fichier `.env` dans le dossier `mobile/` :

```env
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
```

### Configuration dans `environment.ts`

```typescript
export const ENVIRONMENT = {
  GOOGLE_TRANSLATE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY || '',
  TRANSLATION: {
    DEFAULT_LANGUAGE: 'fr',
    SUPPORTED_LANGUAGES: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko', 'ru', 'hi'],
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 heures
    MAX_CACHE_SIZE: 1000,
  },
};
```

## Langues supportées

- 🇫🇷 Français (fr) - Langue par défaut
- 🇺🇸 English (en)
- 🇪🇸 Español (es)
- 🇩🇪 Deutsch (de)
- 🇮🇹 Italiano (it)
- 🇵🇹 Português (pt)
- 🇸🇦 العربية (ar)
- 🇨🇳 中文 (zh)
- 🇯🇵 日本語 (ja)
- 🇰🇷 한국어 (ko)
- 🇷🇺 Русский (ru)
- 🇮🇳 हिन्दी (hi)

## Fonctionnalités

### Traduction automatique
- Détection automatique de la langue source
- Traduction vers la langue sélectionnée
- Mise en cache pour optimiser les performances

### Gestion du cache
- Cache local des traductions
- Expiration automatique du cache
- Limite de taille du cache

### Gestion des erreurs
- Fallback vers le texte original en cas d'erreur
- Gestion des erreurs réseau
- Logs détaillés pour le débogage

## Intégration dans les pages

### Exemple d'intégration dans HomeScreen

```typescript
import TranslatedText from '../components/TranslatedText';
import LanguageSelector from '../components/LanguageSelector';

const HomeScreen = () => {
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  return (
    <View>
      <Text>
        <TranslatedText text="Bonjour le monde" />
      </Text>
      
      <Button onPress={() => setShowLanguageModal(true)}>
        <TranslatedText text="Changer la langue" />
      </Button>
      
      <LanguageSelector
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />
    </View>
  );
};
```

## Bonnes pratiques

1. **Utilisez TranslatedText pour les textes statiques**
2. **Utilisez le hook useTranslation pour les textes dynamiques**
3. **Gérez les états de chargement avec isTranslating**
4. **Testez avec différentes langues**
5. **Vérifiez que la clé API Google Translate est configurée**

## Dépannage

### Problèmes courants

1. **Traductions non affichées**
   - Vérifiez que la clé API Google Translate est configurée
   - Vérifiez la connexion internet
   - Consultez les logs de la console

2. **Erreurs de traduction**
   - Vérifiez que la langue cible est supportée
   - Vérifiez le format du texte à traduire
   - Consultez les logs d'erreur

3. **Performance lente**
   - Vérifiez la taille du cache
   - Optimisez les appels de traduction
   - Utilisez la traduction par lot pour plusieurs textes

## Support

Pour toute question ou problème, consultez :
- Les logs de la console
- La documentation de l'API Google Translate
- Les tests unitaires du service de traduction



