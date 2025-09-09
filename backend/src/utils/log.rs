// ?? src/utils/log.rs

/// ?? Logger centralis? pour anomalies et ?v?nements
pub fn log_rejet_taille(nom: &str, taille: usize, limite: usize) {
    eprintln!(
        "?? [REJET] Fichier '{}' ignor? ({} o > limite autoris?e de {} o)",
        nom, taille, limite
    );
}

pub fn log_info(message: &str) {
    println!("?? [INFO] {}", message);
}

pub fn log_warn(message: &str) {
    eprintln!("?? [AVERTISSEMENT] {}", message);
}

pub fn log_error(message: &str) {
    eprintln!("? [ERREUR] {}", message);
}





