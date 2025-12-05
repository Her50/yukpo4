// ✅ Service de validation pour services spécialisés
// Valide les données avant insertion dans la base de données

use crate::core::types::AppError;
use chrono::{DateTime, NaiveTime, Utc};
use regex::Regex;
use std::str::FromStr;

/// Valide le format GPS (lat,lng)
pub fn validate_gps_format(gps: &str) -> Result<(), AppError> {
    if gps.is_empty() {
        return Ok(()); // Vide est valide (optionnel)
    }

    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() != 2 {
        return Err(AppError::BadRequest(
            "Format GPS invalide. Attendu: 'lat,lng'".to_string(),
        ));
    }

    let lat = parts[0]
        .trim()
        .parse::<f64>()
        .map_err(|_| AppError::BadRequest("Latitude invalide".to_string()))?;
    let lng = parts[1]
        .trim()
        .parse::<f64>()
        .map_err(|_| AppError::BadRequest("Longitude invalide".to_string()))?;

    if lat < -90.0 || lat > 90.0 {
        return Err(AppError::BadRequest(
            "Latitude doit être entre -90 et 90".to_string(),
        ));
    }

    if lng < -180.0 || lng > 180.0 {
        return Err(AppError::BadRequest(
            "Longitude doit être entre -180 et 180".to_string(),
        ));
    }

    Ok(())
}

/// Valide le format email
pub fn validate_email_format(email: &str) -> Result<(), AppError> {
    if email.is_empty() {
        return Ok(()); // Vide est valide (optionnel)
    }

    let email_regex = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        .map_err(|_| AppError::Internal("Erreur regex email".to_string()))?;

    if !email_regex.is_match(email) {
        return Err(AppError::BadRequest("Format email invalide".to_string()));
    }

    Ok(())
}

/// Valide les heures d'ouverture/fermeture pour pharmacies et agences
pub fn validate_opening_hours(
    heures_ouverture: Option<&str>,
    heures_fermeture: Option<&str>,
    permanent_24h: bool,
) -> Result<(), AppError> {
    // Si permanent 24h, pas besoin de valider les heures
    if permanent_24h {
        return Ok(());
    }

    // Si les deux sont None, c'est valide
    if heures_ouverture.is_none() && heures_fermeture.is_none() {
        return Ok(());
    }

    // Si l'un est None et l'autre non, c'est invalide
    if heures_ouverture.is_none() || heures_fermeture.is_none() {
        return Err(AppError::BadRequest(
            "Les heures d'ouverture et de fermeture doivent être renseignées ensemble".to_string(),
        ));
    }

    // Parser les heures
    let ouverture =
        NaiveTime::parse_from_str(heures_ouverture.unwrap(), "%H:%M").map_err(|_| {
            AppError::BadRequest("Format heure d'ouverture invalide (attendu: HH:MM)".to_string())
        })?;

    let fermeture =
        NaiveTime::parse_from_str(heures_fermeture.unwrap(), "%H:%M").map_err(|_| {
            AppError::BadRequest("Format heure de fermeture invalide (attendu: HH:MM)".to_string())
        })?;

    // Vérifier que ouverture < fermeture
    if ouverture >= fermeture {
        return Err(AppError::BadRequest(
            "L'heure d'ouverture doit être avant l'heure de fermeture".to_string(),
        ));
    }

    Ok(())
}

/// Valide les dates pour covoiturages
pub fn validate_covoiturage_dates(
    date_depart: &DateTime<Utc>,
    created_at: &DateTime<Utc>,
) -> Result<(), AppError> {
    if date_depart <= created_at {
        return Err(AppError::BadRequest(
            "La date de départ doit être dans le futur".to_string(),
        ));
    }

    Ok(())
}

/// Valide les places pour covoiturages
pub fn validate_covoiturage_places(
    nombre_places: i32,
    places_disponibles: i32,
) -> Result<(), AppError> {
    if nombre_places <= 0 {
        return Err(AppError::BadRequest(
            "Le nombre de places doit être strictement positif".to_string(),
        ));
    }

    if places_disponibles < 0 {
        return Err(AppError::BadRequest(
            "Les places disponibles ne peuvent pas être négatives".to_string(),
        ));
    }

    if places_disponibles > nombre_places {
        return Err(AppError::BadRequest(
            "Les places disponibles ne peuvent pas dépasser le nombre total de places".to_string(),
        ));
    }

    Ok(())
}

/// Valide le prix pour covoiturages
pub fn validate_covoiturage_price(prix_par_place: i32) -> Result<(), AppError> {
    if prix_par_place <= 0 {
        return Err(AppError::BadRequest(
            "Le prix par place doit être strictement positif".to_string(),
        ));
    }

    Ok(())
}

/// Valide départ et destination pour covoiturages
pub fn validate_depart_destination(depart: &str, destination: &str) -> Result<(), AppError> {
    if depart.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Le lieu de départ est requis".to_string(),
        ));
    }

    if destination.trim().is_empty() {
        return Err(AppError::BadRequest(
            "La destination est requise".to_string(),
        ));
    }

    if depart.trim().eq_ignore_ascii_case(destination.trim()) {
        return Err(AppError::BadRequest(
            "Le lieu de départ doit être différent de la destination".to_string(),
        ));
    }

    Ok(())
}

/// Valide les tarifs pour taxis
pub fn validate_taxi_tariffs(tarif_base: i32, tarif_par_km: i32) -> Result<(), AppError> {
    if tarif_base <= 0 {
        return Err(AppError::BadRequest(
            "Le tarif de base doit être strictement positif".to_string(),
        ));
    }

    if tarif_par_km <= 0 {
        return Err(AppError::BadRequest(
            "Le tarif par km doit être strictement positif".to_string(),
        ));
    }

    Ok(())
}

/// Valide le format téléphone (basique)
pub fn validate_phone_format(phone: &str) -> Result<(), AppError> {
    if phone.is_empty() {
        return Ok(()); // Vide est valide (optionnel)
    }

    // Format basique: commence par + ou 0, suivi de chiffres
    let phone_regex = Regex::new(r"^(\+?[0-9]{1,3}[-.\s]?)?[0-9]{8,15}$")
        .map_err(|_| AppError::Internal("Erreur regex téléphone".to_string()))?;

    if !phone_regex.is_match(phone) {
        return Err(AppError::BadRequest(
            "Format téléphone invalide".to_string(),
        ));
    }

    Ok(())
}

/// Valide le type d'établissement pour hôpitaux
pub fn validate_hospital_type(type_etablissement: &str) -> Result<(), AppError> {
    let valid_types = ["Hôpital", "Clinique", "Dispensaire", "Centre de santé"];

    if !valid_types
        .iter()
        .any(|&t| t.eq_ignore_ascii_case(type_etablissement))
    {
        return Err(AppError::BadRequest(format!(
            "Type d'établissement invalide. Types valides: {}",
            valid_types.join(", ")
        )));
    }

    Ok(())
}

/// Valide le type de laboratoire
pub fn validate_laboratory_type(type_laboratoire: &str) -> Result<(), AppError> {
    let valid_types = ["Laboratoire", "Centre d'imagerie", "Les deux"];

    if !valid_types
        .iter()
        .any(|&t| t.eq_ignore_ascii_case(type_laboratoire))
    {
        return Err(AppError::BadRequest(format!(
            "Type de laboratoire invalide. Types valides: {}",
            valid_types.join(", ")
        )));
    }

    Ok(())
}

/// Valide le statut pour covoiturages
pub fn validate_covoiturage_status(statut: &str) -> Result<(), AppError> {
    let valid_statuses = ["ouvert", "complet", "annule", "termine"];

    if !valid_statuses
        .iter()
        .any(|&s| s.eq_ignore_ascii_case(statut))
    {
        return Err(AppError::BadRequest(format!(
            "Statut invalide. Statuts valides: {}",
            valid_statuses.join(", ")
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_gps_format() {
        assert!(validate_gps_format("4.0511,9.7044").is_ok());
        assert!(validate_gps_format("").is_ok());
        assert!(validate_gps_format("invalid").is_err());
        assert!(validate_gps_format("91,0").is_err()); // Lat > 90
        assert!(validate_gps_format("0,181").is_err()); // Lng > 180
    }

    #[test]
    fn test_validate_email_format() {
        assert!(validate_email_format("test@example.com").is_ok());
        assert!(validate_email_format("").is_ok());
        assert!(validate_email_format("invalid").is_err());
        assert!(validate_email_format("@example.com").is_err());
    }

    #[test]
    fn test_validate_opening_hours() {
        assert!(validate_opening_hours(Some("08:00"), Some("20:00"), false).is_ok());
        assert!(validate_opening_hours(None, None, false).is_ok());
        assert!(validate_opening_hours(None, None, true).is_ok());
        assert!(validate_opening_hours(Some("08:00"), None, false).is_err());
        assert!(validate_opening_hours(Some("20:00"), Some("08:00"), false).is_err());
    }

    #[test]
    fn test_validate_covoiturage_places() {
        assert!(validate_covoiturage_places(4, 2).is_ok());
        assert!(validate_covoiturage_places(4, 0).is_ok());
        assert!(validate_covoiturage_places(4, 4).is_ok());
        assert!(validate_covoiturage_places(0, 0).is_err());
        assert!(validate_covoiturage_places(4, 5).is_err());
        assert!(validate_covoiturage_places(4, -1).is_err());
    }
}
