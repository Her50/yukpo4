# Corrections de Détection d'Intention - Yukpo

## 🔍 Problème Identifié

L'erreur "Prompt not found for intention: question_generale" était due à des incohérences entre :
- Les noms d'intentions dans les prompts spécifiques
- Les noms d'intentions dans le détecteur d'intention
- Les noms d'intentions dans les instructions originales

## ✅ Corrections Apportées

### 1. Harmonisation des Noms d'Intentions

**Avant :**
- Prompt `question_generale_prompt.md` → `"intention": "question_generale"`
- Instructions originales → `"assistance_generale"`
- Détecteur → `"question_generale"`

**Après :**
- Tous les prompts utilisent maintenant `"assistance_generale"` pour les questions générales
- Cohérence avec les instructions originales

### 2. Correction des Prompts Spécifiques

#### `question_generale_prompt.md` → `assistance_generale`
```json
{
  "intention": "assistance_generale",
  "texte": {
    "type_donnee": "string",
    "valeur": "Question ou demande utilisateur",
    "origine_champs": "texte_libre"
  },
  "reponse_ia": {
    "type_donnee": "string",
    "valeur": "Réponse claire, utile et synthétique",
    "origine_champs": "ia"
  }
}
```

#### `recherche_service_prompt.md` → `recherche_besoin`
```json
{
  "intention": "recherche_besoin",
  "titre": { "type_donnee": "string", "valeur": "...", "origine_champs": "ia" },
  "description": { "type_donnee": "string", "valeur": "...", "origine_champs": "texte_libre" },
  "category": { "type_donnee": "string", "valeur": "...", "origine_champs": "ia" },
  "reponse_intelligente": { "type_donnee": "string", "valeur": "...", "origine_champs": "ia" }
}
```

#### `creation_service_prompt.md`
```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": { "type_donnee": "string", "valeur": "...", "origine_champs": "texte_libre" },
    "description": { "type_donnee": "string", "valeur": "...", "origine_champs": "texte_libre" },
    "category": { "type_donnee": "string", "valeur": "...", "origine_champs": "ia" },
    "is_tarissable": { "type_donnee": "boolean", "valeur": true, "origine_champs": "ia" }
  }
}
```

#### `echange_prompt.md`
```json
{
  "intention": "echange",
  "mode": "echange",
  "mode_troc": "echange",
  "gps": { "lat": 4.0511, "lon": 9.7679 },
  "offre": { "nom": "...", "categorie": "...", "etat": "...", "description": "..." },
  "besoin": { "nom": "...", "categorie": "...", "etat": "...", "description": "..." }
}
```

### 3. Correction du Détecteur d'Intention

**Fichier :** `backend/src/services/ia/intention_detector.rs`

- Ajout des règles de détection strictes selon les instructions originales
- Mapping correct des intentions :
  - `"je cherche"` → `recherche_besoin`
  - `"je vends"` → `creation_service`
  - `"j'échange"` → `echange`
  - Questions générales → `assistance_generale`
  - Programme scolaire → `programme_scolaire`

### 4. Correction du Gestionnaire de Prompts

**Fichier :** `backend/src/services/ia/prompt_manager.rs`

- Correction des chemins de fichiers pour pointer vers `ia_prompts/`
- Mapping correct des intentions vers les fichiers de prompts

## 🧪 Tests

### Script de Test
- `test_intention_detection.py` : Teste la détection d'intention avec différents types de demandes
- `test_intention_corrections.bat` : Script batch pour lancer les tests

### Cas de Test
1. **Question générale** → `assistance_generale`
2. **Création de service** → `creation_service`
3. **Recherche de besoin** → `recherche_besoin`
4. **Échange** → `echange`
5. **Question sur le fonctionnement** → `assistance_generale`

## 🎯 Résultat Attendu

- Plus d'erreur "Prompt not found for intention"
- Détection d'intention cohérente avec les instructions originales
- Structure JSON conforme aux schémas Yukpo
- Respect des règles de typage et d'origine des champs

## 🚀 Utilisation

```bash
# Dans le dossier backend
./test_intention_corrections.bat
```

Ou manuellement :
```bash
cargo run  # Terminal 1
python test_intention_detection.py  # Terminal 2
```

## 📋 Vérifications

Après les corrections, vérifiez que :
1. ✅ Le backend compile sans erreur
2. ✅ L'IA détecte correctement les intentions
3. ✅ Les prompts spécifiques sont trouvés et utilisés
4. ✅ La structure JSON générée respecte les schémas
5. ✅ Plus d'erreur "Prompt not found" 