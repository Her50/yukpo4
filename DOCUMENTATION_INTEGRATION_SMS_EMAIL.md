# 📧📱 Documentation : Intégration SMS/Email (Twilio, SendGrid, AWS SES)

## 📋 Vue d'ensemble

Ce document décrit comment intégrer les services SMS (Twilio, Orange) et Email (SendGrid, AWS SES) dans le système de notifications pour les livraisons. Le code est déjà préparé avec des fonctions stub, il suffit de les implémenter.

---

## 🔧 Configuration

### **Variables d'environnement**

Ajoutez ces variables dans votre fichier `.env` du backend :

```bash
# Activation des notifications
SMS_ENABLED=true
EMAIL_ENABLED=true

# Provider SMS
SMS_PROVIDER=twilio  # ou "orange"

# Twilio (si SMS_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Provider Email
EMAIL_PROVIDER=sendgrid  # ou "ses"

# SendGrid (si EMAIL_PROVIDER=sendgrid)
SENDGRID_API_KEY=your_sendgrid_api_key

# AWS SES (si EMAIL_PROVIDER=ses)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your_access_key
AWS_SES_SECRET_ACCESS_KEY=your_secret_key
```

---

## 📱 Implémentation SMS (Twilio)

### **Fichier : `backend/src/services/delivery_notification_service.rs`**

#### **1. Ajouter dépendance Twilio**

Dans `backend/Cargo.toml` :

```toml
[dependencies]
# ... dépendances existantes ...
reqwest = { version = "0.11", features = ["json"] }
```

#### **2. Fonction `send_sms_notification()` avec Twilio**

Remplacez le bloc `"twilio"` dans `send_sms_notification()` :

```rust
"twilio" => {
    let account_sid = std::env::var("TWILIO_ACCOUNT_SID")
        .map_err(|_| AppError::Internal("TWILIO_ACCOUNT_SID non configurée".into()))?;
    
    let auth_token = std::env::var("TWILIO_AUTH_TOKEN")
        .map_err(|_| AppError::Internal("TWILIO_AUTH_TOKEN non configurée".into()))?;
    
    let from_number = std::env::var("TWILIO_PHONE_NUMBER")
        .map_err(|_| AppError::Internal("TWILIO_PHONE_NUMBER non configurée".into()))?;
    
    let client = reqwest::Client::new();
    let url = format!("https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json", account_sid);
    
    let mut params = std::collections::HashMap::new();
    params.insert("From", from_number.as_str());
    params.insert("To", phone_number);
    params.insert("Body", message);
    
    let response = client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur appel Twilio API: {}", e)))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        log::error!("Erreur Twilio API: {}", error_text);
        return Err(AppError::Internal(format!("Twilio API error: {}", error_text)));
    }
    
    let result: serde_json::Value = response.json().await
        .map_err(|e| AppError::Internal(format!("Erreur parsing réponse Twilio: {}", e)))?;
    
    let message_sid = result.get("sid")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Twilio: sid manquant".into()))?;
    
    log::info!("✅ SMS Twilio envoyé: message_sid={}, to={}, delivery={:?}", 
        message_sid, phone_number, delivery_id);
    
    Ok(())
}
```

---

## 🟠 Implémentation SMS (Orange)

### **Fonction `send_sms_notification()` avec Orange**

Remplacez le bloc `"orange"` :

```rust
"orange" => {
    // TODO: Implémenter selon documentation Orange SMS API
    // Exemple de structure:
    /*
    let api_key = std::env::var("ORANGE_SMS_API_KEY")?;
    let api_secret = std::env::var("ORANGE_SMS_API_SECRET")?;
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.orange.com/smsmessaging/v1/outbound/...")
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&json!({
            "outboundSMSMessageRequest": {
                "address": format!("tel:{}", phone_number),
                "senderAddress": "tel:+237699123456",
                "outboundSMSTextMessage": {
                    "message": message
                }
            }
        }))
        .send()
        .await?;
    */
    
    log::warn!("Orange SMS API non encore implémentée");
    Ok(())
}
```

---

## 📧 Implémentation Email (SendGrid)

### **1. Ajouter dépendance SendGrid**

Dans `backend/Cargo.toml` :

```toml
[dependencies]
# ... dépendances existantes ...
reqwest = { version = "0.11", features = ["json"] }
```

### **2. Fonction `send_email_notification()` avec SendGrid**

Remplacez le bloc `"sendgrid"` :

```rust
"sendgrid" => {
    let api_key = std::env::var("SENDGRID_API_KEY")
        .map_err(|_| AppError::Internal("SENDGRID_API_KEY non configurée".into()))?;
    
    let client = reqwest::Client::new();
    
    let payload = json!({
        "personalizations": [{
            "to": [{
                "email": email
            }]
        }],
        "from": {
            "email": "noreply@yukpo.com",
            "name": "Yukpo"
        },
        "subject": subject,
        "content": [{
            "type": "text/plain",
            "value": body
        }]
    });
    
    let response = client
        .post("https://api.sendgrid.com/v3/mail/send")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur appel SendGrid API: {}", e)))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        log::error!("Erreur SendGrid API: {}", error_text);
        return Err(AppError::Internal(format!("SendGrid API error: {}", error_text)));
    }
    
    log::info!("✅ Email SendGrid envoyé: to={}, subject={}, delivery={:?}", 
        email, subject, delivery_id);
    
    Ok(())
}
```

---

## ☁️ Implémentation Email (AWS SES)

### **1. Ajouter dépendance AWS SDK**

Dans `backend/Cargo.toml` :

```toml
[dependencies]
# ... dépendances existantes ...
aws-sdk-ses = "1.0"
aws-config = "1.0"
```

### **2. Fonction `send_email_notification()` avec AWS SES**

Remplacez le bloc `"ses" | "aws_ses"` :

```rust
"ses" | "aws_ses" => {
    use aws_sdk_ses::Client as SesClient;
    use aws_config::Region;
    
    let region = std::env::var("AWS_SES_REGION")
        .unwrap_or_else(|_| "us-east-1".to_string());
    
    let config = aws_config::from_env()
        .region(Region::new(region))
        .load()
        .await;
    
    let client = SesClient::new(&config);
    
    let result = client
        .send_email()
        .source("noreply@yukpo.com")
        .destination()
        .to_addresses(email)
        .set_destination(None)
        .message()
        .subject()
        .data(subject)
        .set_subject(None)
        .body()
        .text()
        .data(body)
        .set_text(None)
        .set_body(None)
        .set_message(None)
        .send()
        .await;
    
    match result {
        Ok(output) => {
            let message_id = output.message_id().unwrap_or("unknown");
            log::info!("✅ Email AWS SES envoyé: message_id={}, to={}, delivery={:?}", 
                message_id, email, delivery_id);
            Ok(())
        }
        Err(e) => {
            log::error!("Erreur AWS SES: {:?}", e);
            Err(AppError::Internal(format!("AWS SES error: {:?}", e)))
        }
    }
}
```

---

## 🧪 Tests

### **1. Test SMS**

```bash
# Activer SMS
export SMS_ENABLED=true
export SMS_PROVIDER=twilio
export TWILIO_ACCOUNT_SID=your_sid
export TWILIO_AUTH_TOKEN=your_token
export TWILIO_PHONE_NUMBER=+1234567890

# Tester depuis le code
```

### **2. Test Email**

```bash
# Activer Email
export EMAIL_ENABLED=true
export EMAIL_PROVIDER=sendgrid
export SENDGRID_API_KEY=your_key

# Tester depuis le code
```

---

## 📊 Monitoring

### **Métriques à suivre**

1. **Taux de succès** :
   - `sms_sent_total`
   - `sms_failed_total`
   - `email_sent_total`
   - `email_failed_total`

2. **Coûts** :
   - Suivre le nombre de SMS/Email envoyés
   - Estimer les coûts selon les tarifs des providers

---

## 🚨 Gestion d'erreurs

### **Stratégie de retry**

```rust
async fn send_sms_with_retry(
    phone: &str,
    message: &str,
    max_retries: u32,
) -> AppResult<()> {
    for attempt in 0..max_retries {
        match send_sms_notification(pool, phone, message, None).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                if attempt < max_retries - 1 {
                    let delay = Duration::from_secs(2_u64.pow(attempt));
                    tokio::time::sleep(delay).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(AppError::Internal("Max retries atteint".into()))
}
```

---

## 📝 Checklist d'intégration

- [ ] Variables d'environnement configurées
- [ ] Dépendances ajoutées (reqwest, aws-sdk-ses si nécessaire)
- [ ] Fonction `send_sms_notification()` implémentée (Twilio/Orange)
- [ ] Fonction `send_email_notification()` implémentée (SendGrid/SES)
- [ ] Tests unitaires
- [ ] Tests d'intégration (sandbox)
- [ ] Monitoring configuré
- [ ] Gestion d'erreurs et retry
- [ ] Documentation API mise à jour

---

## 🔗 Ressources

- **Twilio SMS API** : https://www.twilio.com/docs/sms
- **Orange SMS API** : https://developer.orange.com/
- **SendGrid API** : https://docs.sendgrid.com/
- **AWS SES** : https://docs.aws.amazon.com/ses/

---

## 💰 Coûts estimés

### **Twilio**
- ~0.01-0.05$ par SMS selon le pays

### **SendGrid**
- Gratuit jusqu'à 100 emails/jour
- ~0.0001$ par email au-delà

### **AWS SES**
- ~0.0001$ par email
- Gratuit jusqu'à 62 000 emails/mois (si sur EC2)

---

## 📞 Support

En cas de problème :
1. Vérifier les logs backend
2. Tester avec l'environnement sandbox
3. Consulter la documentation officielle des APIs
4. Vérifier les quotas et limites des providers

