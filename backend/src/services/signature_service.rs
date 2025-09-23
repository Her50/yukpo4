use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize, Deserialize)]
pub struct SignedUrl {
    pub service_id: i32,
    pub expires_at: u64,
    pub signature: String,
}

pub struct SignatureService {
    secret_key: String,
}

impl SignatureService {
    pub fn new(secret_key: String) -> Self {
        Self { secret_key }
    }

    /// Génère un lien signé pour un service partagé
    pub fn generate_shared_link(&self, service_id: i32, expires_in_hours: u64) -> Result<String> {
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs() + (expires_in_hours * 3600);

        let data = format!("{}:{}", service_id, expires_at);
        let mut mac = HmacSha256::new_from_slice(self.secret_key.as_bytes())?;
        mac.update(data.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        Ok(format!(
            "/api/services/shared/{}?sig={}&exp={}",
            service_id, signature, expires_at
        ))
    }

    /// Vérifie la signature d'un lien partagé
    pub fn verify_signature(&self, service_id: i32, signature: &str, expires_at: u64) -> bool {
        // Vérifier l'expiration
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        if now > expires_at {
            return false;
        }

        // Vérifier la signature
        let data = format!("{}:{}", service_id, expires_at);
        let mut mac = HmacSha256::new_from_slice(self.secret_key.as_bytes())
            .unwrap_or_else(|_| panic!("Invalid key length"));
        mac.update(data.as_bytes());
        let expected_signature = hex::encode(mac.finalize().into_bytes());

        signature == expected_signature
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_generation_and_verification() {
        let service = SignatureService::new("test_secret_key".to_string());
        let service_id = 123;
        let expires_in_hours = 24;

        let signed_url = service.generate_shared_link(service_id, expires_in_hours).unwrap();
        assert!(signed_url.contains("sig="));
        assert!(signed_url.contains("exp="));

        // Extraire les paramètres pour la vérification
        let parts: Vec<&str> = signed_url.split('?').collect();
        let query_params: Vec<&str> = parts[1].split('&').collect();
        let sig = query_params[0].split('=').nth(1).unwrap();
        let exp = query_params[1].split('=').nth(1).unwrap().parse::<u64>().unwrap();

        assert!(service.verify_signature(service_id, sig, exp));
    }
}
