# Corrections Timeout app_ia.rs

## À appliquer dans la fonction `pub async fn predict`

Chercher cette section (vers ligne 2300-2500):
```rust
// ✅ CORRECTION Phase 10: Timeout augmenté à 60s pour éviter timeouts extrêmes
let timeout_duration = Duration::from_secs(60);
```

Remplacer par:
```rust
// ✅ CORRECTION Phase 10: Timeout configurable selon type de requête
// Détecter si c'est une requête de génération vidéo
let is_video_generation = prompt.contains("generate") 
    || prompt.contains("video") 
    || prompt.contains("storyboard")
    || prompt.contains("clip")
    || prompt.contains("timeline")
    || prompt.contains("scene");

// Timeout configurable depuis variable d'environnement
let ai_timeout = std::env::var("AI_REQUEST_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(120); // 2 minutes par défaut

// Timeout plus long pour génération vidéo
let timeout_duration = if is_video_generation {
    Duration::from_secs(ai_timeout * 5) // 10 minutes pour génération vidéo
} else {
    Duration::from_secs(60) // 1 minute pour requêtes simples
};

log::debug!(
    "[AppIA] Timeout configuré: {}s (génération vidéo: {})",
    timeout_duration.as_secs(),
    is_video_generation
);
```

