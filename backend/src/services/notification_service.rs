// Service Rust pour notifications avanc?es (alerte + email)
use sqlx::PgPool;

pub async fn send_email_notification(_pool: &PgPool, _user_id: i32, _subject: &str, _body: &str) {
    // TODO: Int?grer un vrai service SMTP ou API email (Mailgun, Sendgrid, etc.)
    // Pour l?instant, log seulement
    println!("[NOTIF] Email ? {}: {} - {}", _user_id, _subject, _body);
}

// Pour push notification, pr?voir une int?gration Firebase ou autre
