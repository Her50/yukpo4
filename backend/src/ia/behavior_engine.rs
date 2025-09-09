// ?? backend/src/ia/behavior_engine.rs

use crate::core::alerts::{send_email, send_whatsapp};
use crate::core::infraction_log::{log_infraction, should_block};

/// ?? Calcule un score de comportement utilisateur bas? sur l?IP, l?URL visit?e et la fr?quence des requ?tes.
pub fn compute_behavior_score(_ip: &str, path: &str, freq: u32) -> u32 {
    let mut score = 0;

    if path.contains("login") || path.contains("auth") {
        score += 40;
    }

    if freq > 10 {
        score += 20;
    }

    if path.contains("api") {
        score += 10;
    }

    score
}

/// ?? D?termine si le comportement est suspect et d?clenche les alertes (log + email + WhatsApp si r?cidive)
pub fn is_suspicious(score: u32, ip: &str, path: &str) -> bool {
    if score >= 50 {
        log_infraction(ip, path);

        if let Some(_duration) = should_block(ip) {
            let msg = format!("?? R?cidive d?tect?e sur IP {} (score {})", ip, score);
            let _ = send_email("admin@yukpomnang.com", "Alerte s?curit? IA", &msg);
            let _ = send_whatsapp("+237699999999", &msg);
            return true;
        }
    }

    score >= 50
}
