Fichier attendu pour FFmpeg : yukpo_logo.png (PNG, transparence recommandee).

L’application mobile utilise deja le meme visuel Yukpo comme icone Expo :
  mobile/assets/icon.png   (voir mobile/app.config.js : icon, splash, adaptive-icon)

Ce dossier backend est separe : en production, copiez yukpo_logo.png ici (souvent une exportation
du meme graphisme que icon.png) pour la signature / watermark video.

En developpement monorepo, le service essaie aussi automatiquement mobile/assets/icon.png
si yukpo_logo.png est absent.
