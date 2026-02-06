// Service métier pour le partage externe (WhatsApp, Facebook, site pro, etc.)
// Gestion des liens intelligents avec détection mobile/web

/// Génère un lien de partage pour WhatsApp, Facebook, site pro, etc.
pub fn generate_share_link(service_id: i32, platform: &str, base_url: &str) -> String {
    let url = format!("{}/service/{}", base_url, service_id);
    match platform {
        "whatsapp" => format!("https://wa.me/?text={}", url),
        "facebook" => format!("https://www.facebook.com/sharer/sharer.php?u={}", url),
        "sitepro" => url,
        _ => url,
    }
}

/// Génère un lien intelligent de partage pour un produit
/// Format: /product/:productId?serviceId=:serviceId
pub fn generate_product_share_link(product_id: &str, service_id: i32, base_url: &str) -> String {
    format!(
        "{}/product/{}?serviceId={}",
        base_url, product_id, service_id
    )
}

/// Détecte si le User-Agent correspond à un appareil mobile
pub fn is_mobile_user_agent(user_agent: &str) -> bool {
    let mobile_patterns = [
        "Mobile",
        "Android",
        "iPhone",
        "iPad",
        "iPod",
        "BlackBerry",
        "Windows Phone",
        "Opera Mini",
        "IEMobile",
        "webOS",
    ];

    let user_agent_lower = user_agent.to_lowercase();
    mobile_patterns
        .iter()
        .any(|pattern| user_agent_lower.contains(&pattern.to_lowercase()))
}

/// Génère un deep link pour l'application mobile
pub fn generate_deep_link(product_id: &str, service_id: i32) -> String {
    format!(
        "yukpomnang://product/{}?serviceId={}",
        product_id, service_id
    )
}
