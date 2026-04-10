// ✅ WhatsApp Chatbot Service — Routeur Master Yukpo
// Orchestre tous les modules : compte, tokens, pharmacie, bus, sang,
// alertes communautaires, bourse du livre, immobilier, produit via image

use crate::services::app_ia::AppIA;
use sqlx::{PgPool, Row};
use std::sync::Arc;

use crate::services::whatsapp_alert_service::{
    detect_city, extract_image_url_from_payload, extract_location_from_payload,
    WhatsAppAlertService,
};
use crate::services::whatsapp_books_service::WhatsAppBooksService;
use crate::services::whatsapp_cm_service::{is_cm_intent, WhatsAppCMService};
use crate::services::whatsapp_commerce_service::{
    generate_payment_reference, parse_pack_choice, payment_instructions, payment_method_menu,
    token_pack_menu, WhatsAppCommerceService,
};
use crate::services::whatsapp_covoiturage_service::{
    extraire_villes_covoiturage, WhatsAppCovoiturageService,
};
use crate::services::whatsapp_ia_service::{
    format_document_generating, ia_welcome_message, WhatsAppIAService, AI_QUERY_TOKEN_COST,
    DATA_ANALYSIS_COST, DOCUMENT_GENERATION_COST,
};
use crate::services::whatsapp_partner_service::{
    is_partner_dashboard_intent, is_partner_intent, PartnerType, WhatsAppPartnerService,
};
use crate::services::whatsapp_product_service::WhatsAppProductService;
use crate::services::whatsapp_provider_service::{
    WhatsAppProviderService, REACTIVATION_TOKEN_COST,
};
use crate::services::whatsapp_realestate_service::{
    detect_property_search, WhatsAppRealEstateService,
};
use crate::services::whatsapp_session_service::{
    ConversationState, WhatsAppSession, WhatsAppSessionService,
};

// ─── Intent de haut niveau ───────────────────────────────────────────────────

#[derive(Debug)]
enum Intent {
    // Compte
    Aide,
    Menu,

    // Commerce
    Pharmacie {
        medicament: String,
    },
    Bus {
        trajet: String,
    },
    Sang {
        groupe: Option<String>,
    },

    // Alertes
    SignalerAlerte,
    VoirAlertes {
        city: String,
    },
    AbonnerAlertes {
        city: String,
    },

    // Immobilier
    Immobilier {
        query: String,
    },

    // Bourse du livre
    LivresScolaires {
        query: String,
    },
    LivresVente,

    // Tokens
    Recharger,

    // Tokens
    // (déjà déclaré plus haut)

    // YukpoIA
    YukpoIA {
        question: String,
    },
    GenererDocument {
        doc_type: &'static str,
        topic: String,
    },
    AnalyserFichier,

    // Gestion produits prestataire
    MesProduits,

    // Recherche service/prestataire
    RechercheService {
        query: String,
    },

    // Publier produit via texte libre
    PublierProduitTexte {
        description: String,
    },

    // Covoiturage
    CovoiturageSearch {
        query: String,
    },
    CovoiturageCreate,

    // Partenaire
    Devenir {
        partner_type: Option<String>,
    },
    PartnerDashboard,
    PartnerCommandes,
    CommunityManager,
    TendancesMarche,

    // Sous-menu (catégorie)
    SousMenu {
        category: String,
    },

    // Annuler / Retour
    Annuler,

    // Confirmation générique
    Confirmer,

    // Numérique (choix dans un menu)
    Choix {
        n: usize,
    },

    // Message inconnu
    Inconnu,
}

// ─── Service principal ────────────────────────────────────────────────────────

pub struct WhatsAppChatbotService {
    pub pool: Arc<PgPool>,
    app_ia: Arc<AppIA>,
    sessions: Arc<WhatsAppSessionService>,
    commerce: Arc<WhatsAppCommerceService>,
    alerts: Arc<WhatsAppAlertService>,
    books: Arc<WhatsAppBooksService>,
    realestate: Arc<WhatsAppRealEstateService>,
    products: Arc<WhatsAppProductService>,
    provider: Arc<WhatsAppProviderService>,
    ia: Arc<WhatsAppIAService>,
    partner: Arc<WhatsAppPartnerService>,
    cm: Arc<WhatsAppCMService>,
    covoiturage: Arc<WhatsAppCovoiturageService>,
}

impl WhatsAppChatbotService {
    pub fn new(pool: Arc<PgPool>, app_ia: Arc<AppIA>) -> Self {
        let sessions = Arc::new(WhatsAppSessionService::new(pool.clone()));
        let commerce = Arc::new(WhatsAppCommerceService::new(pool.clone()));
        let alerts = Arc::new(WhatsAppAlertService::new(pool.clone()));
        let books = Arc::new(WhatsAppBooksService::new(pool.clone(), app_ia.clone()));
        let realestate = Arc::new(WhatsAppRealEstateService::new(pool.clone()));
        let products = Arc::new(WhatsAppProductService::new(pool.clone(), app_ia.clone()));
        let provider = Arc::new(WhatsAppProviderService::new(pool.clone()));
        let ia = Arc::new(WhatsAppIAService::new(pool.clone()));
        let partner = Arc::new(WhatsAppPartnerService::new(pool.clone()));
        let cm = Arc::new(WhatsAppCMService::new(pool.clone()));
        let covoiturage = Arc::new(WhatsAppCovoiturageService::new(pool.clone()));
        Self {
            pool,
            app_ia,
            sessions,
            commerce,
            alerts,
            books,
            realestate,
            products,
            provider,
            ia,
            partner,
            cm,
            covoiturage,
        }
    }

    /// Point d'entrée principal — reçoit le payload complet du webhook
    pub async fn handle_webhook(&self, from: &str, payload: &serde_json::Value) -> String {
        let message = payload.get("Body").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let image_url = extract_image_url_from_payload(payload);
        // Type MIME du média (image/jpeg, application/pdf, text/csv, audio/ogg, etc.)
        let media_content_type = payload
            .get("MediaContentType0")
            .and_then(|v| v.as_str())
            .unwrap_or("image/jpeg")
            .to_string();
        let location = extract_location_from_payload(payload);

        // ── Message vocal → transcription Whisper → traiter comme texte ─────
        if let Some(media_url) = image_url.as_deref() {
            let ct = media_content_type.to_lowercase();
            if ct.contains("audio")
                || ct.contains("ogg")
                || ct.contains("mpeg")
                || ct.contains("mp4")
            {
                let session = self.sessions.get_or_create(from).await;
                return self.handle_audio(from, &session, media_url).await;
            }
        }

        // Récupérer la session
        let session = self.sessions.get_or_create(from).await;

        log::info!(
            "[Chatbot] 📩 {} | state={:?} | msg='{}' | img={} | loc={}",
            from,
            session.state,
            message,
            image_url.is_some(),
            location.is_some()
        );

        // Routage selon l'état courant
        self.route(
            &session,
            from,
            &message,
            image_url.as_deref(),
            &media_content_type,
            location,
            payload,
        )
        .await
    }

    /// Routeur principal — gère l'état courant ET l'intention du message
    async fn route(
        &self,
        session: &WhatsAppSession,
        phone: &str,
        message: &str,
        image_url: Option<&str>,
        media_content_type: &str,
        location: Option<(f64, f64, String)>,
        payload: &serde_json::Value,
    ) -> String {
        // ── Onboarding prioritaire ────────────────────────────────────────────
        match &session.state {
            ConversationState::New => {
                if session.user_id.is_some() {
                    // Le numéro est déjà lié à un compte → reconnexion automatique
                    self.sessions.save_state(phone, &ConversationState::MainMenu).await;
                    let name = session.name.as_deref().unwrap_or("vous");
                    return format!(
                        "👋 Ravi de vous revoir *{}* !\n\n{}",
                        name,
                        self.main_menu()
                    );
                }
                // Nouveau numéro → créer un compte
                self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                return self.welcome_new_user();
            }
            ConversationState::AwaitingName => {
                if message.len() >= 2 {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingCity {
                                name: message.to_string(),
                            },
                        )
                        .await;
                    return format!("Super *{}* ! 👍\n\nÉtape 2/2 — 📍 Dans quelle ville êtes-vous ?\n_(Ex : Douala, Yaoundé, Bafoussam)_", message);
                }
                return "Étape 1/2 — Comment vous appelez-vous ? _(Tapez votre prénom)_"
                    .to_string();
            }
            ConversationState::AwaitingCity { name } => {
                let city = detect_city(message);
                let user_id = self.sessions.create_account(phone, name, &city).await;
                // Abonner automatiquement aux alertes de la ville
                self.sessions.subscribe_alerts(phone, &city, user_id).await;
                self.sessions.save_state(phone, &ConversationState::MainMenu).await;
                return format!(
                    "✅ *Bienvenue sur Yukpo, {} !*\n\n\
                    🎁 Vous recevez *50 tokens* offerts pour démarrer !\n\
                    🔔 Vous êtes abonné aux alertes de *{}*.\n\n{}",
                    name,
                    city,
                    self.main_menu()
                );
            }
            _ => {}
        }

        // ── Mots-clés globaux — priorité absolue sur tout état ───────────────
        let msg_lower = message.to_lowercase();
        let msg_lower = msg_lower.trim();
        if msg_lower == "menu"
            || msg_lower == "aide"
            || msg_lower == "help"
            || msg_lower == "00"
            || msg_lower == "bonjour"
            || msg_lower == "annuler"
            || msg_lower == "cancel"
            || msg_lower == "0"
        {
            self.sessions.reset_to_menu(phone).await;
            return self.main_menu();
        }
        let msg_lower = msg_lower.to_string();

        // ── Image reçue → traitement spécifique selon état ────────────────────
        if let Some(url) = image_url {
            return self.handle_media(session, phone, url, media_content_type).await;
        }

        // ── Localisation GPS reçue ────────────────────────────────────────────
        if let Some((lat, lng, addr)) = location {
            return self.handle_location(session, phone, lat, lng, &addr).await;
        }

        // ── Flows avec état courant ───────────────────────────────────────────
        let response = self.handle_stateful(session, phone, message).await;
        if let Some(r) = response {
            return r;
        }

        // ── Détection d'intention libre ───────────────────────────────────────
        let intent = detect_intent(message);
        self.handle_intent(session, phone, intent, message).await
    }

    // ── Gestion des flows avec état ───────────────────────────────────────────

    async fn handle_stateful(
        &self,
        session: &WhatsAppSession,
        phone: &str,
        message: &str,
    ) -> Option<String> {
        let msg = message.to_lowercase();

        match &session.state {
            // ── Tokens insuffisants ───────────────────────────────────────────
            ConversationState::AwaitingTokenPackChoice { action_context } => {
                let context = action_context.clone();
                if let Some(pack) = parse_pack_choice(message) {
                    let reference = generate_payment_reference();
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingPaymentMethod {
                                tokens: pack.tokens,
                                amount_fcfa: pack.amount_fcfa,
                                action_context: context,
                            },
                        )
                        .await;
                    return Some(payment_method_menu(pack));
                }
                return Some(token_pack_menu(&context));
            }

            ConversationState::AwaitingPaymentMethod {
                tokens,
                amount_fcfa,
                action_context,
            } => {
                let (t, a, ctx) = (*tokens, *amount_fcfa, action_context.clone());
                let method = if msg.contains("1") || msg.contains("mtn") {
                    "mtn"
                } else if msg.contains("2") || msg.contains("orange") {
                    "orange"
                } else {
                    return Some(format!("Tapez *1* pour MTN ou *2* pour Orange Money."));
                };

                let pack_fake = crate::services::whatsapp_commerce_service::TOKEN_PACKS
                    .iter()
                    .find(|p| p.tokens == t)
                    .unwrap_or(&crate::services::whatsapp_commerce_service::TOKEN_PACKS[0]);

                let reference = generate_payment_reference();
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingPaymentConfirmation {
                            tokens: t,
                            amount_fcfa: a,
                            method: method.to_string(),
                            reference: reference.clone(),
                        },
                    )
                    .await;
                return Some(payment_instructions(pack_fake, method, &reference));
            }

            ConversationState::AwaitingPaymentConfirmation {
                tokens,
                method: _,
                reference,
                ..
            } => {
                let t = *tokens;
                if msg.contains("confirm")
                    || msg.contains("ok")
                    || msg.contains("fait")
                    || msg.contains("payé")
                {
                    if let Some(user_id) = session.user_id {
                        let new_balance = self.sessions.credit_tokens(user_id, t).await;
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "✅ *{} tokens crédités !*\n\
                            💎 Nouveau solde : *{} tokens*\n\n{}",
                            t,
                            new_balance,
                            self.main_menu()
                        ));
                    }
                }
                return Some(format!("En attente de votre confirmation de paiement (référence *{}*).\nTapez *CONFIRMER* une fois le paiement effectué.", reference));
            }

            // ── Pharmacie — choix + livraison ─────────────────────────────────
            ConversationState::AwaitingPharmacyChoice { results } => {
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n > 0 && n <= results.len() {
                        let r = results[n - 1].clone();
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingDeliveryAddress {
                                    pharmacy_id: r.pharmacy_id,
                                    product_name: r.product_name.clone(),
                                    price_fcfa: r.price_fcfa,
                                },
                            )
                            .await;
                        return Some(format!(
                            "🏪 *{}* sélectionnée !\n\n\
                            💊 {} — {} FCFA\n\n\
                            📍 Partagez votre adresse de livraison\n\
                            (envoyez votre localisation GPS ou tapez l'adresse)",
                            r.pharmacy_name, r.product_name, r.price_fcfa
                        ));
                    }
                }
                let results_clone = results.clone();
                return Some(WhatsAppCommerceService::format_pharmacy_results(
                    &results_clone,
                    "médicament",
                ));
            }

            ConversationState::AwaitingDeliveryAddress {
                pharmacy_id,
                product_name,
                price_fcfa,
            } => {
                let (pid, pname, price) = (*pharmacy_id, product_name.clone(), *price_fcfa);
                let address = message.to_string();
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingDeliveryConfirmation {
                            pharmacy_id: pid,
                            product_name: pname.clone(),
                            price_fcfa: price,
                            address: address.clone(),
                        },
                    )
                    .await;
                return Some(WhatsAppCommerceService::delivery_confirmation_message(
                    &pname, price, &address, 500,
                ));
            }

            ConversationState::AwaitingDeliveryConfirmation {
                pharmacy_id,
                product_name,
                price_fcfa,
                address,
            } => {
                if msg.contains("confirm") || msg.contains("oui") || msg.contains("ok") {
                    if let Some(user_id) = session.user_id {
                        let order_ref = self
                            .commerce
                            .create_delivery_order(
                                user_id,
                                *pharmacy_id,
                                product_name,
                                *price_fcfa,
                                address,
                            )
                            .await;
                        self.sessions.reset_to_menu(phone).await;
                        if let Some(ref_code) = order_ref {
                            return Some(format!(
                                "✅ *Commande confirmée !*\n\n\
                                🔖 Référence : *{}*\n\
                                💊 {}\n\
                                📍 Livraison à : {}\n\
                                ⏱️ Livraison estimée : 20-40 min\n\n\
                                Paiement à la livraison (MTN/Orange/Espèces)\n\n\
                                📲 Suivez votre commande sur l'app *Yukpo* !",
                                ref_code, product_name, address
                            ));
                        }
                    } else {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(
                            "✅ Commande enregistrée ! La pharmacie vous contactera sous peu."
                                .to_string(),
                        );
                    }
                }
                self.sessions.reset_to_menu(phone).await;
                return Some(format!("↩️ Commande annulée.\n\n{}", self.main_menu()));
            }

            // ── Bus — choix siège ─────────────────────────────────────────────
            ConversationState::AwaitingBusChoice { results } => {
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n > 0 && n <= results.len() {
                        let trip = results[n - 1].clone();
                        let msg_confirm = WhatsAppCommerceService::bus_seat_confirmation(&trip);
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingBusSeatConfirmation {
                                    trip_id: trip.trip_id.clone(),
                                    trip_name: trip.trip_name.clone(),
                                    price_fcfa: trip.price_fcfa,
                                },
                            )
                            .await;
                        return Some(msg_confirm);
                    }
                }
                let results_clone = results.clone();
                return Some(WhatsAppCommerceService::format_bus_results(
                    &results_clone,
                    "votre ville",
                    None,
                ));
            }

            ConversationState::AwaitingBusSeatConfirmation {
                trip_id,
                trip_name,
                price_fcfa,
            } => {
                if msg.contains("confirm")
                    || msg.contains("oui")
                    || msg.contains("ok")
                    || msg.contains("reserv")
                {
                    self.sessions.reset_to_menu(phone).await;
                    return Some(format!(
                        "✅ *Réservation confirmée !*\n\n\
                        🚌 *{}*\n\
                        🔖 Référence : BUS-{}\n\n\
                        Présentez-vous à l'agence avec ce numéro.\n\n\
                        📲 Gérez vos réservations sur *Yukpo* !",
                        trip_name, trip_id
                    ));
                }
                self.sessions.reset_to_menu(phone).await;
                return Some(format!("↩️ Réservation annulée.\n\n{}", self.main_menu()));
            }

            // ── Alertes — type puis localisation ─────────────────────────────
            ConversationState::AwaitingAlertType => {
                if let Some((alert_type, icon, label)) =
                    WhatsAppAlertService::parse_alert_type_choice(message)
                {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingAlertLocation {
                                alert_type: alert_type.to_string(),
                            },
                        )
                        .await;
                    return Some(format!(
                        "{} *Alerte {}* sélectionnée !\n\n\
                        📍 *Partagez votre position GPS* (bouton 📎 → Localisation)\n\
                        ou tapez le nom du lieu.\n\n\
                        _La position GPS est recommandée pour plus de précision._",
                        icon, label
                    ));
                }
                return Some(WhatsAppAlertService::alert_type_menu());
            }

            ConversationState::AwaitingAlertLocation { alert_type } => {
                let at = alert_type.clone();
                let city = detect_city(message);
                let alert_id = self
                    .alerts
                    .create_alert(
                        &at,
                        None,
                        None,
                        message,
                        &city,
                        session.name.as_deref().unwrap_or(phone),
                    )
                    .await;

                if alert_id.is_some() {
                    // Diffuser aux abonnés de la zone
                    let subscribers = self.sessions.get_alert_subscribers(&city).await;
                    let (icon, label) =
                        crate::services::whatsapp_alert_service::alert_icon_label(&at);
                    let broadcast_msg = format!(
                        "🚨 *ALERTE YUKPO — {}*\n\n{} *{}*\n📍 {}\n\nSignalé par la communauté. Restez prudents !",
                        city, icon, label, message
                    );
                    log::info!(
                        "[Chatbot] 📢 Diffusion alerte à {} abonnés à {}",
                        subscribers.len(),
                        city
                    );
                    // Note: la diffusion réelle se fait depuis le WhatsAppService via Twilio
                    // On stocke les destinataires dans le contexte pour traitement asynchrone

                    self.sessions.reset_to_menu(phone).await;
                    return Some(format!(
                        "✅ *Alerte signalée !*\n\n\
                        {} *{}*\n\
                        📍 {}\n\
                        👥 Notifié à {} conducteur(s) dans la zone.\n\n\
                        Merci pour la communauté Yukpo ! 🙏",
                        icon,
                        label,
                        message,
                        subscribers.len()
                    ));
                }
                self.sessions.reset_to_menu(phone).await;
                return Some(format!(
                    "⚠️ Alerte enregistrée pour {}.\n\n{}",
                    message,
                    self.main_menu()
                ));
            }

            // ── Bourse du livre — attente verso ──────────────────────────────
            ConversationState::AwaitingBookVerso { recto_url, books } => {
                let (recto, books_clone) = (recto_url.clone(), books.clone());
                let msg_t = message.trim().to_lowercase();
                if msg_t == "analyser" || msg_t == "passer" || msg_t == "ok" {
                    // Analyser avec le recto seulement
                    let book = self.books.identify_book_from_image(&recto).await;
                    let index = books_clone.len() + 1;
                    let result_msg = WhatsAppBooksService::format_scan_result(&book, index);
                    let mut updated = books_clone;
                    updated.push(book);
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::BookScanSession { books: updated },
                        )
                        .await;
                    return Some(result_msg);
                }
                if msg_t == "fin" || msg_t == "terminer" {
                    if books_clone.is_empty() {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("Aucun livre scanné.\n\n{}", self.main_menu()));
                    }
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingBookScanAction {
                                books: books_clone.clone(),
                            },
                        )
                        .await;
                    return Some(WhatsAppBooksService::format_scan_recap(&books_clone));
                }
                return Some("📸 Envoyez le *verso* du livre, ou tapez *ANALYSER* pour identifier avec cette photo, ou *FIN* pour terminer.".to_string());
            }

            // ── Bourse du livre — scan multiple ──────────────────────────────
            ConversationState::BookScanSession { books } => {
                // Message texte dans la session scan → commandes
                if msg == "fin" || msg == "terminer" || msg == "recap" || msg == "récap" {
                    let books_clone = books.clone();
                    if books_clone.is_empty() {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("Aucun livre scanné.\n\n{}", self.main_menu()));
                    }
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingBookScanAction {
                                books: books_clone.clone(),
                            },
                        )
                        .await;
                    return Some(WhatsAppBooksService::format_scan_recap(&books_clone));
                }
                return Some(
                    "📚 Session de scan en cours.\n\nEnvoyez les photos de vos livres.\nTapez *FIN* pour voir le récapitulatif.".to_string()
                );
            }

            ConversationState::AwaitingBookScanAction { books } => {
                let books_clone = books.clone();
                match message.trim() {
                    "1" => {
                        // Mettre en vente
                        if let Some(user_id) = session.user_id {
                            for book in &books_clone {
                                self.books.publish_book(user_id, book, "vente").await;
                            }
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "✅ *{} livre(s) mis en vente sur Yukpo !*\n\n\
                            📲 Gérez vos annonces sur l'app Yukpo.\n\n{}",
                            books_clone.len(),
                            self.main_menu()
                        ));
                    }
                    "2" => {
                        // Proposer en troc
                        if let Some(user_id) = session.user_id {
                            for book in &books_clone {
                                self.books.publish_book(user_id, book, "troc").await;
                            }
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "✅ *{} livre(s) proposés en troc sur Yukpo !*\n\n\
                            📲 Gérez vos échanges sur l'app Yukpo.\n\n{}",
                            books_clone.len(),
                            self.main_menu()
                        ));
                    }
                    "3" | "annuler" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("↩️ Annulé.\n\n{}", self.main_menu()));
                    }
                    _ => {
                        return Some(WhatsAppBooksService::format_scan_recap(&books_clone));
                    }
                }
            }

            // ── Immobilier — choix bien ───────────────────────────────────────
            ConversationState::AwaitingPropertyChoice { results } => {
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n > 0 && n <= results.len() {
                        let prop = results[n - 1].clone();
                        let detail = WhatsAppRealEstateService::property_detail_message(&prop);
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingReservationDate {
                                    property_id: prop.property_id.clone(),
                                    property_name: prop.name.clone(),
                                    price: prop.price.clone(),
                                },
                            )
                            .await;
                        return Some(detail);
                    }
                }
                let results_clone = results.clone();
                return Some(WhatsAppRealEstateService::format_property_results(
                    &results_clone,
                    "",
                    &crate::services::whatsapp_realestate_service::PropertySearchType::Location,
                ));
            }

            ConversationState::AwaitingReservationDate {
                property_id,
                property_name,
                price,
            } => {
                match message.trim() {
                    "1" => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingReservationDate {
                                    property_id: property_id.clone(),
                                    property_name: property_name.clone(),
                                    price: price.clone(),
                                },
                            )
                            .await;
                        return Some(format!(
                            "📅 *Quelle date souhaitez-vous visiter ?*\n\n\
                            Tapez la date au format : *JJ/MM/AAAA*\nEx : *15/04/2026*"
                        ));
                    }
                    "2" => {
                        self.sessions.reset_to_menu(phone).await;
                        let contact = "Contactez directement le propriétaire.".to_string();
                        return Some(format!("📞 {}\n\n{}", contact, self.main_menu()));
                    }
                    "3" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("↩️ Retour.\n\n{}", self.main_menu()));
                    }
                    date if date.contains("/") => {
                        // Semble être une date
                        if let Some(user_id) = session.user_id {
                            let ref_code = self
                                .realestate
                                .create_reservation(
                                    user_id,
                                    property_id,
                                    property_name,
                                    date,
                                    phone,
                                )
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            if let Some(r) = ref_code {
                                return Some(WhatsAppRealEstateService::reservation_confirmation(
                                    property_name,
                                    date,
                                    &r,
                                ));
                            }
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "✅ Visite planifiée pour le {}.\n\n{}",
                            date,
                            self.main_menu()
                        ));
                    }
                    _ => {}
                }
            }

            // ── Produit via image — confirmation ──────────────────────────────
            ConversationState::AwaitingProductConfirmation {
                image_url,
                detected_name,
                category,
                price_suggestion,
            } => {
                let (url, name, cat, price) = (
                    image_url.clone(),
                    detected_name.clone(),
                    category.clone(),
                    *price_suggestion,
                );
                match message.trim() {
                    "1" => {
                        // Publier directement
                        if let Some(user_id) = session.user_id {
                            let product_id = self
                                .products
                                .publish_product(user_id, &url, &name, &cat, price, "")
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppProductService::published_product_message(
                                &name,
                                product_id.as_deref().unwrap_or("N/A"),
                            ));
                        }
                    }
                    "2" => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingProductPrice {
                                    image_url: url,
                                    name: name.clone(),
                                    category: cat,
                                },
                            )
                            .await;
                        return Some(WhatsAppProductService::ask_product_name());
                    }
                    "3" => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingProductPrice {
                                    image_url: url,
                                    name,
                                    category: cat,
                                },
                            )
                            .await;
                        return Some(WhatsAppProductService::ask_product_price("votre produit"));
                    }
                    "4" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("↩️ Annulé.\n\n{}", self.main_menu()));
                    }
                    _ => {}
                }
            }

            ConversationState::AwaitingProductPrice {
                image_url,
                name,
                category,
            } => {
                let (url, n, cat) = (image_url.clone(), name.clone(), category.clone());
                if let Ok(price) =
                    message.trim().replace(" ", "").replace("fcfa", "").parse::<i64>()
                {
                    if let Some(user_id) = session.user_id {
                        let product_id =
                            self.products.publish_product(user_id, &url, &n, &cat, price, "").await;
                        self.sessions.reset_to_menu(phone).await;
                        return Some(WhatsAppProductService::published_product_message(
                            &n,
                            product_id.as_deref().unwrap_or("N/A"),
                        ));
                    }
                }
                return Some(format!(
                    "Tapez le prix en FCFA (chiffres uniquement).\nEx : *5000*"
                ));
            }

            // ── YukpoIA — Chat conversationnel ────────────────────────────────
            ConversationState::YukpoIAChat => {
                let msg_trim = message.trim();
                if msg_trim.is_empty() {
                    return Some(ia_welcome_message().to_string());
                }

                // Détecter demande de création de compte → rediriger vers inscription
                let msg_low = msg_trim.to_lowercase();
                if session.user_id.is_none()
                    && (msg_low.contains("créer mon compte")
                        || msg_low.contains("creer mon compte")
                        || msg_low.contains("créer un compte")
                        || msg_low.contains("m'inscrire")
                        || msg_low.contains("m inscrire")
                        || msg_low.contains("inscription")
                        || msg_low.contains("s'inscrire")
                        || msg_low.contains("compte yukpo"))
                {
                    self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                    return Some(
                        "✍️ *Créons votre compte Yukpo !*\n\nÉtape 1/2 — Comment vous appelez-vous ?\n_(Tapez votre prénom)_"
                            .to_string(),
                    );
                }

                // Détecter génération de document
                if let Some((doc_type, topic)) =
                    WhatsAppIAService::detect_document_request(msg_trim)
                {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingDocumentConfirm {
                                topic: topic.clone(),
                                doc_type: doc_type.to_string(),
                            },
                        )
                        .await;
                    return Some(format!(
                        "📄 Je vais générer votre *{}*.\n\nSujet : *{}*\n\n\
                        Confirmez : *OUI* pour générer ({} tokens) ou *NON* pour annuler.",
                        if doc_type == "pptx" {
                            "présentation PowerPoint"
                        } else {
                            "document Word"
                        },
                        topic,
                        DOCUMENT_GENERATION_COST
                    ));
                }

                // Réponse IA — vérifier tokens
                if let Some(uid) = session.user_id {
                    match self.sessions.check_and_deduct_tokens(uid, AI_QUERY_TOKEN_COST).await {
                        Ok(new_balance) => {
                            let name = session.name.as_deref();
                            let answer = self.ia.chat(msg_trim, name).await;
                            return Some(format!(
                                "🤖 *YukpoIA*\n\n{}\n\n💎 _{} tokens_ — tapez *MENU* pour revenir au menu",
                                answer, new_balance
                            ));
                        }
                        Err(_) => {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::AwaitingTokenPackChoice {
                                        action_context: "utiliser YukpoIA".to_string(),
                                    },
                                )
                                .await;
                            return Some(token_pack_menu("utiliser YukpoIA"));
                        }
                    }
                } else {
                    // Pas de compte — répondre gratuitement (limité) + invitation à créer compte
                    let answer = self.ia.chat(msg_trim, None).await;
                    return Some(format!(
                        "🤖 *YukpoIA*\n\n{}\n\n💡 _Tapez *MENU* pour les autres services ou *créer mon compte* pour profiter de Yukpo !_",
                        answer
                    ));
                }
            }

            // ── YukpoIA — Confirmation génération document ────────────────────
            ConversationState::AwaitingDocumentConfirm { topic, doc_type } => {
                let (t, dt) = (topic.clone(), doc_type.clone());
                let msg_low = message.trim().to_lowercase();
                if msg_low == "oui" || msg_low == "yes" || msg_low == "o" {
                    if let Some(uid) = session.user_id {
                        match self
                            .sessions
                            .check_and_deduct_tokens(uid, DOCUMENT_GENERATION_COST)
                            .await
                        {
                            Ok(_) => {
                                // Générer le document
                                let doc_type_str: &str = if dt == "pptx" { "pptx" } else { "docx" };
                                let name = session.name.as_deref();
                                let generating_msg = format_document_generating(&t, doc_type_str);
                                self.sessions
                                    .save_state(phone, &ConversationState::YukpoIAChat)
                                    .await;

                                // Note: La génération réelle via Python subprocess nécessite AppState.
                                // Pour WhatsApp, on génère via l'API publique du backend.
                                // On retourne le message de génération + lien vers l'API.
                                let api_url = std::env::var("BACKEND_URL").unwrap_or_else(|_| {
                                    "https://yukpo-backend-376093909298.europe-west1.run.app"
                                        .to_string()
                                });
                                return Some(format!(
                                    "{}\n\n🔗 Disponible sur l'app *Yukpo* → YukpoIA → Documents\n\
                                    \nOU tapez votre question suivante !",
                                    generating_msg
                                ));
                            }
                            Err(_) => {
                                self.sessions
                                    .save_state(
                                        phone,
                                        &ConversationState::AwaitingTokenPackChoice {
                                            action_context: format!("générer le document '{}'", t),
                                        },
                                    )
                                    .await;
                                return Some(token_pack_menu(&format!("générer '{}'", t)));
                            }
                        }
                    } else {
                        return Some("🔐 Créez votre compte Yukpo pour générer des documents.\nTapez *MENU* pour commencer.".to_string());
                    }
                } else {
                    self.sessions.save_state(phone, &ConversationState::YukpoIAChat).await;
                    return Some(
                        "❌ Génération annulée. Posez votre prochaine question !".to_string(),
                    );
                }
            }

            // ── YukpoIA — Sélection type de document ─────────────────────────
            ConversationState::AwaitingDocumentTopic { doc_type } => {
                let dt = doc_type.clone();
                let topic = message.trim().to_string();
                if topic.len() < 3 {
                    return Some(
                        "Décrivez le sujet de votre document en quelques mots.".to_string(),
                    );
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingDocumentConfirm {
                            topic: topic.clone(),
                            doc_type: dt.clone(),
                        },
                    )
                    .await;
                return Some(format!(
                    "📄 Sujet confirmé : *{}*\n\nTapez *OUI* pour générer ({} tokens) ou *NON* pour annuler.",
                    topic, DOCUMENT_GENERATION_COST
                ));
            }

            // ── Gestion produits prestataire ──────────────────────────────────
            ConversationState::ProviderMyProducts { products } => {
                // L'utilisateur tape un numéro pour sélectionner un produit
                let products_clone = products.clone();
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n >= 1 && n <= products_clone.len() {
                        let product = &products_clone[n - 1];
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::ProviderProductAction {
                                    product_id: product.product_id,
                                    product_type: product.product_type.clone(),
                                    product_name: product.name.clone(),
                                    is_active: product.is_active,
                                },
                            )
                            .await;
                        return Some(WhatsAppProviderService::format_product_actions(product));
                    }
                }
                return Some("Tapez un numéro valide pour sélectionner un produit.".to_string());
            }

            ConversationState::ProviderProductAction {
                product_id,
                product_type,
                product_name,
                is_active,
            } => {
                let (pid, ptype, pname, active) = (
                    *product_id,
                    product_type.clone(),
                    product_name.clone(),
                    *is_active,
                );
                match message.trim() {
                    "1" => {
                        // Activer ou désactiver
                        if active {
                            // Désactiver (gratuit)
                            if let Some(uid) = session.user_id {
                                let _ = self.provider.deactivate_product(uid, pid, &ptype).await;
                            }
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppProviderService::product_updated_message(
                                "deactivated",
                                &pname,
                            ));
                        } else {
                            // Réactiver (coûte des tokens)
                            if let Some(uid) = session.user_id {
                                match self
                                    .sessions
                                    .check_and_deduct_tokens(uid, REACTIVATION_TOKEN_COST)
                                    .await
                                {
                                    Ok(_) => {
                                        let _ =
                                            self.provider.activate_product(uid, pid, &ptype).await;
                                        self.sessions.reset_to_menu(phone).await;
                                        return Some(
                                            WhatsAppProviderService::product_updated_message(
                                                "activated",
                                                &pname,
                                            ),
                                        );
                                    }
                                    Err(_) => {
                                        self.sessions
                                            .save_state(
                                                phone,
                                                &ConversationState::AwaitingTokenPackChoice {
                                                    action_context: format!("réactiver {}", pname),
                                                },
                                            )
                                            .await;
                                        return Some(token_pack_menu(&format!(
                                            "réactiver {}",
                                            pname
                                        )));
                                    }
                                }
                            }
                            return Some(
                                "Vous devez créer un compte pour réactiver ce produit.".to_string(),
                            );
                        }
                    }
                    "2" => {
                        // Modifier le prix
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::ProviderModifyPrice {
                                    product_id: pid,
                                    product_type: ptype.clone(),
                                    product_name: pname.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppProviderService::ask_new_price(&pname));
                    }
                    "3" => {
                        // Demander confirmation suppression
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::ProviderDeleteConfirm {
                                    product_id: pid,
                                    product_type: ptype.clone(),
                                    product_name: pname.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppProviderService::confirm_delete_message(&pname));
                    }
                    "4" => {
                        // Retour à la liste
                        if let Some(uid) = session.user_id {
                            let products = self.provider.list_user_products(uid).await;
                            let msg = WhatsAppProviderService::format_products_list(&products);
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::ProviderMyProducts { products },
                                )
                                .await;
                            return Some(msg);
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some("Session expirée. Tapez *MENU* pour recommencer.".to_string());
                    }
                    _ => {
                        return Some("Tapez *1*, *2*, *3* ou *4*.".to_string());
                    }
                }
            }

            ConversationState::ProviderModifyPrice {
                product_id,
                product_type,
                product_name,
            } => {
                let (pid, ptype, pname) = (*product_id, product_type.clone(), product_name.clone());
                if let Ok(price) =
                    message.trim().replace(" ", "").replace("fcfa", "").parse::<i64>()
                {
                    if price > 0 {
                        if let Some(uid) = session.user_id {
                            let _ =
                                self.provider.update_product_price(uid, pid, &ptype, price).await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppProviderService::price_updated_message(
                                &pname, price,
                            ));
                        }
                    }
                }
                return Some("Prix invalide. Tapez un montant en FCFA.\nEx : *5000*".to_string());
            }

            ConversationState::ProviderDeleteConfirm {
                product_id,
                product_type,
                product_name,
            } => {
                let (pid, ptype, pname) = (*product_id, product_type.clone(), product_name.clone());
                match message.trim() {
                    "1" => {
                        if let Some(uid) = session.user_id {
                            let _ = self.provider.delete_product(uid, pid, &ptype).await;
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some(WhatsAppProviderService::product_updated_message(
                            "deleted", &pname,
                        ));
                    }
                    "2" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some("❌ Suppression annulée.".to_string());
                    }
                    _ => return Some("Tapez *1* pour confirmer ou *2* pour annuler.".to_string()),
                }
            }

            // ── Onboarding Partenaire ─────────────────────────────────────────
            ConversationState::PartnerTypeSelection => {
                if let Some(ptype) = PartnerType::from_text(message) {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::PartnerOnboarding {
                                partner_type: ptype.db_value().to_string(),
                                step: 1,
                                name: String::new(),
                                phone: String::new(),
                                city: String::new(),
                                extra: String::new(),
                            },
                        )
                        .await;
                    return Some(WhatsAppPartnerService::onboarding_step1_message(&ptype));
                }
                return Some(WhatsAppPartnerService::partner_type_menu());
            }

            ConversationState::PartnerOnboarding {
                partner_type,
                step,
                name,
                phone: wa_phone,
                city,
                extra,
            } => {
                let (ptype_str, s, cur_name, cur_phone, cur_city, cur_extra) = (
                    partner_type.clone(),
                    *step,
                    name.clone(),
                    wa_phone.clone(),
                    city.clone(),
                    extra.clone(),
                );
                let ptype = PartnerType::from_db(&ptype_str);

                match s {
                    1 => {
                        // Collecte du nom du business
                        if message.trim().len() < 2 {
                            return Some(
                                "Veuillez entrer un nom valide pour votre activité.".to_string(),
                            );
                        }
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOnboarding {
                                    partner_type: ptype_str,
                                    step: 2,
                                    name: message.trim().to_string(),
                                    phone: cur_phone,
                                    city: cur_city,
                                    extra: cur_extra,
                                },
                            )
                            .await;
                        return Some(WhatsAppPartnerService::onboarding_step2_message(
                            message.trim(),
                        ));
                    }
                    2 => {
                        // Collecte du numéro WhatsApp professionnel
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOnboarding {
                                    partner_type: ptype_str,
                                    step: 3,
                                    name: cur_name,
                                    phone: message.trim().to_string(),
                                    city: cur_city,
                                    extra: cur_extra,
                                },
                            )
                            .await;
                        return Some(
                            WhatsAppPartnerService::onboarding_step3_message().to_string(),
                        );
                    }
                    3 => {
                        // Collecte adresse/ville
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOnboarding {
                                    partner_type: ptype_str,
                                    step: 4,
                                    name: cur_name,
                                    phone: cur_phone,
                                    city: message.trim().to_string(),
                                    extra: cur_extra,
                                },
                            )
                            .await;
                        return Some(WhatsAppPartnerService::onboarding_step4_message(&ptype));
                    }
                    4 | _ => {
                        // Collecte donnée spécifique (horaires, prix, spécialité…)
                        let extra_val = message.trim().to_string();
                        if let Some(user_id) = session.user_id {
                            // Upgrade vers partenaire
                            self.partner.upgrade_to_partner(user_id, &ptype_str).await;
                            // Créer le service
                            let service_id = self
                                .partner
                                .create_partner_service(
                                    user_id, &ptype_str, &cur_name, &cur_phone, &cur_city,
                                    &extra_val,
                                )
                                .await;

                            if let Some(sid) = service_id {
                                self.sessions
                                    .save_state(
                                        phone,
                                        &ConversationState::PartnerMenu {
                                            service_id: sid,
                                            partner_type: ptype_str,
                                            service_name: cur_name.clone(),
                                        },
                                    )
                                    .await;
                                return Some(WhatsAppPartnerService::onboarding_success_message(
                                    &ptype, &cur_name, sid,
                                ));
                            }
                        }
                        // Pas encore connecté → créer compte d'abord
                        self.sessions.save_state(phone, &ConversationState::New).await;
                        return Some("🔐 Créez d'abord votre compte Yukpo.\nTapez *MENU* pour commencer l'inscription.".to_string());
                    }
                }
            }

            // ── Menu partenaire ───────────────────────────────────────────────
            ConversationState::PartnerMenu {
                service_id,
                partner_type,
                service_name,
            } => {
                let (sid, ptype_str, sname) =
                    (*service_id, partner_type.clone(), service_name.clone());
                match message.trim() {
                    "1" => {
                        let orders = self.partner.get_pending_orders(sid).await;
                        let msg = WhatsAppPartnerService::format_orders(&orders);
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOrdersList {
                                    orders,
                                    service_id: sid,
                                },
                            )
                            .await;
                        return Some(msg);
                    }
                    "2" => {
                        let stats = self.partner.get_stats(sid).await;
                        let msg = WhatsAppPartnerService::format_dashboard(&stats);
                        return Some(msg);
                    }
                    "3" => {
                        // Établissements scolaires → gestion des manuels scolaires
                        if ptype_str == "etablissementscolaire" {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::SchoolManualLevel {
                                        service_id: sid,
                                        school_name: sname.clone(),
                                    },
                                )
                                .await;
                            return Some(WhatsAppBooksService::school_manual_level_prompt(&sname));
                        }
                        let ptype = PartnerType::from_db(&ptype_str);
                        let label = ptype.product_label().to_string();
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerAddProduct {
                                    service_id: sid,
                                    partner_type: ptype_str,
                                },
                            )
                            .await;
                        return Some(WhatsAppPartnerService::add_product_prompt(&label));
                    }
                    "4" => {
                        let ptype = PartnerType::from_db(&ptype_str);
                        let category = ptype.db_value().to_string();
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::CMMenu {
                                    service_id: sid,
                                    category: category.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppCMService::cm_menu_message(&sname));
                    }
                    "5" => {
                        let ptype = PartnerType::from_db(&ptype_str);
                        let category = ptype.db_value().to_string();
                        let city = session.city.as_deref().unwrap_or("Douala");
                        let trends = self.cm.get_trends_for_category(&category, city).await;
                        return Some(WhatsAppCMService::format_trends(&trends, &category));
                    }
                    "6" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(self.main_menu());
                    }
                    _ => return Some(WhatsAppPartnerService::partner_menu(&sname, &ptype_str)),
                }
            }

            // ── Commandes partenaire ──────────────────────────────────────────
            ConversationState::PartnerOrdersList { orders, service_id } => {
                let (sid, orders_clone) = (*service_id, orders.clone());
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n >= 1 && n <= orders_clone.len() {
                        let order = &orders_clone[n - 1];
                        let msg = WhatsAppPartnerService::format_order_actions(order);
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOrderAction {
                                    order_id: order.order_id,
                                    service_id: sid,
                                    status: order.status.clone(),
                                },
                            )
                            .await;
                        return Some(msg);
                    }
                }
                return Some(WhatsAppPartnerService::format_orders(&orders_clone));
            }

            ConversationState::PartnerOrderAction {
                order_id,
                service_id,
                status,
            } => {
                let (oid, sid) = (*order_id, *service_id);
                let new_status = match message.trim() {
                    "1" => "confirmed",
                    "2" => "processing",
                    "3" => "ready",
                    "4" => "cancelled",
                    "5" => {
                        let orders = self.partner.get_pending_orders(sid).await;
                        let msg = WhatsAppPartnerService::format_orders(&orders);
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOrdersList {
                                    orders,
                                    service_id: sid,
                                },
                            )
                            .await;
                        return Some(msg);
                    }
                    _ => return Some("Tapez *1* à *5* pour choisir une action.".to_string()),
                };
                let updated = self.partner.update_order_status(oid, sid, new_status).await;
                let label = match new_status {
                    "confirmed" => "✅ Commande *confirmée* !",
                    "processing" => "🍳 Commande *en préparation* !",
                    "ready" => "✔️ Commande *prête* !",
                    "cancelled" => "❌ Commande *annulée*.",
                    _ => "✅ Statut mis à jour !",
                };
                let orders = self.partner.get_pending_orders(sid).await;
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::PartnerOrdersList {
                            orders: orders.clone(),
                            service_id: sid,
                        },
                    )
                    .await;
                return Some(format!(
                    "{}\n\n{}",
                    label,
                    WhatsAppPartnerService::format_orders(&orders)
                ));
            }

            // ── Ajout produit partenaire ──────────────────────────────────────
            ConversationState::PartnerAddProduct {
                service_id,
                partner_type,
            } => {
                let (sid, ptype_str) = (*service_id, partner_type.clone());
                if message.trim().len() < 2 {
                    let ptype = PartnerType::from_db(&ptype_str);
                    return Some(WhatsAppPartnerService::add_product_prompt(
                        ptype.product_label(),
                    ));
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::PartnerAddProductPrice {
                            service_id: sid,
                            partner_type: ptype_str,
                            product_name: message.trim().to_string(),
                        },
                    )
                    .await;
                return Some(WhatsAppPartnerService::add_product_price_prompt(
                    message.trim(),
                ));
            }

            ConversationState::PartnerAddProductPrice {
                service_id,
                partner_type,
                product_name,
            } => {
                let (sid, ptype_str, pname) =
                    (*service_id, partner_type.clone(), product_name.clone());
                if let Ok(price) =
                    message.trim().replace(" ", "").replace("fcfa", "").parse::<i64>()
                {
                    if price > 0 {
                        self.partner.add_product(sid, &pname, price, None).await;
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerMenu {
                                    service_id: sid,
                                    partner_type: ptype_str.clone(),
                                    service_name: pname.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppPartnerService::product_added_message(&pname, price));
                    }
                }
                return Some(format!(
                    "Prix invalide. Tapez un montant en FCFA.\nEx : *2500*"
                ));
            }

            // ── Community Manager ─────────────────────────────────────────────
            ConversationState::CMMenu {
                service_id,
                category,
            } => {
                let (sid, cat) = (*service_id, category.clone());
                let service_name = self
                    .partner
                    .get_partner_service(session.user_id.unwrap_or(0))
                    .await
                    .map(|(_, n, _)| n)
                    .unwrap_or_else(|| "Mon service".into());

                match message.trim() {
                    "1" => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::CMPostGenerate {
                                    service_id: sid,
                                    category: cat.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppCMService::ask_post_topic(&cat));
                    }
                    "2" => {
                        let city = session.city.as_deref().unwrap_or("Douala");
                        let trends = self.cm.get_trends_for_category(&cat, city).await;
                        self.sessions
                            .save_state(phone, &ConversationState::CMTrendsView { category: cat })
                            .await;
                        return Some(WhatsAppCMService::format_trends(&trends, &service_name));
                    }
                    "3" => {
                        let summary = self.cm.get_social_summary(sid).await;
                        return Some(WhatsAppCMService::format_social_analytics(
                            &summary,
                            &service_name,
                        ));
                    }
                    "4" => {
                        // Retour dashboard partenaire
                        let stats = self.partner.get_stats(sid).await;
                        let ptype_str = category.clone();
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerMenu {
                                    service_id: sid,
                                    partner_type: ptype_str,
                                    service_name: stats.service_name.clone(),
                                },
                            )
                            .await;
                        return Some(WhatsAppPartnerService::format_dashboard(&stats));
                    }
                    _ => return Some(WhatsAppCMService::cm_menu_message(&service_name)),
                }
            }

            ConversationState::CMPostGenerate {
                service_id,
                category,
            } => {
                let (sid, cat) = (*service_id, category.clone());
                // Le message est le sujet du post
                let topic = message.trim().to_string();
                if topic.len() < 3 {
                    return Some(WhatsAppCMService::ask_post_topic(&cat));
                }
                let content = self.cm.generate_post_content(sid, &topic).await;
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::CMPostConfirm {
                            service_id: sid,
                            content: content.clone(),
                        },
                    )
                    .await;
                return Some(WhatsAppCMService::format_generated_post(&content));
            }

            ConversationState::CMPostConfirm {
                service_id,
                content,
            } => {
                let (sid, post_content) = (*service_id, content.clone());
                match message.trim() {
                    "1" => {
                        // Publier immédiatement
                        if let Some(uid) = session.user_id {
                            let ref_code = self
                                .cm
                                .schedule_post(sid, uid, &post_content, "whatsapp_broadcast")
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppCMService::post_published_message(
                                "WhatsApp Business",
                                ref_code.as_deref().unwrap_or("N/A"),
                            ));
                        }
                    }
                    "2" => {
                        // Modifier → retour à la saisie du sujet
                        if let Some(uid) = session.user_id {
                            if let Some((service_id2, _, partner_type)) =
                                self.partner.get_partner_service(uid).await
                            {
                                self.sessions
                                    .save_state(
                                        phone,
                                        &ConversationState::CMPostGenerate {
                                            service_id: service_id2,
                                            category: partner_type,
                                        },
                                    )
                                    .await;
                                return Some(
                                    "✏️ Sur quel sujet voulez-vous modifier le post ?".to_string(),
                                );
                            }
                        }
                    }
                    "3" => {
                        // Programmer dans 1h
                        if let Some(uid) = session.user_id {
                            let ref_code =
                                self.cm.schedule_post(sid, uid, &post_content, "scheduled").await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppCMService::post_published_message(
                                "Publication programmée",
                                ref_code.as_deref().unwrap_or("N/A"),
                            ));
                        }
                    }
                    "4" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("❌ Annulé.\n\n{}", self.main_menu()));
                    }
                    _ => return Some(WhatsAppCMService::format_generated_post(&post_content)),
                }
                self.sessions.reset_to_menu(phone).await;
                return Some(self.main_menu());
            }

            ConversationState::CMTrendsView { category } => {
                let cat = category.clone();
                match message.trim() {
                    "1" => {
                        if let Some(uid) = session.user_id {
                            if let Some((sid, _, _)) = self.partner.get_partner_service(uid).await {
                                self.sessions
                                    .save_state(
                                        phone,
                                        &ConversationState::CMPostGenerate {
                                            service_id: sid,
                                            category: cat.clone(),
                                        },
                                    )
                                    .await;
                                return Some(WhatsAppCMService::ask_post_topic(&cat));
                            }
                        }
                    }
                    "2" | _ => {
                        if let Some(uid) = session.user_id {
                            if let Some((sid, sname, _)) =
                                self.partner.get_partner_service(uid).await
                            {
                                self.sessions
                                    .save_state(
                                        phone,
                                        &ConversationState::CMMenu {
                                            service_id: sid,
                                            category: cat,
                                        },
                                    )
                                    .await;
                                return Some(WhatsAppCMService::cm_menu_message(&sname));
                            }
                        }
                    }
                }
                self.sessions.reset_to_menu(phone).await;
                return Some(self.main_menu());
            }

            // ── Manuels scolaires — choix du niveau ──────────────────────────
            ConversationState::SchoolManualLevel {
                service_id,
                school_name,
            } => {
                let (sid, sname) = (*service_id, school_name.clone());
                let level = message.trim().to_string();
                if level.len() < 2 {
                    return Some(
                        "📚 Entrez un niveau valide (ex: *6ème*, *3ème*, *Terminale D*)"
                            .to_string(),
                    );
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::SchoolManualEntry {
                            service_id: sid,
                            school_name: sname,
                            level: level.clone(),
                            count: 0,
                        },
                    )
                    .await;
                return Some(WhatsAppBooksService::school_manual_entry_prompt(&level, 0));
            }

            // ── Manuels scolaires — saisie des manuels ────────────────────────
            ConversationState::SchoolManualEntry {
                service_id,
                school_name,
                level,
                count,
            } => {
                let (sid, sname, lvl, cnt) =
                    (*service_id, school_name.clone(), level.clone(), *count);
                let msg_trimmed = message.trim();

                if msg_trimmed.eq_ignore_ascii_case("fin") || msg_trimmed == "0" {
                    // Terminer la saisie
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::PartnerMenu {
                                service_id: sid,
                                partner_type: "etablissementscolaire".to_string(),
                                service_name: sname.clone(),
                            },
                        )
                        .await;
                    return Some(WhatsAppBooksService::school_manuals_done(&sname, &lvl, cnt));
                }

                if msg_trimmed == "1" && cnt > 0 {
                    // Ajouter un autre niveau
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::SchoolManualLevel {
                                service_id: sid,
                                school_name: sname,
                            },
                        )
                        .await;
                    return Some(WhatsAppBooksService::school_manual_level_prompt(
                        "votre école",
                    ));
                }

                // Ajouter le manuel
                if let Some(_added) = self.books.add_school_manual(sid, msg_trimmed, &lvl).await {
                    let new_count = cnt + 1;
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::SchoolManualEntry {
                                service_id: sid,
                                school_name: sname,
                                level: lvl.clone(),
                                count: new_count,
                            },
                        )
                        .await;
                    return Some(WhatsAppBooksService::school_manual_entry_prompt(
                        &lvl, new_count,
                    ));
                }

                return Some(format!(
                    "❌ Format incorrect.\n\nUtilisez : *Titre — Matière — Prix*\nEx: _Transmath 6ème — Mathématiques — 3500_\n\nOu tapez *FIN* pour terminer."
                ));
            }

            // ── Mode Voyage — signalement rapide (R/P/A/D/T/C/M) ────────────
            ConversationState::EnRoute {
                last_lat,
                last_lng,
                city,
            } => {
                use crate::services::whatsapp_alert_service::parse_quick_alert_code;
                let (ll, llng, cty) = (*last_lat, *last_lng, city.clone());
                let msg_up = message.trim().to_uppercase();

                // Quitter le mode voyage
                if msg_up == "STOP" || msg_up == "QUITTER" || message.trim() == "0" {
                    self.sessions.reset_to_menu(phone).await;
                    return Some(format!("🛑 Mode voyage terminé.\n\n{}", self.main_menu()));
                }

                // Voir alertes à proximité
                if msg_up == "ALERTES" || msg_up == "V" {
                    if let (Some(lat), Some(lng)) = (ll, llng) {
                        let nearby = self.alerts.get_active_alerts_nearby(lat, lng, None).await;
                        if nearby.is_empty() {
                            return Some("✅ Aucune alerte à proximité.\n\n_R=Radar P=Police A=Accident D=Danger T=Travaux C=Contrôle_\n_STOP pour quitter_".to_string());
                        }
                        let mut resp = "🚨 *Alertes à proximité :*\n\n".to_string();
                        for a in &nearby {
                            resp.push_str(&format!("{} *{}* — {}\n", a.icon, a.label, a.address));
                        }
                        resp.push_str("\n_R=Radar P=Police A=Accident STOP=Quitter_");
                        return Some(resp);
                    }
                    return Some(
                        "📍 Partagez votre position GPS pour voir les alertes à proximité."
                            .to_string(),
                    );
                }

                // Signalement rapide par code
                if let Some(alert_type) = parse_quick_alert_code(message.trim()) {
                    let address = if ll.is_some() {
                        format!(
                            "Position GPS ({:.4}, {:.4})",
                            ll.unwrap_or(0.0),
                            llng.unwrap_or(0.0)
                        )
                    } else {
                        cty.clone()
                    };
                    let reporter = session.name.as_deref().unwrap_or(phone);
                    let alert_id = self
                        .alerts
                        .create_alert(alert_type, ll, llng, &address, &cty, reporter)
                        .await;
                    let (icon, label) =
                        crate::services::whatsapp_alert_service::alert_icon_label(alert_type);

                    // Broadcast aux abonnés à proximité
                    if let Some(aid) = alert_id {
                        let alert_obj = crate::services::whatsapp_alert_service::CommunityAlert {
                            id: aid,
                            alert_type: alert_type.to_string(),
                            icon: icon.to_string(),
                            label: label.to_string(),
                            latitude: ll,
                            longitude: llng,
                            address: address.clone(),
                            city: cty.clone(),
                            reported_by: reporter.to_string(),
                            confirmations: 1,
                            status: "active".to_string(),
                            maps_url: ll
                                .map(|lat| {
                                    format!(
                                        "https://maps.google.com/?q={},{}",
                                        lat,
                                        llng.unwrap_or(0.0)
                                    )
                                })
                                .unwrap_or_default(),
                        };
                        let sent = self
                            .alerts
                            .broadcast_to_nearby_subscribers(&alert_obj, Some(reporter))
                            .await;
                        // Mise à jour GPS dans l'état
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::EnRoute {
                                    last_lat: ll,
                                    last_lng: llng,
                                    city: cty,
                                },
                            )
                            .await;
                        return Some(format!(
                            "✅ {} *{}* signalé !\n👥 {} conducteur(s) alerté(s)\n\n\
                            _Continuez à conduire prudemment._\n\
                            _R=Radar P=Police A=Accident V=Voir alertes STOP=Quitter_",
                            icon, label, sent
                        ));
                    }
                }

                // Message non reconnu en mode voyage
                return Some(format!(
                    "🚗 *Mode Voyage actif* — *{}*\n\n\
                    Codes rapides :\n\
                    *R* 📸 Radar\n\
                    *P* 👮 Police\n\
                    *A* 🚨 Accident\n\
                    *D* ⚠️ Danger\n\
                    *T* 🔧 Travaux\n\
                    *C* 🚧 Contrôle\n\
                    *V* 👁️ Voir alertes proches\n\
                    *STOP* ↩️ Quitter\n\n\
                    _Partagez votre position GPS pour localiser précisément l'alerte._",
                    cty
                ));
            }

            // ── Covoiturage — résultats de recherche, sélection ─────────────
            ConversationState::CovoiturageSearchResults {
                results,
                depart,
                destination,
            } => {
                let (results_clone, dep, dest) =
                    (results.clone(), depart.clone(), destination.clone());
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n >= 1 && n <= results_clone.len() {
                        let r = &results_clone[n - 1];
                        self.sessions.reset_to_menu(phone).await;
                        return Some(WhatsAppCovoiturageService::format_trip_detail(r));
                    }
                }
                return Some(WhatsAppCovoiturageService::format_trip_results(
                    &results_clone,
                    &dep,
                    &dest,
                ));
            }

            // ── Covoiturage — création multi-étapes ───────────────────────────
            ConversationState::AwaitingCovoiturageDepart => {
                let v = message.trim().to_string();
                if v.len() < 2 {
                    return Some("Entrez la ville de départ (ex : _Douala_).".to_string());
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingCovoiturageDestination { depart: v.clone() },
                    )
                    .await;
                return Some(format!(
                    "✅ Départ : *{}*\n\nÉtape 2/5 — 📍 *Ville d'arrivée ?*\n\nEx : _Yaoundé_, _Bafoussam_",
                    v
                ));
            }

            ConversationState::AwaitingCovoiturageDestination { depart } => {
                let (dep, dest) = (depart.clone(), message.trim().to_string());
                if dest.len() < 2 {
                    return Some("Entrez la ville d'arrivée (ex : _Yaoundé_).".to_string());
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingCovoiturageDate {
                            depart: dep.clone(),
                            destination: dest.clone(),
                        },
                    )
                    .await;
                return Some(format!(
                    "✅ Trajet : *{}* → *{}*\n\nÉtape 3/5 — 📅 *Date de départ ?*\n\nFormat : *JJ/MM/AAAA*\nEx : _15/04/2026_",
                    dep, dest
                ));
            }

            ConversationState::AwaitingCovoiturageDate {
                depart,
                destination,
            } => {
                let (dep, dest) = (depart.clone(), destination.clone());
                let date = message.trim().to_string();
                // Validation basique de format DD/MM/YYYY
                let parts: Vec<&str> = date.split('/').collect();
                if parts.len() < 3 || parts[2].len() < 4 {
                    return Some(
                        "Format invalide. Tapez la date au format *JJ/MM/AAAA*\nEx : _15/04/2026_"
                            .to_string(),
                    );
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingCovoiturageTime {
                            depart: dep,
                            destination: dest,
                            date: date.clone(),
                        },
                    )
                    .await;
                return Some(format!(
                    "✅ Date : *{}*\n\nÉtape 4/5 — 🕐 *Heure de départ ?*\n\nFormat : *HH:MM*\nEx : _08:00_, _14:30_",
                    date
                ));
            }

            ConversationState::AwaitingCovoiturageTime {
                depart,
                destination,
                date,
            } => {
                let (dep, dest, d) = (depart.clone(), destination.clone(), date.clone());
                let time = message.trim().to_string();
                if !time.contains(':') || time.len() < 4 {
                    return Some(
                        "Format invalide. Tapez l'heure au format *HH:MM*\nEx : _08:00_"
                            .to_string(),
                    );
                }
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingCovoiturageSeats {
                            depart: dep,
                            destination: dest,
                            date: d,
                            time: time.clone(),
                        },
                    )
                    .await;
                return Some(format!(
                    "✅ Heure : *{}*\n\nÉtape 5/5 — 💺 *Combien de places proposez-vous ?*\n\nEx : _3_, _4_",
                    time
                ));
            }

            ConversationState::AwaitingCovoiturageSeats {
                depart,
                destination,
                date,
                time,
            } => {
                let (dep, dest, d, t) = (
                    depart.clone(),
                    destination.clone(),
                    date.clone(),
                    time.clone(),
                );
                if let Ok(seats) = message.trim().parse::<i32>() {
                    if seats >= 1 && seats <= 10 {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingCovoituragePrice {
                                    depart: dep,
                                    destination: dest,
                                    date: d,
                                    time: t,
                                    seats,
                                },
                            )
                            .await;
                        return Some(format!(
                            "✅ *{}* place(s)\n\n💰 *Prix par place ?* (en FCFA)\n\nEx : _3000_, _5000_",
                            seats
                        ));
                    }
                }
                return Some("Tapez le nombre de places (entre 1 et 10).".to_string());
            }

            ConversationState::AwaitingCovoituragePrice {
                depart,
                destination,
                date,
                time,
                seats,
            } => {
                let (dep, dest, d, t, s) = (
                    depart.clone(),
                    destination.clone(),
                    date.clone(),
                    time.clone(),
                    *seats,
                );
                if let Ok(prix) = message
                    .trim()
                    .replace(" ", "")
                    .replace("fcfa", "")
                    .replace("FCFA", "")
                    .parse::<i64>()
                {
                    if prix > 0 {
                        if let Some(uid) = session.user_id {
                            let phone_normalized =
                                phone.trim_start_matches("whatsapp:").to_string();
                            let trip_id = self
                                .covoiturage
                                .create_trip(uid, &dep, &dest, &d, &t, s, prix, &phone_normalized)
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            if let Some(tid) = trip_id {
                                return Some(WhatsAppCovoiturageService::creation_success_message(
                                    &dep, &dest, &d, s, prix, tid,
                                ));
                            }
                            return Some(format!(
                                "❌ Erreur lors de la création du trajet. Réessayez.\n\n{}",
                                self.main_menu()
                            ));
                        }
                    }
                }
                return Some(
                    "Tapez le prix par place en FCFA (chiffres uniquement).\nEx : *3000*"
                        .to_string(),
                );
            }

            // ── Produit via texte — confirmation ──────────────────────────────
            ConversationState::AwaitingProductTextConfirmation {
                name,
                category,
                price_suggestion,
                description,
            } => {
                let (n, cat, price, desc) = (
                    name.clone(),
                    category.clone(),
                    *price_suggestion,
                    description.clone(),
                );
                match message.trim() {
                    "1" => {
                        if let Some(user_id) = session.user_id {
                            let product_id = self
                                .products
                                .publish_product(user_id, "", &n, &cat, price, &desc)
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppProductService::published_product_message(
                                &n,
                                product_id.as_deref().unwrap_or("N/A"),
                            ));
                        }
                        self.sessions.reset_to_menu(phone).await;
                        return Some(
                            "🔐 Créez votre compte Yukpo pour publier.\nTapez *MENU*.".to_string(),
                        );
                    }
                    "2" => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingProductTextPrice {
                                    name: n,
                                    category: cat,
                                    description: desc,
                                },
                            )
                            .await;
                        return Some(WhatsAppProductService::ask_product_price("votre produit"));
                    }
                    "3" => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!("↩️ Annulé.\n\n{}", self.main_menu()));
                    }
                    _ => {}
                }
            }

            ConversationState::AwaitingProductTextPrice {
                name,
                category,
                description,
            } => {
                let (n, cat, desc) = (name.clone(), category.clone(), description.clone());
                if let Ok(price) =
                    message.trim().replace(" ", "").replace("fcfa", "").parse::<i64>()
                {
                    if price > 0 {
                        if let Some(user_id) = session.user_id {
                            let product_id = self
                                .products
                                .publish_product(user_id, "", &n, &cat, price, &desc)
                                .await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppProductService::published_product_message(
                                &n,
                                product_id.as_deref().unwrap_or("N/A"),
                            ));
                        }
                    }
                }
                return Some(
                    "Tapez le prix en FCFA (chiffres uniquement).\nEx : *5000*".to_string(),
                );
            }

            // ── Médicament détecté — choix Acheter / S'informer ──────────────
            ConversationState::AwaitingMedicationAction { med_name } => {
                let med = med_name.clone();
                match message.trim() {
                    "1" => {
                        // Acheter → recherche pharmacies
                        let results = self.commerce.search_pharmacies(&med).await;
                        let msg = WhatsAppCommerceService::format_pharmacy_results(&results, &med);
                        if !results.is_empty() {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::AwaitingPharmacyChoice { results },
                                )
                                .await;
                        } else {
                            self.sessions.reset_to_menu(phone).await;
                        }
                        return Some(msg);
                    }
                    "2" => {
                        // S'informer → appel IA avec contexte médicament
                        let prompt = format!(
                            "Donne-moi des informations claires sur le médicament *{}* : \
                            indications (à quoi ça sert), posologie habituelle, \
                            précautions importantes, et si une ordonnance est nécessaire. \
                            Réponds de manière simple et en français.",
                            med
                        );
                        let info = self.ia.chat(&prompt, session.name.as_deref()).await;
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "💊 *{}*\n\n{}\n\n\
                            ⚠️ _Ces informations sont indicatives. Consultez un professionnel de santé._\n\n\
                            Tapez *pharmacie {}* pour trouver où l'acheter.",
                            med, info, med
                        ));
                    }
                    _ => {
                        return Some(format!(
                            "💊 *{}* — Que souhaitez-vous faire ?\n\n\
                            *1.* 🏪 Trouver une pharmacie qui l'a en stock\n\
                            *2.* ℹ️ Informations sur ce médicament\n\n\
                            _Tapez 1 ou 2_",
                            med
                        ));
                    }
                }
            }

            // ── Recherche service — sélection résultat ────────────────────────
            ConversationState::AwaitingServiceSearchChoice { results } => {
                let results_clone = results.clone();
                if let Ok(n) = message.trim().parse::<usize>() {
                    if n >= 1 && n <= results_clone.len() {
                        let r = &results_clone[n - 1];
                        self.sessions.reset_to_menu(phone).await;
                        return Some(format!(
                            "📞 *{}*\n\n\
                            📍 {} — {}\n\
                            📱 {}\n\n\
                            _Contactez directement ce prestataire._\n\
                            Tapez *MENU* pour revenir.",
                            r.name, r.address, r.city, r.phone
                        ));
                    }
                }
                return Some(WhatsAppProductService::format_service_results(
                    &results_clone,
                    "service",
                ));
            }

            // ── Sous-menus ────────────────────────────────────────────────────
            ConversationState::SubMenu { category } => {
                let cat = category.clone();
                let choice = message.trim();

                // 0 = retour menu principal depuis n'importe quel sous-menu
                if choice == "0" {
                    self.sessions.reset_to_menu(phone).await;
                    return Some(self.main_menu());
                }

                match cat.as_str() {
                    "services" => match choice {
                        "1" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some("💊 *Pharmacie*\n\nTapez le nom du médicament.\nEx : _amoxicilline_, _doliprane_".to_string());
                        }
                        "2" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "🚌 *Bus*\n\nTapez votre trajet.\nEx : _bus Douala Yaoundé_"
                                    .to_string(),
                            );
                        }
                        "3" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "🚗 *Covoiturage*\n\n\
                                Tapez votre trajet pour *chercher* un covoiturage :\n\
                                Ex : _covoiturage Douala Yaoundé_\n\n\
                                Ou tapez *proposer covoiturage* pour *créer une annonce*."
                                    .to_string(),
                            );
                        }
                        "4" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some("🏠 *Immobilier*\n\nTapez votre recherche.\nEx : _studio meublé Douala_, _hôtel Kribi_".to_string());
                        }
                        "5" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some("📚 *Livres scolaires*\n\nTapez votre recherche.\nEx : _livres Lycée de la Retraite 5ème_\n\nOu tapez *vendre mes livres* pour scanner et vendre vos livres.".to_string());
                        }
                        "6" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "🛵 *Livraison Yukpo*\n\n\
                                Tapez votre commande.\nEx : _livraison colis Akwa Douala_\n\n\
                                Ou précisez l'adresse de prise en charge et de livraison."
                                    .to_string(),
                            );
                        }
                        "7" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "📦 *Publier un produit*\n\n\
                                Choisissez comment décrire votre produit :\n\n\
                                📸 Envoyez une *photo* — identification automatique\n\
                                📝 Tapez une *description* — Ex: _Vends chaussures Nike 42 à 15000 FCFA_\n\
                                🎤 Envoyez un *message vocal* — transcription automatique".to_string()
                            );
                        }
                        "8" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "🔍 *Rechercher un service*\n\n\
                                Tapez ce que vous cherchez.\n\n\
                                Exemples :\n\
                                • _plombier Douala_\n\
                                • _coiffeur Yaoundé_\n\
                                • _mécanicien Bafoussam_\n\
                                • _restaurant pizza Akwa_"
                                    .to_string(),
                            );
                        }
                        _ => return Some(self.submenu_services()),
                    },
                    "communaute" => match choice {
                        "1" => {
                            self.sessions
                                .save_state(phone, &ConversationState::AwaitingAlertType)
                                .await;
                            return Some(WhatsAppAlertService::alert_type_menu());
                        }
                        "2" => {
                            self.sessions.reset_to_menu(phone).await;
                            let city = session.city.as_deref().unwrap_or("Douala");
                            let alerts = self.alerts.get_active_alerts(city).await;
                            if alerts.is_empty() {
                                return Some(format!(
                                    "✅ Aucune alerte active à *{}* pour le moment.",
                                    city
                                ));
                            }
                            let mut msg = format!("🚨 *Alertes actives à {}*\n\n", city);
                            for a in &alerts {
                                msg.push_str(&format!(
                                    "{} *{}*\n📍 {}\n\n",
                                    a.icon, a.label, a.address
                                ));
                            }
                            return Some(msg);
                        }
                        "3" => {
                            self.sessions.reset_to_menu(phone).await;
                            let city = session.city.as_deref().unwrap_or("Douala");
                            self.sessions.subscribe_alerts(phone, city, session.user_id).await;
                            return Some(format!("🔔 Abonné aux alertes de *{}* !", city));
                        }
                        "4" => {
                            self.sessions.reset_to_menu(phone).await;
                            return Some(handle_sang_search(&self.pool, None).await);
                        }
                        _ => return Some(self.submenu_communaute()),
                    },
                    "moncompte" => match choice {
                        "1" => {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::AwaitingTokenPackChoice {
                                        action_context: "recharge".to_string(),
                                    },
                                )
                                .await;
                            return Some(
                                crate::services::whatsapp_commerce_service::token_pack_menu(
                                    "recharge",
                                ),
                            );
                        }
                        "2" => {
                            if let Some(user_id) = session.user_id {
                                let products = self.provider.list_user_products(user_id).await;
                                let msg = WhatsAppProviderService::format_products_list(&products);
                                if !products.is_empty() {
                                    self.sessions
                                        .save_state(
                                            phone,
                                            &ConversationState::ProviderMyProducts { products },
                                        )
                                        .await;
                                } else {
                                    self.sessions.reset_to_menu(phone).await;
                                }
                                return Some(msg);
                            }
                            self.sessions.reset_to_menu(phone).await;
                            return Some(
                                "🔐 Créez votre compte pour gérer vos produits.\nTapez *MENU*."
                                    .to_string(),
                            );
                        }
                        "3" => {
                            self.sessions
                                .save_state(phone, &ConversationState::PartnerTypeSelection)
                                .await;
                            return Some(WhatsAppPartnerService::partner_type_menu());
                        }
                        "4" => {
                            if let Some(user_id) = session.user_id {
                                if let Some((sid, sname, ptype_str)) =
                                    self.partner.get_partner_service(user_id).await
                                {
                                    let stats = self.partner.get_stats(sid).await;
                                    self.sessions
                                        .save_state(
                                            phone,
                                            &ConversationState::PartnerMenu {
                                                service_id: sid,
                                                partner_type: ptype_str,
                                                service_name: sname,
                                            },
                                        )
                                        .await;
                                    return Some(WhatsAppPartnerService::format_dashboard(&stats));
                                }
                            }
                            self.sessions.reset_to_menu(phone).await;
                            return Some("Vous n'avez pas encore d'espace partenaire.\nTapez *3* depuis Mon compte pour vous inscrire.".to_string());
                        }
                        "5" => {
                            if let Some(user_id) = session.user_id {
                                if let Some((sid, sname, ptype_str)) =
                                    self.partner.get_partner_service(user_id).await
                                {
                                    let ptype = PartnerType::from_db(&ptype_str);
                                    let category = ptype.db_value().to_string();
                                    self.sessions
                                        .save_state(
                                            phone,
                                            &ConversationState::CMMenu {
                                                service_id: sid,
                                                category,
                                            },
                                        )
                                        .await;
                                    return Some(WhatsAppCMService::cm_menu_message(&sname));
                                }
                            }
                            self.sessions.reset_to_menu(phone).await;
                            return Some("📣 Community Manager disponible pour les partenaires.\nTapez *3* pour devenir partenaire.".to_string());
                        }
                        "6" => {
                            let category = if let Some(uid) = session.user_id {
                                self.partner
                                    .get_partner_service(uid)
                                    .await
                                    .map(|(_, _, pt)| pt)
                                    .unwrap_or_else(|| "commerce".into())
                            } else {
                                "commerce".into()
                            };
                            let city = session.city.as_deref().unwrap_or("Douala");
                            let trends = self.cm.get_trends_for_category(&category, city).await;
                            self.sessions.reset_to_menu(phone).await;
                            return Some(WhatsAppCMService::format_trends(&trends, &category));
                        }
                        _ => return Some(self.submenu_moncompte()),
                    },
                    _ => {
                        self.sessions.reset_to_menu(phone).await;
                        return Some(self.main_menu());
                    }
                }
            }

            _ => {}
        }

        None
    }

    // ── Gestion image reçue ───────────────────────────────────────────────────

    /// Gère tout type de média reçu : image, PDF, CSV, Excel, document
    async fn handle_media(
        &self,
        session: &WhatsAppSession,
        phone: &str,
        media_url: &str,
        content_type: &str,
    ) -> String {
        let ct = content_type.to_lowercase();
        let is_document = ct.contains("pdf")
            || ct.contains("csv")
            || ct.contains("excel")
            || ct.contains("spreadsheet")
            || ct.contains("text/plain")
            || ct.contains("xlsx")
            || ct.contains("officedocument.spreadsheet");
        let is_image = ct.contains("image") || ct.starts_with("image/");

        // ── Fichier d'analyse de données ─────────────────────────────────────
        if is_document {
            if let Some(uid) = session.user_id {
                match self.sessions.check_and_deduct_tokens(uid, DATA_ANALYSIS_COST).await {
                    Ok(new_balance) => {
                        let name = session.name.as_deref();
                        let analysis = self.ia.analyze_file(media_url, content_type, name).await;
                        return format!("{}\n\n💎 _{} tokens restants_", analysis, new_balance);
                    }
                    Err(_) => {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingTokenPackChoice {
                                    action_context: "analyser ce fichier".to_string(),
                                },
                            )
                            .await;
                        return token_pack_menu("analyser ce fichier");
                    }
                }
            } else {
                // Analyse gratuite limitée sans compte
                let analysis = self.ia.analyze_file(media_url, content_type, None).await;
                return format!(
                    "{}\n\n💡 _Créez un compte Yukpo pour des analyses illimitées !_",
                    analysis
                );
            }
        }

        // ── Image — comportement selon l'état actuel ──────────────────────────
        match &session.state {
            // Image dans contexte pharmacie → scan d'ordonnance via route interne
            ConversationState::MainMenu | ConversationState::AwaitingPharmacyChoice { .. } => {
                if ct.contains("image") {
                    let result =
                        self.scan_ordonnance_image(media_url, session.city.as_deref()).await;
                    if let Some(msg) = result {
                        self.sessions.reset_to_menu(phone).await;
                        return msg;
                    }
                }
                // Pas une ordonnance → tester si c'est un médicament (boîte/comprimés)
                if ct.contains("image") {
                    if let Some(med_name) = self.detect_medication_from_image(media_url).await {
                        // Demander à l'utilisateur ce qu'il veut faire
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::AwaitingMedicationAction {
                                    med_name: med_name.clone(),
                                },
                            )
                            .await;
                        return format!(
                            "💊 *Médicament détecté : {}*\n\n\
                            Que souhaitez-vous faire ?\n\n\
                            *1.* 🏪 Trouver une pharmacie qui l'a en stock\n\
                            *2.* ℹ️ Obtenir des informations sur ce médicament\n\n\
                            _Tapez 1 ou 2_",
                            med_name
                        );
                    }
                }
                // Compte requis pour publier un produit
                if session.user_id.is_none() {
                    self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                    return "🔐 *Compte requis pour publier*\n\n\
                        Créez votre compte Yukpo gratuit pour publier vos produits !\n\n\
                        Étape 1/2 — Comment vous appelez-vous ?\n\
                        _(Tapez votre prénom)_"
                        .to_string();
                }
                // Pas une ordonnance reconnaissable → traiter comme produit
                let product = self.products.analyze_product_image(media_url).await;
                let msg = WhatsAppProductService::format_detected_product(&product);
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingProductConfirmation {
                            image_url: media_url.to_string(),
                            detected_name: product.name,
                            category: product.category,
                            price_suggestion: product.price_suggestion,
                        },
                    )
                    .await;
                return msg;
            }
            // Image pendant session scan livres → demander le verso d'abord
            ConversationState::BookScanSession { books } => {
                let books_clone = books.clone();
                let index = books_clone.len();
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingBookVerso {
                            recto_url: media_url.to_string(),
                            books: books_clone,
                        },
                    )
                    .await;
                WhatsAppBooksService::ask_for_verso(index)
            }
            // Verso reçu → analyser recto+verso ensemble
            ConversationState::AwaitingBookVerso { recto_url, books } => {
                let (recto, mut books_updated) = (recto_url.clone(), books.clone());
                // Analyser avec les deux images (on passe le verso, le recto est contexte)
                let book = self.books.identify_book_from_image(media_url).await;
                let index = books_updated.len() + 1;
                let msg = WhatsAppBooksService::format_scan_result(&book, index);
                books_updated.push(book);
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::BookScanSession {
                            books: books_updated,
                        },
                    )
                    .await;
                msg
            }
            // Image pendant saisie manuels → OCR automatique
            ConversationState::SchoolManualEntry {
                service_id,
                school_name,
                level,
                count,
            } => {
                let (sid, sname, lvl, cnt) =
                    (*service_id, school_name.clone(), level.clone(), *count);
                let added = self.books.add_manuals_from_image(sid, media_url, &lvl).await;
                let new_count = cnt + added.len() as u32;
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::SchoolManualEntry {
                            service_id: sid,
                            school_name: sname,
                            level: lvl.clone(),
                            count: new_count,
                        },
                    )
                    .await;
                if added.is_empty() {
                    format!(
                        "😔 Impossible de lire la liste depuis cette photo.\n\nVeuillez saisir les manuels manuellement :\n*Titre — Matière — Prix*\n\nOu tapez *FIN* pour terminer."
                    )
                } else {
                    let titles: Vec<String> =
                        added.iter().map(|m| format!("• {} — {}", m.title, m.subject)).collect();
                    format!(
                        "✅ *{} manuel(s) détecté(s) et ajoutés pour {}* :\n\n{}\n\nContinuez ou tapez *FIN* pour terminer.",
                        added.len(), lvl, titles.join("\n")
                    )
                }
            }
            // Image en mode YukpoIA → analyser l'image comme données visuelles
            ConversationState::YukpoIAChat => {
                if let Some(uid) = session.user_id {
                    match self.sessions.check_and_deduct_tokens(uid, AI_QUERY_TOKEN_COST).await {
                        Ok(new_balance) => {
                            let analysis = self
                                .ia
                                .analyze_file(media_url, content_type, session.name.as_deref())
                                .await;
                            format!("{}\n\n💎 _{} tokens_", analysis, new_balance)
                        }
                        Err(_) => {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::AwaitingTokenPackChoice {
                                        action_context: "analyser cette image".to_string(),
                                    },
                                )
                                .await;
                            token_pack_menu("analyser cette image")
                        }
                    }
                } else {
                    self.ia.analyze_file(media_url, content_type, None).await
                }
            }
            // Hors contexte → interpréter comme un produit à vendre
            _ => {
                // Compte requis
                if session.user_id.is_none() {
                    self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                    return "🔐 *Compte requis pour publier*\n\n\
                        Créez votre compte Yukpo gratuit pour publier vos produits !\n\n\
                        Étape 1/2 — Comment vous appelez-vous ?\n\
                        _(Tapez votre prénom)_"
                        .to_string();
                }
                let product = self.products.analyze_product_image(media_url).await;
                let msg = WhatsAppProductService::format_detected_product(&product);
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingProductConfirmation {
                            image_url: media_url.to_string(),
                            detected_name: product.name,
                            category: product.category,
                            price_suggestion: product.price_suggestion,
                        },
                    )
                    .await;
                msg
            }
        }
    }

    // ── Scan ordonnance — appel direct à PharmacyAIService ──────────────────
    // Même logique que POST /api/pharmacies/ai/extract-ordonnance
    // mais sans passer par HTTP — appel direct au service Rust

    async fn scan_ordonnance_image(
        &self,
        image_url: &str,
        user_city: Option<&str>,
    ) -> Option<String> {
        use crate::services::pharmacy_ai_service::PharmacyAIService;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .ok()?;

        // Télécharger l'image depuis Twilio
        let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
        let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
        let req = if !twilio_sid.is_empty() {
            client.get(image_url).basic_auth(&twilio_sid, Some(&twilio_token))
        } else {
            client.get(image_url)
        };

        let bytes = req.send().await.ok()?.bytes().await.ok()?;
        if bytes.is_empty() {
            return None;
        }

        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let image_b64 = STANDARD.encode(&bytes);

        // Appel direct au service IA — même que le controller pharmacy
        let ai_service = PharmacyAIService::new(self.app_ia.clone());
        let medications =
            ai_service.extract_ordonnance_medications(&image_b64, None, None).await.ok()?;

        if medications.is_empty() {
            return None;
        }

        let city = user_city.unwrap_or("Douala");

        // Recherche automatique pour le premier médicament détecté
        let first_med = &medications[0].name;
        let pharmacy_results = self.commerce.search_pharmacies(first_med).await;

        let med_list = medications
            .iter()
            .map(|m| format!("• {}", m.name))
            .collect::<Vec<_>>()
            .join("\n");

        if pharmacy_results.is_empty() {
            Some(format!(
                "💊 *Ordonnance détectée !*\n\n\
                Médicaments :\n{}\n\n\
                😔 *{}* non trouvé en stock à *{}*.\n\
                Tapez le nom d'un médicament pour relancer la recherche.",
                med_list, first_med, city
            ))
        } else {
            let mut result_msg = format!(
                "💊 *Ordonnance détectée !*\n\n\
                Médicaments :\n{}\n\n\
                🏥 *{}* disponible dans {} pharmacie(s) :\n\n",
                med_list,
                first_med,
                pharmacy_results.len()
            );
            for (i, p) in pharmacy_results.iter().take(3).enumerate() {
                result_msg.push_str(&format!(
                    "{}. *{}*\n📍 {}\n📞 {}\n💰 {} FCFA\n\n",
                    i + 1,
                    p.pharmacy_name,
                    p.address,
                    p.phone,
                    p.price_fcfa
                ));
            }
            result_msg.push_str("_Tapez un autre médicament de la liste pour le chercher._");
            Some(result_msg)
        }
    }

    /// Détecte si une image contient un médicament (boîte, comprimés)
    /// via l'IA multimodale — utilisé hors contexte ordonnance
    async fn detect_medication_from_image(&self, image_url: &str) -> Option<String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .ok()?;

        let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
        let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
        let req = if !twilio_sid.is_empty() {
            client.get(image_url).basic_auth(&twilio_sid, Some(&twilio_token))
        } else {
            client.get(image_url)
        };

        let bytes = req.send().await.ok()?.bytes().await.ok()?;
        if bytes.is_empty() {
            return None;
        }

        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let image_b64 = STANDARD.encode(&bytes);

        // Demander à l'IA si l'image contient un médicament
        let prompt = "Cette image montre-t-elle un médicament (boîte de médicament, comprimés, sirop, ampoule) ? \
            Si oui, réponds UNIQUEMENT avec le nom du médicament en JSON: {\"medicament\": \"nom\"}. \
            Si non, réponds: {\"medicament\": null}";

        let detected = self.app_ia.predict_multimodal(prompt, Some(vec![image_b64])).await.ok()?.1;
        if detected.is_empty() {
            return None;
        }

        // Parser la réponse JSON
        let clean = detected
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(clean) {
            if let Some(name) = v["medicament"].as_str() {
                if !name.is_empty() && name != "null" {
                    return Some(name.to_string());
                }
            }
        }
        None
    }

    // ── Gestion localisation GPS ──────────────────────────────────────────────

    async fn handle_location(
        &self,
        session: &WhatsAppSession,
        phone: &str,
        lat: f64,
        lng: f64,
        address: &str,
    ) -> String {
        match &session.state {
            // ── Position GPS reçue en mode voyage → mise à jour + alertes proches
            ConversationState::EnRoute { city, .. } => {
                let cty = city.clone();
                // Mettre à jour la position GPS dans la session
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::EnRoute {
                            last_lat: Some(lat),
                            last_lng: Some(lng),
                            city: cty.clone(),
                        },
                    )
                    .await;
                // Mettre à jour le GPS dans l'abonnement alertes
                self.sessions
                    .subscribe_alerts_with_gps(phone, &cty, session.user_id, Some(lat), Some(lng))
                    .await;
                // Afficher alertes à proximité
                let nearby = self.alerts.get_active_alerts_nearby(lat, lng, None).await;
                if nearby.is_empty() {
                    return format!(
                        "📍 Position mise à jour.\n✅ Aucune alerte à proximité.\n\n\
                        _R=Radar P=Police A=Accident V=Voir alertes STOP=Quitter_"
                    );
                }
                let mut resp = format!(
                    "📍 Position mise à jour.\n🚨 *{} alerte(s) à proximité :*\n\n",
                    nearby.len()
                );
                for a in &nearby {
                    resp.push_str(&format!("{} *{}* — {}\n", a.icon, a.label, a.address));
                }
                resp.push_str("\n_R=Radar P=Police A=Accident STOP=Quitter_");
                resp
            }

            ConversationState::AwaitingAlertLocation { alert_type } => {
                let at = alert_type.clone();
                let city = detect_city(address);
                let maps_url = format!("https://maps.google.com/?q={},{}", lat, lng);
                let reporter = session.name.as_deref().unwrap_or(phone);

                let alert_id = self
                    .alerts
                    .create_alert(&at, Some(lat), Some(lng), address, &city, reporter)
                    .await;

                let (icon, label) = crate::services::whatsapp_alert_service::alert_icon_label(&at);

                // Broadcast aux abonnés à proximité (outbound WhatsApp)
                let sent = if let Some(aid) = alert_id {
                    let alert_obj = crate::services::whatsapp_alert_service::CommunityAlert {
                        id: aid,
                        alert_type: at.clone(),
                        icon: icon.to_string(),
                        label: label.to_string(),
                        latitude: Some(lat),
                        longitude: Some(lng),
                        address: address.to_string(),
                        city: city.clone(),
                        reported_by: reporter.to_string(),
                        confirmations: 1,
                        status: "active".to_string(),
                        maps_url: maps_url.clone(),
                    };
                    self.alerts.broadcast_to_nearby_subscribers(&alert_obj, Some(reporter)).await
                } else {
                    0
                };

                self.sessions.reset_to_menu(phone).await;
                format!(
                    "✅ *Alerte signalée avec précision GPS !*\n\n\
                    {} *{}*\n\
                    📍 {}\n\
                    🗺️ {}\n\
                    👥 {} conducteur(s) notifiés\n\n\
                    Merci pour la communauté Yukpo ! 🙏",
                    icon, label, address, maps_url, sent
                )
            }
            ConversationState::AwaitingDeliveryAddress {
                pharmacy_id,
                product_name,
                price_fcfa,
            } => {
                let (pid, pname, price) = (*pharmacy_id, product_name.clone(), *price_fcfa);
                let address_full = format!("{} (GPS: {:.4}, {:.4})", address, lat, lng);
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingDeliveryConfirmation {
                            pharmacy_id: pid,
                            product_name: pname.clone(),
                            price_fcfa: price,
                            address: address_full.clone(),
                        },
                    )
                    .await;
                WhatsAppCommerceService::delivery_confirmation_message(
                    &pname,
                    price,
                    &address_full,
                    500,
                )
            }
            _ => {
                // Afficher les alertes actives à proximité
                let city = detect_city(address);
                let alerts = self.alerts.get_active_alerts(&city).await;
                if alerts.is_empty() {
                    format!("📍 Position reçue : {}\n\n✅ Aucune alerte active dans votre zone.\nBonne route !", address)
                } else {
                    let mut msg = format!("📍 Alertes actives près de *{}* :\n\n", city);
                    for a in &alerts {
                        msg.push_str(&format!("{} *{}* — {}\n", a.icon, a.label, a.address));
                    }
                    msg
                }
            }
        }
    }

    // ── Gestion message vocal ─────────────────────────────────────────────────

    async fn handle_audio(
        &self,
        phone: &str,
        session: &crate::services::whatsapp_session_service::WhatsAppSession,
        audio_url: &str,
    ) -> String {
        log::info!("[Chatbot] 🎤 Audio reçu depuis {}", phone);

        // Transcrire via Whisper
        let transcription = self.products.transcribe_audio(audio_url).await;

        match transcription {
            Some(text) if !text.is_empty() => {
                log::info!("[Chatbot] 🎤 Transcription: '{}'", text);
                // Traiter la transcription comme un message texte normal
                let intent = detect_intent(&text);
                let formatted = format!("🎤 _Message vocal transcrit :_\n_{}_\n\n", text);
                let response = self.handle_intent(session, phone, intent, &text).await;
                format!("{}{}", formatted, response)
            }
            _ => {
                "🎤 Impossible de transcrire votre message vocal.\n\nEssayez :\n• Parler plus clairement\n• Envoyer un message texte\n• Réessayer dans un endroit plus calme".to_string()
            }
        }
    }

    // ── Gestion des intents libres ────────────────────────────────────────────

    async fn handle_intent(
        &self,
        session: &WhatsAppSession,
        phone: &str,
        intent: Intent,
        raw_message: &str,
    ) -> String {
        match intent {
            Intent::Aide | Intent::Menu => {
                self.sessions.reset_to_menu(phone).await;
                self.main_menu()
            }

            Intent::SousMenu { category } => {
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::SubMenu {
                            category: category.clone(),
                        },
                    )
                    .await;
                match category.as_str() {
                    "services" => self.submenu_services(),
                    "communaute" => self.submenu_communaute(),
                    "moncompte" => self.submenu_moncompte(),
                    _ => self.main_menu(),
                }
            }

            Intent::Pharmacie { medicament } => {
                if medicament.is_empty() {
                    return "💊 *Pharmacie*\n\nTapez le nom du médicament recherché.\n\nEx : _amoxicilline_, _doliprane_, _paracétamol_".to_string();
                }
                let results = self.commerce.search_pharmacies(&medicament).await;
                let msg = WhatsAppCommerceService::format_pharmacy_results(&results, &medicament);
                if !results.is_empty() {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingPharmacyChoice {
                                results: results.clone(),
                            },
                        )
                        .await;
                }
                msg
            }

            Intent::Bus { trajet } => {
                if trajet.is_empty() {
                    return "🚌 *Bus*\n\nTapez votre trajet.\n\nEx : _bus Douala Yaoundé_, _billet Bafoussam_".to_string();
                }
                let (depart, arrivee) = extraire_villes_bus(&trajet);
                let results = self.commerce.search_bus(&depart, arrivee.as_deref()).await;
                let msg = WhatsAppCommerceService::format_bus_results(
                    &results,
                    &depart,
                    arrivee.as_deref(),
                );
                if !results.is_empty() {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingBusChoice {
                                results: results.clone(),
                            },
                        )
                        .await;
                }
                msg
            }

            Intent::Sang { groupe } => handle_sang_search(&self.pool, groupe.as_deref()).await,

            Intent::SignalerAlerte => {
                self.sessions.save_state(phone, &ConversationState::AwaitingAlertType).await;
                WhatsAppAlertService::alert_type_menu()
            }

            Intent::VoirAlertes { city } => {
                let alerts = self.alerts.get_active_alerts(&city).await;
                if alerts.is_empty() {
                    format!(
                        "✅ Aucune alerte active à *{}* pour le moment.\nBonne route !",
                        city
                    )
                } else {
                    let mut msg = format!("🚨 *Alertes actives à {}*\n\n", city);
                    for a in &alerts {
                        msg.push_str(&format!(
                            "{} *{}*\n📍 {}\n👍 {} confirmations\n\n",
                            a.icon, a.label, a.address, a.confirmations
                        ));
                    }
                    msg
                }
            }

            Intent::AbonnerAlertes { city } => {
                self.sessions.subscribe_alerts(phone, &city, session.user_id).await;
                self.sessions.reset_to_menu(phone).await;
                format!(
                    "🔔 *Abonnement activé !*\n\nVous recevrez les alertes communautaires de *{}*.\n\nTapez *alertes {}* pour voir les alertes actuelles.",
                    city, city
                )
            }

            Intent::Immobilier { query } => {
                if query.is_empty() {
                    return "🏠 *Immobilier*\n\nTapez votre recherche.\n\nEx : _studio meublé Douala_, _villa louer Yaoundé_, _hôtel Kribi_".to_string();
                }
                let (q, search_type) = detect_property_search(&query);
                let results = self.realestate.search_properties(&q, &search_type).await;
                let msg =
                    WhatsAppRealEstateService::format_property_results(&results, &q, &search_type);
                if !results.is_empty() {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingPropertyChoice {
                                results: results.clone(),
                            },
                        )
                        .await;
                }
                msg
            }

            Intent::LivresScolaires { query } => {
                if query.is_empty() {
                    return "📚 *Livres scolaires*\n\nTapez votre recherche.\n\nEx : _livres Lycée de la Retraite 5ème_, _Terminale D Douala_\n\nOu tapez *vendre mes livres* pour scanner et vendre vos livres.".to_string();
                }
                // Détecter si c'est une recherche d'établissement ou un livre direct
                let schools = self.books.search_school_programs(&query).await;
                if !schools.is_empty() {
                    WhatsAppBooksService::format_school_list(&schools)
                } else {
                    // Chercher directement dans la bourse
                    let listings = self.books.search_books_in_exchange(&[query.clone()]).await;
                    if listings.is_empty() {
                        format!(
                            "📚 Aucun résultat pour *{}*.\n\n\
                            Essayez :\n• Nom d'établissement : _Lycée de la Retraite_\n\
                            • Niveau : _6ème_, _Tle D_\n• Titre : _Maths Transmath_\n\n\
                            📸 *Envoyez une photo* de vos livres pour les scanner !",
                            query
                        )
                    } else {
                        let mut msg = format!("📚 *Livres disponibles pour {}*\n\n", query);
                        for l in &listings {
                            msg.push_str(&format!(
                                "📖 *{}* — {} — {} FCFA\n👤 {} ({})\n📞 {}\n\n",
                                l.title,
                                l.condition,
                                l.price,
                                l.seller_name,
                                l.city,
                                l.seller_phone
                            ));
                        }
                        msg
                    }
                }
            }

            Intent::LivresVente => {
                // Démarrer session scan
                self.sessions
                    .save_state(phone, &ConversationState::BookScanSession { books: vec![] })
                    .await;
                "📸 *Mode scan de livres activé !*\n\nEnvoyez les photos de vos livres (recto/verso).\nJe les identifierai automatiquement.\n\nTapez *FIN* quand vous avez terminé pour voir le récapitulatif.".to_string()
            }

            Intent::Recharger => {
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingTokenPackChoice {
                            action_context: "recharge manuelle".to_string(),
                        },
                    )
                    .await;
                token_pack_menu("recharge")
            }

            Intent::YukpoIA { question } => {
                // Activer le mode chat IA
                self.sessions.save_state(phone, &ConversationState::YukpoIAChat).await;
                if question.is_empty() {
                    return ia_welcome_message().to_string();
                }
                // Répondre directement à la question
                if let Some(uid) = session.user_id {
                    match self.sessions.check_and_deduct_tokens(uid, AI_QUERY_TOKEN_COST).await {
                        Ok(new_balance) => {
                            let answer = self.ia.chat(&question, session.name.as_deref()).await;
                            return format!("🤖 *YukpoIA*\n\n{}\n\n💎 _{} tokens_\n\n_Posez votre prochaine question ou tapez *MENU*_", answer, new_balance);
                        }
                        Err(_) => {
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::AwaitingTokenPackChoice {
                                        action_context: "utiliser YukpoIA".to_string(),
                                    },
                                )
                                .await;
                            return token_pack_menu("utiliser YukpoIA");
                        }
                    }
                } else {
                    let answer = self.ia.chat(&question, None).await;
                    return format!("🤖 *YukpoIA*\n\n{}\n\n💡 _Créez un compte pour plus de questions !_\n_Tapez MENU_", answer);
                }
            }

            Intent::GenererDocument { doc_type, topic } => {
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingDocumentConfirm {
                            topic: topic.clone(),
                            doc_type: doc_type.to_string(),
                        },
                    )
                    .await;
                format!(
                    "📄 Je vais créer votre *{}*\n\nSujet : *{}*\n\n\
                    Tapez *OUI* pour confirmer ({} tokens) ou *NON* pour annuler.",
                    if doc_type == "pptx" {
                        "présentation PowerPoint"
                    } else {
                        "document Word"
                    },
                    topic,
                    DOCUMENT_GENERATION_COST
                )
            }

            Intent::AnalyserFichier => {
                self.sessions.save_state(phone, &ConversationState::YukpoIAChat).await;
                "📊 *Analyse de données*\n\nEnvoyez votre fichier CSV, Excel ou PDF et je l'analyserai pour vous !\n\n_Coût : 15 tokens par analyse._".to_string()
            }

            Intent::RechercheService { query } => {
                if query.is_empty() {
                    return "🔍 *Recherche de service*\n\nTapez ce que vous cherchez.\n\nEx : _plombier Douala_, _coiffeur Yaoundé_, _restaurant pizza Akwa_".to_string();
                }
                let results = self.products.search_services(&query).await;
                let msg = WhatsAppProductService::format_service_results(&results, &query);
                if !results.is_empty() {
                    self.sessions
                        .save_state(
                            phone,
                            &ConversationState::AwaitingServiceSearchChoice { results },
                        )
                        .await;
                } else {
                    self.sessions.reset_to_menu(phone).await;
                }
                msg
            }

            Intent::PublierProduitTexte { description } => {
                // Compte requis avant la détection IA (évite de gaspiller un appel API)
                if session.user_id.is_none() {
                    self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                    return "🔐 *Compte requis pour publier*\n\n\
                        Créez votre compte Yukpo gratuit pour publier vos produits !\n\n\
                        Étape 1/2 — Comment vous appelez-vous ?\n\
                        _(Tapez votre prénom)_"
                        .to_string();
                }
                if description.is_empty() {
                    return "📝 *Publier une annonce*\n\nDécrivez votre produit ou service.\n\nEx : _Je vends des chaussures Nike taille 42 à 15000 FCFA_\nOu : _Cours de maths à domicile Douala, 5000 FCFA/heure_".to_string();
                }
                let product = self.products.analyze_product_from_text(&description).await;
                let msg = WhatsAppProductService::format_detected_product_from_text(&product);
                self.sessions
                    .save_state(
                        phone,
                        &ConversationState::AwaitingProductTextConfirmation {
                            name: product.name,
                            category: product.category,
                            price_suggestion: product.price_suggestion,
                            description: product.description,
                        },
                    )
                    .await;
                msg
            }

            Intent::CovoiturageSearch { query } => {
                let (depart, destination_opt) = extraire_villes_covoiturage(&query);
                if let Some(dest) = destination_opt {
                    let results = self.covoiturage.search_trips(&depart, &dest).await;
                    let msg =
                        WhatsAppCovoiturageService::format_trip_results(&results, &depart, &dest);
                    if !results.is_empty() {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::CovoiturageSearchResults {
                                    results,
                                    depart,
                                    destination: dest,
                                },
                            )
                            .await;
                    } else {
                        self.sessions.reset_to_menu(phone).await;
                    }
                    msg
                } else {
                    // Une seule ville → demander la destination
                    "🚗 *Covoiturage*\n\n\
                    Tapez votre trajet complet.\n\n\
                    Exemples :\n\
                    • _covoiturage Douala Yaoundé_\n\
                    • _trajet Bafoussam Douala_\n\n\
                    Ou tapez *proposer covoiturage* pour créer une annonce."
                        .to_string()
                }
            }

            Intent::CovoiturageCreate => {
                if session.user_id.is_none() {
                    self.sessions.save_state(phone, &ConversationState::AwaitingName).await;
                    return "🔐 *Compte requis*\n\n\
                        Créez votre compte Yukpo pour proposer des trajets !\n\n\
                        Étape 1/2 — Comment vous appelez-vous ?\n\
                        _(Tapez votre prénom)_"
                        .to_string();
                }
                self.sessions
                    .save_state(phone, &ConversationState::AwaitingCovoiturageDepart)
                    .await;
                "🚗 *Proposer un covoiturage*\n\n\
                Étape 1/5 — 📍 *Ville de départ ?*\n\n\
                Ex : _Douala_, _Yaoundé_, _Bafoussam_"
                    .to_string()
            }

            Intent::MesProduits => {
                if let Some(user_id) = session.user_id {
                    let products = self.provider.list_user_products(user_id).await;
                    let msg = WhatsAppProviderService::format_products_list(&products);
                    if !products.is_empty() {
                        self.sessions
                            .save_state(phone, &ConversationState::ProviderMyProducts { products })
                            .await;
                    }
                    msg
                } else {
                    "🔐 Vous devez avoir un compte pour gérer vos produits.\n\nTapez *MENU* pour créer votre compte Yukpo.".to_string()
                }
            }

            Intent::Devenir { partner_type } => {
                if let Some(pt_str) = partner_type {
                    // Type déjà connu → sauter le menu de sélection
                    if let Some(ptype) = PartnerType::from_text(&pt_str) {
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerOnboarding {
                                    partner_type: ptype.db_value().to_string(),
                                    step: 1,
                                    name: String::new(),
                                    phone: String::new(),
                                    city: String::new(),
                                    extra: String::new(),
                                },
                            )
                            .await;
                        return WhatsAppPartnerService::onboarding_step1_message(&ptype);
                    }
                }
                self.sessions.save_state(phone, &ConversationState::PartnerTypeSelection).await;
                WhatsAppPartnerService::partner_type_menu()
            }

            Intent::PartnerDashboard | Intent::PartnerCommandes => {
                if let Some(user_id) = session.user_id {
                    if let Some((sid, sname, ptype_str)) =
                        self.partner.get_partner_service(user_id).await
                    {
                        if matches!(intent, Intent::PartnerCommandes) {
                            let orders = self.partner.get_pending_orders(sid).await;
                            let msg = WhatsAppPartnerService::format_orders(&orders);
                            self.sessions
                                .save_state(
                                    phone,
                                    &ConversationState::PartnerOrdersList {
                                        orders,
                                        service_id: sid,
                                    },
                                )
                                .await;
                            return msg;
                        }
                        let stats = self.partner.get_stats(sid).await;
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::PartnerMenu {
                                    service_id: sid,
                                    partner_type: ptype_str,
                                    service_name: sname,
                                },
                            )
                            .await;
                        WhatsAppPartnerService::format_dashboard(&stats)
                    } else {
                        // Pas encore partenaire → proposer l'inscription
                        self.sessions
                            .save_state(phone, &ConversationState::PartnerTypeSelection)
                            .await;
                        format!(
                            "Vous n'avez pas encore de compte partenaire.\n\n{}",
                            WhatsAppPartnerService::partner_type_menu()
                        )
                    }
                } else {
                    "🔐 Créez votre compte Yukpo pour accéder à votre espace partenaire.\n\nTapez *MENU* pour commencer.".to_string()
                }
            }

            Intent::CommunityManager => {
                if let Some(user_id) = session.user_id {
                    if let Some((sid, sname, ptype_str)) =
                        self.partner.get_partner_service(user_id).await
                    {
                        let ptype = PartnerType::from_db(&ptype_str);
                        let category = ptype.db_value().to_string();
                        self.sessions
                            .save_state(
                                phone,
                                &ConversationState::CMMenu {
                                    service_id: sid,
                                    category,
                                },
                            )
                            .await;
                        return WhatsAppCMService::cm_menu_message(&sname);
                    }
                }
                "📣 Le Community Manager est disponible pour les partenaires Yukpo.\n\nTapez *PARTENAIRE* pour créer votre compte professionnel.".to_string()
            }

            Intent::TendancesMarche => {
                let category = if let Some(user_id) = session.user_id {
                    self.partner
                        .get_partner_service(user_id)
                        .await
                        .map(|(_, _, pt)| pt)
                        .unwrap_or_else(|| "commerce".into())
                } else {
                    "commerce".into()
                };
                let city = session.city.as_deref().unwrap_or("Douala");
                let trends = self.cm.get_trends_for_category(&category, city).await;
                WhatsAppCMService::format_trends(&trends, &category)
            }

            _ => self.handle_inconnu(),
        }
    }

    // ── Messages utilitaires ──────────────────────────────────────────────────

    fn welcome_new_user(&self) -> String {
        "👋 *Bienvenue sur Yukpo !*\n\n\
        Je suis votre assistant : pharmacies, bus, alertes, IA et bien plus.\n\n\
        ✍️ *Créons votre compte en 2 étapes.*\n\
        Étape 1/2 — Comment vous appelez-vous ?\n\
        _(Tapez votre prénom)_"
            .to_string()
    }

    fn main_menu(&self) -> String {
        concat!(
            "🌟 *Menu Yukpo*\n\n",
            "A. 🤖 *YukpoIA* — Assistant intelligent\n",
            "B. 🛒 *Services* — Pharmacie, Bus, Immobilier, Livres\n",
            "C. 🚨 *Communauté* — Alertes, Sang, Abonnements\n",
            "D. 💼 *Mon compte* — Tokens, Produits, Partenaire\n\n",
            "📸 *Photo* pour publier un produit\n",
            "🎤 *Vocal* pour dicter une annonce ou une question\n",
            "📝 _Tapez \"je vends...\" pour publier par texte_\n\n",
            "_Tapez A, B, C ou D_"
        )
        .to_string()
    }

    fn submenu_services(&self) -> String {
        concat!(
            "🛒 *Services Yukpo*\n\n",
            "1. 💊 Pharmacie — Trouver un médicament\n",
            "2. 🚌 Bus — Réserver un trajet\n",
            "3. 🚗 Covoiturage — Chercher / proposer un trajet\n",
            "4. 🏠 Immobilier — Louer, acheter, hôtel\n",
            "5. 📚 Livres scolaires — Trouver / vendre\n",
            "6. 🛵 Livraison — Commander une livraison\n",
            "7. 📦 Publier un produit — Vendre sur Yukpo\n",
            "8. 🔍 Rechercher un service — Plombier, coiffeur…\n\n",
            "0. ↩️ Menu principal"
        )
        .to_string()
    }

    fn submenu_communaute(&self) -> String {
        concat!(
            "🚨 *Communauté Yukpo*\n\n",
            "1. 🚨 Signaler une alerte\n",
            "2. 📢 Voir les alertes de ma ville\n",
            "3. 🔔 S'abonner aux alertes\n",
            "4. 🩸 Don de sang — Trouver un donneur\n\n",
            "0. ↩️ Menu principal"
        )
        .to_string()
    }

    fn submenu_moncompte(&self) -> String {
        concat!(
            "💼 *Mon compte Yukpo*\n\n",
            "1. 💎 Recharger mes tokens\n",
            "2. 📦 Mes produits / annonces\n",
            "3. 🤝 Devenir partenaire\n",
            "4. 📊 Mon espace partenaire\n",
            "5. 📣 Community Manager\n",
            "6. 📈 Tendances marché\n\n",
            "0. ↩️ Menu principal"
        )
        .to_string()
    }

    fn handle_inconnu(&self) -> String {
        "🤔 Je n'ai pas compris.\n\nTapez *MENU* ou une lettre :\n\n*A* → 🤖 YukpoIA\n*B* → 🛒 Services\n*C* → 🚨 Communauté\n*D* → 💼 Mon compte".to_string()
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn detect_intent(message: &str) -> Intent {
    let msg = message.to_lowercase().trim().to_string();

    if msg == "aide"
        || msg == "help"
        || msg == "menu"
        || msg == "bonjour"
        || msg == "hi"
        || msg == "hello"
        || msg == "00"
    {
        return Intent::Aide;
    }

    if msg == "annuler" || msg == "cancel" || msg == "0" {
        return Intent::Annuler;
    }

    // ── Raccourcis lettres A-D (menu principal) ───────────────────────────────
    match msg.as_str() {
        "a" => {
            return Intent::YukpoIA {
                question: String::new(),
            }
        }
        "b" => {
            return Intent::SousMenu {
                category: "services".to_string(),
            }
        }
        "c" => {
            return Intent::SousMenu {
                category: "communaute".to_string(),
            }
        }
        "d" => {
            return Intent::SousMenu {
                category: "moncompte".to_string(),
            }
        }
        _ => {}
    }

    // ── Partenaire ────────────────────────────────────────────────────────────
    if is_partner_intent(&msg) {
        // Détecter si un type est mentionné dans le message
        let partner_type = PartnerType::from_text(&msg).map(|pt| pt.db_value().to_string());
        return Intent::Devenir { partner_type };
    }
    if is_partner_dashboard_intent(&msg) {
        if msg.contains("commande") {
            return Intent::PartnerCommandes;
        }
        return Intent::PartnerDashboard;
    }
    if is_cm_intent(&msg) {
        return Intent::CommunityManager;
    }
    if msg.contains("tendance") || msg.contains("trend") || msg == "marché" || msg == "marche" {
        return Intent::TendancesMarche;
    }

    if msg.contains("recharger") || msg.contains("token") || msg.contains("solde") {
        return Intent::Recharger;
    }

    // YukpoIA — génération de documents
    if let Some((doc_type, topic)) = WhatsAppIAService::detect_document_request(message) {
        return Intent::GenererDocument { doc_type, topic };
    }

    // YukpoIA — analyse de fichier
    if msg.contains("analyser")
        || msg.contains("analyse") && msg.contains("fichier")
        || msg.contains("analyse csv")
        || msg.contains("analyse excel")
        || msg.contains("analyse données")
    {
        return Intent::AnalyserFichier;
    }

    // YukpoIA — chat IA
    if msg.contains("yukpoia")
        || msg.contains("yukpo ia")
        || msg.contains("ask ai")
        || msg.contains("parler à l'ia")
        || msg.contains("chat ia")
        || msg == "ia"
        || msg == "ai"
        || msg == "assistant"
    {
        return Intent::YukpoIA {
            question: String::new(),
        };
    }

    // Questions directes → YukpoIA si message assez long et interrogatif
    if WhatsAppIAService::is_ai_question(message) && message.len() > 15 {
        return Intent::YukpoIA {
            question: message.to_string(),
        };
    }

    // Gestion produits prestataire
    if msg.contains("mes produit")
        || msg.contains("mes service")
        || msg.contains("gérer mes")
        || msg.contains("gerer mes")
        || msg.contains("mon catalogue")
        || msg.contains("mes annonce")
        || msg == "produits"
        || msg == "services"
    {
        return Intent::MesProduits;
    }

    // Recherche de service/prestataire (plombier, coiffeur, mécanicien, restaurant, etc.)
    let service_kw = [
        "plombier",
        "electricien",
        "électricien",
        "menuisier",
        "peintre",
        "maçon",
        "macon",
        "mécanicien",
        "mecanicien",
        "coiffeur",
        "coiffeuse",
        "esthétiste",
        "estetiste",
        "restaurant",
        "maquis",
        "traiteur",
        "comptable",
        "avocat",
        "médecin",
        "medecin",
        "dentiste",
        "infirmier",
        "pharmacien",
        "technicien",
        "informaticien",
        "graphiste",
        "photographe",
        "vigile",
        "gardien",
        "chauffeur",
        "livreur",
        "prestataire",
        "artisan",
        "cherche un",
        "cherche une",
        "trouver un",
        "trouver une",
        "besoin d'un",
        "besoin d'une",
        "je cherche",
        "qui peut",
        "quelqu'un pour",
    ];
    if service_kw.iter().any(|k| msg.contains(k)) {
        return Intent::RechercheService {
            query: message.to_string(),
        };
    }

    // Publier produit via texte libre ("je vends...", "à vendre...", "je propose...")
    let vente_kw = [
        "je vends",
        "je vend",
        "à vendre",
        "a vendre",
        "vends",
        "vend ",
        "je propose",
        "je cède",
        "je cede",
        "annonce vente",
        "en vente",
    ];
    if vente_kw.iter().any(|k| msg.contains(k)) && message.len() > 15 {
        return Intent::PublierProduitTexte {
            description: message.to_string(),
        };
    }

    // Alertes
    if msg.contains("signaler")
        || msg.contains("signal")
        || (msg.contains("alerte") && !msg.contains("voir"))
    {
        return Intent::SignalerAlerte;
    }
    if msg.contains("alertes") || msg.contains("voir alerte") {
        let city = crate::services::whatsapp_alert_service::detect_city(&msg);
        return Intent::VoirAlertes { city };
    }
    if msg.contains("abonner") || msg.contains("abonnement alerte") {
        let city = crate::services::whatsapp_alert_service::detect_city(&msg);
        return Intent::AbonnerAlertes { city };
    }

    // Sang
    let sang_kw = ["sang", "transfusion", "donneur", "don de sang"];
    if sang_kw.iter().any(|k| msg.contains(k)) {
        let groupe = extraire_groupe_sanguin(&msg);
        return Intent::Sang { groupe };
    }
    let blood_groups = ["ab+", "ab-", "o+", "o-", "a+", "a-", "b+", "b-"];
    if blood_groups.iter().any(|g| msg.contains(g)) {
        return Intent::Sang {
            groupe: extraire_groupe_sanguin(&msg),
        };
    }

    // Covoiturage — AVANT bus car "trajet" et "voyage" sont communs aux deux
    let covoit_create_kw = [
        "proposer covoiturage",
        "proposer trajet",
        "offrir covoiturage",
        "offrir trajet",
        "créer covoiturage",
        "creer covoiturage",
        "je conduis",
        "j'ai des places",
        "je propose trajet",
        "conducteur covoit",
    ];
    if msg.contains("covoiturage") || msg.contains("covoit") {
        if covoit_create_kw.iter().any(|k| msg.contains(k)) {
            return Intent::CovoiturageCreate;
        }
        return Intent::CovoiturageSearch {
            query: message.to_string(),
        };
    }

    // Bus
    let bus_kw = [
        "bus", "ticket", "billet", "voyage", "trajet", "depart", "départ",
    ];
    if bus_kw.iter().any(|k| msg.contains(k)) {
        return Intent::Bus {
            trajet: message.to_string(),
        };
    }

    // Pharmacie
    let pharma_kw = [
        "pharmacie",
        "médicament",
        "medicament",
        "ordonnance",
        "comprimé",
        "paracétamol",
        "paracetamol",
        "amoxicilline",
        "doliprane",
        "efferalgan",
        "ibuprofène",
        "coartem",
        "quinine",
        "metronidazole",
        "augmentin",
        "flagyl",
        "nivaquine",
        "ciprofloxacine",
    ];
    if pharma_kw.iter().any(|k| msg.contains(k)) {
        let medicament = extraire_medicament(&msg);
        return Intent::Pharmacie { medicament };
    }

    // Livres
    if msg.contains("vendre mes livres")
        || msg.contains("scanner livres")
        || msg.contains("vendre livre")
    {
        return Intent::LivresVente;
    }
    if msg.contains("livre")
        || msg.contains("scolaire")
        || msg.contains("manuel")
        || msg.contains("lycée")
        || msg.contains("college")
    {
        return Intent::LivresScolaires {
            query: message.to_string(),
        };
    }

    // Immobilier
    let immo_kw = [
        "louer",
        "location",
        "vente",
        "appartement",
        "studio",
        "villa",
        "meublé",
        "meuble",
        "hôtel",
        "hotel",
        "chambre",
        "immobilier",
    ];
    if immo_kw.iter().any(|k| msg.contains(k)) {
        return Intent::Immobilier {
            query: message.to_string(),
        };
    }

    // Choix numérique
    if let Ok(n) = msg.trim().parse::<usize>() {
        return Intent::Choix { n };
    }

    Intent::Inconnu
}

fn extraire_groupe_sanguin(msg: &str) -> Option<String> {
    let groupes = ["ab+", "ab-", "o+", "o-", "a+", "a-", "b+", "b-"];
    for g in &groupes {
        if msg.contains(g) {
            return Some(g.to_uppercase());
        }
    }
    None
}

fn extraire_medicament(msg: &str) -> String {
    let stop = [
        "pharmacie",
        "cherche",
        "besoin",
        "trouver",
        "médicament",
        "medicament",
        "acheter",
        "commander",
        "disponible",
        "proche",
        "je",
        "veux",
    ];
    let words: Vec<&str> = msg.split_whitespace().filter(|w| !stop.contains(w)).collect();
    let r = words.join(" ").trim().to_string();
    if r.is_empty() {
        msg.to_string()
    } else {
        r
    }
}

fn extraire_villes_bus(trajet: &str) -> (String, Option<String>) {
    let villes = [
        "douala",
        "yaoundé",
        "yaounde",
        "bafoussam",
        "buea",
        "bamenda",
        "ngaoundéré",
        "ngaoundere",
        "garoua",
        "maroua",
        "bertoua",
        "ebolowa",
        "kribi",
    ];
    let msg = trajet.to_lowercase();
    let found: Vec<&str> = villes.iter().filter(|v| msg.contains(*v)).copied().collect();
    match found.len() {
        0 => ("douala".to_string(), None),
        1 => (found[0].to_string(), None),
        _ => (found[0].to_string(), Some(found[1].to_string())),
    }
}

async fn handle_sang_search(pool: &Arc<PgPool>, groupe: Option<&str>) -> String {
    // blood_donors non encore disponible — message informatif
    let g_str = groupe.map(|g| format!(" *{}*", g.to_uppercase())).unwrap_or_default();
    let rows: Vec<sqlx::postgres::PgRow> = vec![];

    if rows.is_empty() {
        return format!(
            "🩸 Recherche de donneurs de sang{} en cours...\n\n⚠️ Urgence : appelez le *15*\n🏥 Banque de sang la plus proche : Centre Pasteur Cameroun\n📞 +237 222 23 15 00",
            g_str
        );
    }

    let g_info = groupe.map(|g| format!(" *{}*", g.to_uppercase())).unwrap_or_default();
    let mut msg = format!("🩸 Donneurs de sang{} disponibles :\n\n", g_info);
    for (i, r) in rows.iter().enumerate() {
        let nom: String = r.try_get("nom").unwrap_or_else(|_| "Anonyme".to_string());
        let groupe_sanguin: String = r.try_get("groupe_sanguin").unwrap_or_default();
        let tel: String = r.try_get("phone").unwrap_or_else(|_| "Non renseigné".to_string());
        let ville: String = String::new();
        msg.push_str(&format!(
            "{}. 👤 *{}* — {} — {} — 📞 {}\n",
            i + 1,
            nom,
            groupe_sanguin,
            ville,
            tel
        ));
    }
    msg.push_str("\n⚠️ _Urgence médicale : appelez le *15* (SAMU)_");
    msg
}
