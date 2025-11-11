## Dépendances système pour la génération vidéo

Ces composants sont obligatoires sur chaque machine (local, CI, production) qui exécute `video_generation_service.rs`.

### 1. FFmpeg
- Conversion images → vidéo, transitions, mixage audio.
- Tester avec `ffmpeg -version`.

### 2. espeak (fallback voix-off)
- Utilisé si la synthèse IA échoue.
- Tester avec `espeak "Bonjour Yukpo"`.

### 3. Polices TrueType
- `DejaVuSans-Bold.ttf` (ou `Arial`) nécessaires pour les overlays `drawtext`.
- Si la police est ailleurs, définir `UPLOAD_FONT_PATH`.

### Installation rapide
```bash
cd scripts
chmod +x install_media_dependencies.sh
./install_media_dependencies.sh
```

### Cas Windows (PowerShell administrateur)
```powershell
choco install ffmpeg
choco install espeak
# Copier une police TTF (ex. Arial) dans C:\Windows\Fonts
```

### Vérification complète
```bash
ffmpeg -version
espeak --version
fc-list | grep -i "DejaVuSans"
```

### Variables d’environnement utiles
| Variable             | Description                                                        |
|---------------------|--------------------------------------------------------------------|
| `UPLOAD_FONT_PATH`  | Chemin absolu du TTF si différent des emplacements détectés.       |
| `UPLOAD_STORAGE_PATH` | Répertoire où les vidéos sont écrites (droits R/W nécessaires).  |
| `PREMIUM_TTS_ENDPOINT` | URL HTTP(s) du fournisseur voix premium (optionnel).            |
| `PREMIUM_TTS_API_KEY`  | Clé API associée à la voix premium.                              |
| `PREMIUM_TTS_VOICE`    | Identifiant de la voix à utiliser (ex. `yukpo-premium-fr`).      |

Maintenir ces prérequis synchronisés avec tout pipeline (CI/CD) et lors des déploiements manuels.

