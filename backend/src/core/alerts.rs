// ?? core/alerts.rs

use std::error::Error;

/// ?? Simule l'envoi d'un email d'alerte
pub fn send_email(to: &str, subject: &str, body: &str) -> Result<(), Box<dyn Error>> {
    println!("?? Email envoy? ? {to}: {subject} ? {body}");
    Ok(())
}

/// ?? Simule l'envoi d'un message WhatsApp d'alerte
pub fn send_whatsapp(to: &str, message: &str) -> Result<(), Box<dyn Error>> {
    println!("?? WhatsApp envoy? ? {to}: {message}");
    Ok(())
}





