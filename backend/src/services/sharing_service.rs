// Service m?tier pour le partage externe (WhatsApp, Facebook, site pro, etc.)
// ? compl?ter avec la logique de g?n?ration de liens, redirection, etc.

// G?n?re un lien de partage pour WhatsApp, Facebook, site pro, etc.
pub fn generate_share_link(service_id: i32, platform: &str, base_url: &str) -> String {
    let url = format!("{}/service/{}", base_url, service_id);
    match platform {
        "whatsapp" => format!("https://wa.me/?text={}", url),
        "facebook" => format!("https://www.facebook.com/sharer/sharer.php?u={}", url),
        "sitepro" => url,
        _ => url,
    }
}
