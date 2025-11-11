## Pipeline Audio Avancée

### Objectifs
- Mixage multi-pistes (musique, voix, effets sonores).
- Spatialisation (stéréo dynamique, binaural, Dolby).
- Normalisation (LUFS) et mastering.
- Recommandations IA / bancs SFX.

### 1. Étapes
1. **Sélection musique**  
   - IA choisit la piste (libraries curated + trending).  
   - Calcul BPM, tonalité.
2. **Voix premium**  
   - Pré-traitement script (nettoyage, phonétique).  
   - TTS premium (ElevenLabs etc) + fallback interne.
3. **FX / ambiance**  
   - SFX (claps, transition) synchronisés message.  
   - Filtres (reverb, delay, riser).
4. **Mixage**  
   - Gains (voix dominante).  
   - Spatialisation (pan left/right, automation).  
   - Automations intensité (intro/outro).
5. **Mastering**  
   - Normalisation (LUFS -14).  
   - Limiter + compression multiband.  
   - Export WAV haute qualité -> intégration FFmpeg.

### 2. Technologies
- `ffmpeg` filtres audio (pan, afade, alimiter...).  
- API Dolby.io ou AudioShake pour spatialisation/mastering rapide.  
- Node `sox`, `ffmpeg` scripts automatisés.  
- Bibliothèque SFX (répertoire ou API).
  
### 3. Étapes projet
- P0 : script mixage FFmpeg (voix + musique + SFX).  
- P1 : spatialisation basique (paning).  
- P2 : mastering (Dolby API).  
- P3 : IA recommandation SFX (gpt instructions).

### 4. Données
- SFX packs (transitions, glitch, pop).  
- Paramètres JSON (volumes, pan, fade).

### 5. Intégration
- `audio_pipeline.rs` orchestrant mix (Rust -> ffmpeg).  
- Envoi métadonnées audio dans score qualité.


