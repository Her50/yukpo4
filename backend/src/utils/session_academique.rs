//! Session académique — calcul par pays.
//!
//! Règle par défaut (Afrique francophone + anglophone de la région) :
//!   mois 1-5  (janv-mai) → année_précédente / année_courante
//!   mois 6-12 (juin-déc) → année_courante / année_suivante
//!
//! Miroir de `frontend/src/utils/sessionAcademique.ts`.

use chrono::{Datelike, Utc};

/// Mois de bascule (1-12) par code pays ISO-2.
fn rentree_start_month(pays: &str) -> u32 {
    match pays {
        "CM" | "CI" | "SN" | "GA" | "CG" | "CD" | "BJ" | "TG" | "BF" | "ML" | "NE" | "NG"
        | "GH" => 6,
        _ => 6,
    }
}

#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub annee: String, // "2025-2026"
    pub debut: i32,
    pub fin: i32,
    pub pays: String,
}

/// Calcule la session académique pour un pays à une date donnée.
pub fn compute_session_academique(pays: &str, at: Option<chrono::DateTime<Utc>>) -> SessionInfo {
    let at = at.unwrap_or_else(Utc::now);
    let year = at.year();
    let month = at.month();
    let start = rentree_start_month(pays);
    let pays = pays.to_string();

    if month >= start {
        SessionInfo {
            annee: format!("{}-{}", year, year + 1),
            debut: year,
            fin: year + 1,
            pays,
        }
    } else {
        SessionInfo {
            annee: format!("{}-{}", year - 1, year),
            debut: year - 1,
            fin: year,
            pays,
        }
    }
}

/// Parse "2025-2026" → (2025, 2026), None si invalide.
pub fn parse_session_string(s: &str) -> Option<(i32, i32)> {
    let parts: Vec<&str> = s.split(|c| c == '-' || c == '–').map(str::trim).collect();
    if parts.len() != 2 {
        return None;
    }
    let debut: i32 = parts[0].parse().ok()?;
    let fin: i32 = parts[1].parse().ok()?;
    if fin != debut + 1 {
        return None;
    }
    Some((debut, fin))
}

pub fn is_session_coherente(detected: &str, expected: &SessionInfo) -> bool {
    match parse_session_string(detected) {
        Some((d, f)) => d == expected.debut && f == expected.fin,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn september_2026_cm() {
        let s = compute_session_academique(
            "CM",
            Some(Utc.with_ymd_and_hms(2026, 9, 1, 0, 0, 0).unwrap()),
        );
        assert_eq!(s.annee, "2026-2027");
    }

    #[test]
    fn march_2026_cm() {
        let s = compute_session_academique(
            "CM",
            Some(Utc.with_ymd_and_hms(2026, 3, 1, 0, 0, 0).unwrap()),
        );
        assert_eq!(s.annee, "2025-2026");
    }

    #[test]
    fn parse_ok() {
        assert_eq!(parse_session_string("2025-2026"), Some((2025, 2026)));
        assert_eq!(parse_session_string("2025 – 2026"), Some((2025, 2026)));
        assert_eq!(parse_session_string("2025-2027"), None);
    }
}
