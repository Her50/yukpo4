// ✅ SERVICE MULTILINGUE - Traductions dynamiques pour YukPo
// Support de 62 langues avec détection automatique et fallback

use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{core::types::AppError, state::AppState};

// ========================================
// STRUCTURES SERVICE
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TraductionSysteme {
    pub id: Uuid,
    pub cle_traduction: String,
    pub langue: String,
    pub traduction: String,
    pub contexte: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct MessageTemplate {
    pub cle: String,
    pub variables: HashMap<String, String>,
    pub langue: String,
}

#[derive(Debug, Clone)]
pub struct MessageLocalise {
    pub langue: String,
    pub message: String,
    pub sujet: Option<String>,
}

pub struct MultilingueService {
    cache_traductions: Arc<RwLock<HashMap<(String, String), String>>>, // (langue, cle) -> traduction
    cache_messages: Arc<RwLock<HashMap<String, MessageLocalise>>>,     // template_hash -> message
    langues_supportees: Vec<String>,
    langue_defaut: String,
}

impl MultilingueService {
    pub fn new() -> Self {
        Self {
            cache_traductions: Arc::new(RwLock::new(HashMap::new())),
            cache_messages: Arc::new(RwLock::new(HashMap::new())),
            langues_supportees: vec![
                "af".to_string(),
                "am".to_string(),
                "ar".to_string(),
                "bas".to_string(),
                "bbj".to_string(),
                "bci".to_string(),
                "bet".to_string(),
                "bm".to_string(),
                "bn".to_string(),
                "bum".to_string(),
                "de".to_string(),
                "dje".to_string(),
                "dua".to_string(),
                "dyu".to_string(),
                "ee".to_string(),
                "en".to_string(),
                "es".to_string(),
                "ewo".to_string(),
                "fan".to_string(),
                "ff".to_string(),
                "fr".to_string(),
                "ha".to_string(),
                "hi".to_string(),
                "ht".to_string(),
                "id".to_string(),
                "ig".to_string(),
                "it".to_string(),
                "ja".to_string(),
                "kbp".to_string(),
                "kg".to_string(),
                "ko".to_string(),
                "ln".to_string(),
                "lua".to_string(),
                "mg".to_string(),
                "mos".to_string(),
                "ms".to_string(),
                "nl".to_string(),
                "pap".to_string(),
                "pcm".to_string(),
                "pl".to_string(),
                "pt".to_string(),
                "rn".to_string(),
                "ru".to_string(),
                "rw".to_string(),
                "sar".to_string(),
                "sg".to_string(),
                "sn".to_string(),
                "so".to_string(),
                "srr".to_string(),
                "st".to_string(),
                "sw".to_string(),
                "th".to_string(),
                "ti".to_string(),
                "tl".to_string(),
                "tr".to_string(),
                "uk".to_string(),
                "vi".to_string(),
                "wo".to_string(),
                "xh".to_string(),
                "yo".to_string(),
                "zh".to_string(),
                "zu".to_string(),
            ],
            langue_defaut: "fr".to_string(),
        }
    }

    /// Détecter la langue préférée de l'utilisateur
    pub async fn detecter_langue_utilisateur(
        &self,
        user_id: Uuid,
        pg: &sqlx::PgPool,
    ) -> Result<String, AppError> {
        // Priorité: langue profil > langue appareil > langue_defaut
        if let Ok(langue_opt) = sqlx::query_scalar::<_, Option<String>>(
            "SELECT langue_preferee FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_one(pg)
        .await
        {
            if let Some(langue) = langue_opt {
                if self.langues_supportees.contains(&langue) {
                    return Ok(langue);
                }
            }
        }

        // TODO: Détecter langue depuis headers HTTP Accept-Language
        Ok(self.langue_defaut.clone())
    }

    /// Traduire une clé avec variables
    pub async fn traduire(
        &self,
        cle: &str,
        langue: &str,
        variables: Option<&HashMap<String, String>>,
        pg: &sqlx::PgPool,
    ) -> Result<String, AppError> {
        let traduction = self.get_traduction(cle, langue, pg).await?;

        // Remplacer les variables {{variable}}
        let mut resultat = traduction;
        if let Some(vars) = variables {
            for (key, value) in vars {
                resultat = resultat.replace(&format!("{{{{{}}}}}", key), value);
            }
        }

        Ok(resultat)
    }

    /// Obtenir une traduction (avec cache)
    fn get_traduction<'a>(
        &'a self,
        cle: &'a str,
        langue: &'a str,
        pg: &'a sqlx::PgPool,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, AppError>> + Send + 'a>>
    {
        Box::pin(async move {
            let cache_key = (langue.to_string(), cle.to_string());

            // Vérifier le cache
            {
                let cache = self.cache_traductions.read().await;
                if let Some(traduction) = cache.get(&cache_key) {
                    return Ok(traduction.clone());
                }
            }

            // Rechercher en base
            let traduction: Option<String> = sqlx::query_scalar(
            "SELECT traduction FROM traductions_systeme WHERE cle_traduction = $1 AND langue = $2",
        )
        .bind(cle)
        .bind(langue)
        .fetch_optional(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur traduction: {}", e)))?;

            let traduction = match traduction {
                Some(t) => t,
                None => {
                    // Fallback vers langue par défaut
                    if langue != self.langue_defaut {
                        return self.get_traduction(cle, &self.langue_defaut, pg).await;
                    } else {
                        // Dernier fallback: retourner la clé
                        cle.to_string()
                    }
                }
            };

            // Mettre en cache
            {
                let mut cache = self.cache_traductions.write().await;
                cache.insert(cache_key, traduction.clone());
            }

            Ok(traduction)
        })
    }

    /// Générer un message localisé complet
    pub async fn generer_message(
        &self,
        template: &MessageTemplate,
        pg: &sqlx::PgPool,
    ) -> Result<MessageLocalise, AppError> {
        let cache_key = format!("{}:{}", template.cle, template.langue);

        // Vérifier cache messages
        {
            let cache = self.cache_messages.read().await;
            if let Some(message) = cache.get(&cache_key) {
                return Ok(message.clone());
            }
        }

        let message = self
            .traduire(
                &template.cle,
                &template.langue,
                Some(&template.variables),
                pg,
            )
            .await?;

        let sujet: Option<String> = if let Ok(Some(sujet)) = sqlx::query_scalar::<_, String>(
            "SELECT traduction FROM traductions_systeme WHERE cle_traduction = $1 AND langue = $2",
        )
        .bind(format!("{}.sujet", template.cle))
        .bind(&template.langue)
        .fetch_optional(pg)
        .await
        {
            Some(sujet)
        } else {
            None
        };

        let message_localise = MessageLocalise {
            langue: template.langue.clone(),
            message,
            sujet,
        };

        // Mettre en cache
        {
            let mut cache = self.cache_messages.write().await;
            cache.insert(cache_key, message_localise.clone());
        }

        Ok(message_localise)
    }

    /// Envoyer une notification (stub - utilise le système de traduction)
    pub async fn send_notification(
        &self,
        cle: &str,
        variables: std::collections::HashMap<String, String>,
        _user_id: Option<i32>,
    ) -> Result<(), AppError> {
        log::info!("[send_notification] cle={}, variables={:?}", cle, variables);
        Ok(())
    }

    /// Traduire du texte libre d'une langue source vers une langue cible.
    /// Cherche d'abord dans le cache mémoire, puis en base (traductions_systeme),
    /// puis retourne un fallback préfixé `[target_lang]texte` pour signaler au frontend
    /// que la traduction n'existe pas encore.
    pub async fn translate_text(
        &self,
        text: &str,
        source_lang: &str,
        target_lang: &str,
        pg: &sqlx::PgPool,
    ) -> Result<String, AppError> {
        if source_lang == target_lang || text.is_empty() {
            return Ok(text.to_string());
        }

        let cache_key = (target_lang.to_string(), text.to_string());

        // 1. Check in-memory cache
        {
            let cache = self.cache_traductions.read().await;
            if let Some(cached) = cache.get(&cache_key) {
                return Ok(cached.clone());
            }
        }

        // 2. Look up in database (traductions_systeme stores key-based translations,
        //    but we also store free-text translations with a generated key)
        let db_key = format!("freetext.{}", text.replace(' ', "_").to_lowercase());
        let db_result: Option<String> = sqlx::query_scalar(
            "SELECT traduction FROM traductions_systeme WHERE cle_traduction = $1 AND langue = $2",
        )
        .bind(&db_key)
        .bind(target_lang)
        .fetch_optional(pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur translate_text DB: {}", e)))?;

        let translated = match db_result {
            Some(t) => t,
            None => {
                // 3. Fallback: prefix with language code so frontend knows it's untranslated
                format!("[{}]{}", target_lang, text)
            }
        };

        // Store in cache
        {
            let mut cache = self.cache_traductions.write().await;
            cache.insert(cache_key, translated.clone());
        }

        Ok(translated)
    }

    /// Initialiser les traductions par défaut
    pub async fn initialiser_traductions_defaut(&self, pg: &sqlx::PgPool) -> Result<(), AppError> {
        let traductions_defaut = self.get_traductions_defaut();

        for (langue, traductions) in traductions_defaut {
            for (cle, traduction) in traductions {
                sqlx::query(
                    r#"
                    INSERT INTO traductions_systeme (cle_traduction, langue, traduction, contexte)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (cle_traduction, langue) DO UPDATE SET
                        traduction = EXCLUDED.traduction,
                        updated_at = NOW()
                    "#,
                )
                .bind(&cle)
                .bind(&langue)
                .bind(&traduction.texte)
                .bind(&traduction.contexte)
                .execute(pg)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur insertion traduction: {}", e)))?;
            }
        }

        info!("[MultilingueService] Traductions par défaut initialisées");
        Ok(())
    }

    /// Obtenir les traductions par défaut pour toutes les langues
    fn get_traductions_defaut(&self) -> HashMap<String, HashMap<String, TraductionDefaut>> {
        let mut toutes_traductions = HashMap::new();

        // Traductions par langue
        toutes_traductions.insert("fr".to_string(), self.get_traductions_francais());
        toutes_traductions.insert("en".to_string(), self.get_traductions_anglais());
        toutes_traductions.insert("es".to_string(), self.get_traductions_espagnol());
        toutes_traductions.insert("de".to_string(), self.get_traductions_allemand());
        toutes_traductions.insert("pt".to_string(), self.get_traductions_portugais());
        toutes_traductions.insert("it".to_string(), self.get_traductions_italien());
        toutes_traductions.insert("ar".to_string(), self.get_traductions_arabe());
        toutes_traductions.insert("zh".to_string(), self.get_traductions_chinois());
        toutes_traductions.insert("ja".to_string(), self.get_traductions_japonais());
        toutes_traductions.insert("ko".to_string(), self.get_traductions_coreen());
        toutes_traductions.insert("ru".to_string(), self.get_traductions_russe());
        toutes_traductions.insert("hi".to_string(), self.get_traductions_hindi());

        // Pour les autres langues, utiliser le français comme fallback
        let traductions_fr = self.get_traductions_francais();
        for langue in &self.langues_supportees {
            if !toutes_traductions.contains_key(langue) && langue != "fr" {
                toutes_traductions.insert(langue.clone(), traductions_fr.clone());
            }
        }

        toutes_traductions
    }

    // ========================================
    // TRADUCTIONS PAR LANGUE
    // ========================================

    fn get_traductions_francais(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        // Notifications librairies
        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Nouvelle commande {{reference_commande}} à valider ({{nb_livres_neufs}} livres neufs, {{nb_livres_occasion}} livres occasion)".to_string(),
            contexte: Some("Notification envoyée aux librairies".to_string()),
        });

        traductions.insert(
            "notification.validation_requise".to_string(),
            TraductionDefaut {
                texte: "Validation requise pour commande {{reference_commande}}".to_string(),
                contexte: Some("Rappel validation".to_string()),
            },
        );

        traductions.insert(
            "notification.commande_annulee".to_string(),
            TraductionDefaut {
                texte: "Commande {{reference_commande}} annulée".to_string(),
                contexte: Some("Annulation commande".to_string()),
            },
        );

        // Messages commande
        traductions.insert("commande.en_preparation".to_string(), TraductionDefaut {
            texte: "Votre commande {{reference_commande}} est en préparation chez nos librairies partenaires".to_string(),
            contexte: Some("Statut commande".to_string()),
        });

        traductions.insert(
            "commande.en_livraison".to_string(),
            TraductionDefaut {
                texte: "Votre commande {{reference_commande}} est en cours de livraison"
                    .to_string(),
                contexte: Some("Statut commande".to_string()),
            },
        );

        traductions.insert(
            "commande.livree".to_string(),
            TraductionDefaut {
                texte: "Votre commande {{reference_commande}} a été livrée avec succès".to_string(),
                contexte: Some("Statut commande".to_string()),
            },
        );

        // QR Codes
        traductions.insert(
            "qr_code.genere".to_string(),
            TraductionDefaut {
                texte: "QR code généré pour le paquet {{reference_paquet}}".to_string(),
                contexte: Some("Génération QR code".to_string()),
            },
        );

        traductions.insert(
            "qr_code.scanne".to_string(),
            TraductionDefaut {
                texte: "QR code scanné par le coursier".to_string(),
                contexte: Some("Scan QR code".to_string()),
            },
        );

        traductions.insert(
            "qr_code.valide".to_string(),
            TraductionDefaut {
                texte: "QR code validé avec succès".to_string(),
                contexte: Some("Validation QR code".to_string()),
            },
        );

        // Paiements
        traductions.insert("paiement.succes".to_string(), TraductionDefaut {
            texte: "Paiement de {{montant}} {{devise}} effectué avec succès pour votre commande {{reference_commande}}".to_string(),
            contexte: Some("Confirmation paiement".to_string()),
        });

        traductions.insert(
            "paiement.echec".to_string(),
            TraductionDefaut {
                texte: "Échec du paiement pour votre commande {{reference_commande}}".to_string(),
                contexte: Some("Échec paiement".to_string()),
            },
        );

        // Validation librairie
        traductions.insert(
            "validation.debut".to_string(),
            TraductionDefaut {
                texte: "Validation de la commande {{reference_commande}} commencée".to_string(),
                contexte: Some("Début validation".to_string()),
            },
        );

        traductions.insert(
            "validation.complete".to_string(),
            TraductionDefaut {
                texte: "Validation complète terminée pour commande {{reference_commande}}"
                    .to_string(),
                contexte: Some("Validation complète".to_string()),
            },
        );

        traductions.insert(
            "validation.partielle".to_string(),
            TraductionDefaut {
                texte:
                    "Validation partielle: {{nb_livres_valides}}/{{nb_livres_total}} livres validés"
                        .to_string(),
                contexte: Some("Validation partielle".to_string()),
            },
        );

        // Livraison
        traductions.insert(
            "livraison.en_cours".to_string(),
            TraductionDefaut {
                texte: "Livraison en cours pour votre commande {{reference_commande}}".to_string(),
                contexte: Some("Livraison".to_string()),
            },
        );

        traductions.insert(
            "livraison.coursier_en_route".to_string(),
            TraductionDefaut {
                texte: "Le coursier est en route avec vos livres".to_string(),
                contexte: Some("Statut coursier".to_string()),
            },
        );

        // Erreurs
        traductions.insert("erreur.budget_insuffisant".to_string(), TraductionDefaut {
            texte: "Budget insuffisant. Total: {{total_commande}} {{devise}}, Budget: {{budget}} {{devise}}".to_string(),
            contexte: Some("Erreur budget".to_string()),
        });

        traductions.insert(
            "erreur.livres_indisponibles".to_string(),
            TraductionDefaut {
                texte: "Certains livres ne sont plus disponibles".to_string(),
                contexte: Some("Erreur disponibilité".to_string()),
            },
        );

        traductions.insert(
            "erreur.qr_expire".to_string(),
            TraductionDefaut {
                texte: "QR code expiré. Veuillez en générer un nouveau".to_string(),
                contexte: Some("Erreur QR code".to_string()),
            },
        );

        traductions
    }

    fn get_traductions_anglais(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "New order {{reference_commande}} to validate ({{nb_livres_neufs}} new books, {{nb_livres_occasion}} used books)".to_string(),
            contexte: Some("Notification sent to bookstores".to_string()),
        });

        traductions.insert(
            "commande.en_preparation".to_string(),
            TraductionDefaut {
                texte:
                    "Your order {{reference_commande}} is being prepared by our partner bookstores"
                        .to_string(),
                contexte: Some("Order status".to_string()),
            },
        );

        traductions.insert("paiement.succes".to_string(), TraductionDefaut {
            texte: "Payment of {{montant}} {{devise}} successful for your order {{reference_commande}}".to_string(),
            contexte: Some("Payment confirmation".to_string()),
        });

        // Ajouter autres traductions anglaises...
        traductions
    }

    fn get_traductions_espagnol(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Nuevo pedido {{reference_commande}} para validar ({{nb_livres_neufs}} libros nuevos, {{nb_livres_occasion}} libros usados)".to_string(),
            contexte: Some("Notificación enviada a librerías".to_string()),
        });

        // Ajouter autres traductions espagnoles...
        traductions
    }

    fn get_traductions_allemand(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Neue Bestellung {{reference_commande}} zur Validierung ({{nb_livres_neufs}} neue Bücher, {{nb_livres_occasion}} gebrauchte Bücher)".to_string(),
            contexte: Some("Benachrichtigung an Buchhandlungen".to_string()),
        });

        // Ajouter autres traductions allemandes...
        traductions
    }

    fn get_traductions_portugais(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Novo pedido {{reference_commande}} para validar ({{nb_livres_neufs}} livros novos, {{nb_livres_occasion}} livros usados)".to_string(),
            contexte: Some("Notificação enviada às livrarias".to_string()),
        });

        // Ajouter autres traductions portugaises...
        traductions
    }

    fn get_traductions_italien(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Nuovo ordine {{reference_commande}} da validare ({{nb_livres_neufs}} libri nuovi, {{nb_livres_occasion}} libri usati)".to_string(),
            contexte: Some("Notifica inviata alle librerie".to_string()),
        });

        // Ajouter autres traductions italiennes...
        traductions
    }

    fn get_traductions_arabe(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "طلب جديد {{reference_commande}} للتحقق ({{nb_livres_neufs}} كتب جديدة، {{nb_livres_occasion}} كتب مستعملة)".to_string(),
            contexte: Some("إشعار مرسل للمكتبات".to_string()),
        });

        // Ajouter autres traductions arabes...
        traductions
    }

    fn get_traductions_chinois(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "新订单 {{reference_commande}} 需要验证 ({{nb_livres_neufs}} 本新书，{{nb_livres_occasion}} 本二手书)".to_string(),
            contexte: Some("发送给书店的通知".to_string()),
        });

        // Ajouter autres traductions chinoises...
        traductions
    }

    fn get_traductions_japonais(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "新しい注文 {{reference_commande}} の検証 ({{nb_livres_neufs}} 冊の新書、{{nb_livres_occasion}} 冊の中古書)".to_string(),
            contexte: Some("書店への通知".to_string()),
        });

        // Ajouter autres traductions japonaises...
        traductions
    }

    fn get_traductions_coreen(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "검증 필요 새 주문 {{reference_commande}} ({{nb_livres_neufs}} 권의 새 책, {{nb_livres_occasion}} 권의 중고 책)".to_string(),
            contexte: Some("서점에 보내는 알림".to_string()),
        });

        // Ajouter autres traductions coréennes...
        traductions
    }

    fn get_traductions_russe(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "Новый заказ {{reference_commande}} для проверки ({{nb_livres_neufs}} новых книг, {{nb_livres_occasion}} подержанных книг)".to_string(),
            contexte: Some("Уведомление книжным магазинам".to_string()),
        });

        // Ajouter autres traductions russes...
        traductions
    }

    fn get_traductions_hindi(&self) -> HashMap<String, TraductionDefaut> {
        let mut traductions = HashMap::new();

        traductions.insert("notification.nouvelle_commande".to_string(), TraductionDefaut {
            texte: "नया ऑर्डर {{reference_commande}} जांच के लिए ({{nb_livres_neufs}} नई किताबें, {{nb_livres_occasion}} पुरानी किताबें)".to_string(),
            contexte: Some("किताब दुकानों को भेजा गया नोटिफिकेशन".to_string()),
        });

        // Ajouter autres traductions hindi...
        traductions
    }
}

// ========================================
// STRUCTURES SUPPORT
// ========================================

#[derive(Debug, Clone)]
pub struct TraductionDefaut {
    pub texte: String,
    pub contexte: Option<String>,
}

// ========================================
// UTILITAIRES
// ========================================

pub async fn envoyer_notification_multilingue(
    state: &AppState,
    user_id: Uuid,
    cle_template: &str,
    variables: HashMap<String, String>,
    donnees_supplementaires: Option<serde_json::Value>,
) -> Result<(), AppError> {
    // Détecter langue utilisateur
    let langue = state
        .multilingue_service
        .detecter_langue_utilisateur(user_id, &state.pg)
        .await?;

    // Créer template
    let template = MessageTemplate {
        cle: cle_template.to_string(),
        variables,
        langue: langue.clone(),
    };

    // Générer message localisé
    let message_localise = state.multilingue_service.generer_message(&template, &state.pg).await?;

    // Envoyer notification push via le service de push
    let titre = message_localise.sujet.unwrap_or_else(|| "YukPo".to_string());
    if let Err(e) = crate::utils::send_notification(
        &Arc::new(state.clone()),
        0, // placeholder — le service push résout le device token via user_id en interne
        &titre,
        &message_localise.message,
        donnees_supplementaires,
    )
    .await
    {
        log::warn!("[envoyer_notification_multilingue] Erreur push: {}", e);
    }

    info!(
        "[envoyer_notification_multilingue] Notification {} envoyée à {} en {}",
        cle_template, user_id, langue
    );

    Ok(())
}

// ========================================
// MIDDLEWARE DÉTECTION LANGUE
// ========================================

pub async fn middleware_detection_langue(headers: &axum::http::HeaderMap) -> String {
    // Extraire depuis Accept-Language header
    if let Some(accept_lang) = headers.get("accept-language") {
        if let Ok(lang_str) = accept_lang.to_str() {
            // Parser "fr-FR,fr;q=0.9,en;q=0.8"
            let langues: Vec<&str> = lang_str.split(',').collect();
            for langue in langues {
                let code = langue.split(';').next().unwrap_or("").trim();
                let code_principal = code.split('-').next().unwrap_or(code);

                // Vérifier si la langue est supportée
                if [
                    "fr", "en", "de", "es", "pt", "zh", "ja", "hi", "ar", "ru", "ko", "tr", "id",
                    "vi", "th", "bn", "tl", "ms", "uk", "pl", "it", "nl", "sw", "ha", "yo", "am",
                    "wo", "zu", "ig", "ln", "ff", "rw", "sn", "so", "ti", "mg", "ewo", "dua",
                    "bbj", "bas", "bum", "bci", "dyu", "bet", "pcm", "mos", "bm", "dje", "ee",
                    "kbp", "sar", "sg", "kg", "lua", "fan", "xh", "af", "st", "rn", "srr", "ht",
                    "pap",
                ]
                .contains(&code_principal)
                {
                    return code_principal.to_string();
                }
            }
        }
    }

    "fr".to_string() // Langue par défaut
}
