# 🎤 Guide de Transcription Audio en Production

## 📋 Vue d'ensemble

Votre application Yukpo dispose maintenant d'une **transcription audio complète prête pour la production** ! 

### ✅ Fonctionnalités implémentées :

1. **Détection automatique** de l'audio dans les inputs utilisateur
2. **Transcription en temps réel** avec OpenAI Whisper API
3. **Fallback automatique** vers Hugging Face si OpenAI échoue
4. **Vectorisation du texte transcrit** pour la recherche Pinecone
5. **Gestion d'erreurs robuste** avec logs détaillés

## 🚀 Configuration requise

### 1. Variables d'environnement

Ajoutez ces variables à votre fichier `.env` :

```bash
# OpenAI Whisper API (recommandé)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Hugging Face Inference API (fallback)
HUGGINGFACE_API_KEY=hf-your-huggingface-api-key-here
```

### 2. Obtenir les clés API

#### OpenAI Whisper API :
1. Créez un compte sur [OpenAI](https://platform.openai.com/)
2. Générez une clé API dans les paramètres
3. La transcription coûte ~$0.006/minute

#### Hugging Face Inference API :
1. Créez un compte sur [Hugging Face](https://huggingface.co/)
2. Générez une clé API dans les paramètres
3. Gratuit pour un usage limité

## 🔧 Flux de traitement

```
Input utilisateur avec audio
         ↓
   Détection audio
         ↓
   Transcription OpenAI Whisper
         ↓ (si échec)
   Transcription Hugging Face
         ↓
   Texte transcrit
         ↓
   Vectorisation Pinecone
         ↓
   Recherche de services
```

## 🧪 Test de la fonctionnalité

### 1. Script de test automatique

```powershell
# Dans le répertoire racine
.\test_audio_transcription.ps1
```

### 2. Test manuel

```bash
# Démarrer le backend
cd backend
cargo run

# Dans un autre terminal, tester avec curl
curl -X POST http://localhost:3001/api/ia/auto \
  -H "Content-Type: application/json" \
  -d '{
    "texte": "Test transcription",
    "audio_base64": ["base64_encoded_audio_data"]
  }'
```

## 📊 Formats audio supportés

- **WAV** (recommandé)
- **MP3**
- **M4A**
- **FLAC**
- **OGG**

### Spécifications recommandées :
- **Sample rate** : 16kHz
- **Channels** : Mono
- **Format** : PCM 16-bit
- **Durée** : Jusqu'à 25MB

## 🔍 Logs et debugging

### Logs de transcription :
```
[TRANSCRIPTION_AUDIO] Début transcription OpenAI Whisper (12345 bytes)
[TRANSCRIPTION_AUDIO] Réponse OpenAI: status 200
[TRANSCRIPTION_AUDIO] Transcription réussie: 'Je cherche un coiffeur à Douala'
```

### Logs de recherche :
```
[RECHERCHE_BESOIN] Audio détecté dans l'input - Transcription avant vectorisation
[RECHERCHE_VECTORIELLE] Recherche avec input original: 'Je cherche un coiffeur à Douala'
```

## ⚡ Optimisations de performance

### 1. Cache de transcription
```rust
// TODO: Implémenter un cache Redis pour éviter les re-transcriptions
let cache_key = format!("transcript:{}", audio_hash);
```

### 2. Traitement en batch
```rust
// TODO: Traiter plusieurs audios en parallèle
let transcriptions = futures::future::join_all(audio_batches).await;
```

### 3. Compression audio
```rust
// TODO: Compresser l'audio avant envoi pour réduire les coûts
let compressed_audio = compress_audio(audio_data).await?;
```

## 🛡️ Sécurité et limites

### Limites de taille :
- **OpenAI** : 25MB max
- **Hugging Face** : 100MB max

### Rate limiting :
- **OpenAI** : 50 requêtes/minute
- **Hugging Face** : 30 requêtes/minute

### Validation :
- Vérification du format audio
- Validation de la taille
- Sanitisation du texte transcrit

## 💰 Coûts estimés

### OpenAI Whisper :
- **$0.006/minute** de transcription
- **Exemple** : 1000 transcriptions de 30s = $3/mois

### Hugging Face :
- **Gratuit** pour usage limité
- **Payant** pour usage intensif

## 🚨 Dépannage

### Erreur "OPENAI_API_KEY non configurée"
```bash
# Vérifier la variable d'environnement
echo $OPENAI_API_KEY
```

### Erreur "Format audio invalide"
```bash
# Vérifier le format de l'audio
file audio.wav
```

### Erreur "Rate limit exceeded"
```bash
# Attendre ou utiliser Hugging Face en fallback
# Les logs montreront automatiquement le fallback
```

## 📈 Monitoring

### Métriques à surveiller :
- Taux de succès de transcription
- Temps de réponse moyen
- Coûts API mensuels
- Erreurs par service

### Alertes recommandées :
- Taux d'échec > 5%
- Temps de réponse > 10s
- Coûts > $50/mois

## 🔄 Mise à jour

Pour mettre à jour la transcription :

1. **Pull** les dernières modifications
2. **Redémarrer** le backend
3. **Tester** avec le script de test
4. **Vérifier** les logs

## 📞 Support

En cas de problème :
1. Vérifiez les logs du backend
2. Testez avec le script de test
3. Vérifiez vos clés API
4. Consultez la documentation OpenAI/Hugging Face

---

**🎯 Votre transcription audio est maintenant prête pour la production !** 