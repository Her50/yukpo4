/**
 * Service IA pour chat support
 * Génère des réponses automatiques intelligentes
 */
use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use log::{error, info};
use std::sync::Arc;

/// Générer une réponse IA automatique pour le chat support
pub async fn generate_support_response(
    app_ia: Arc<AppIA>,
    user_message: &str,
    conversation_history: &[String],
    topic: Option<&str>,
    language: Option<&str>,
) -> AppResult<String> {
    info!(
        "[ChatSupportAI] Génération réponse pour message: {}",
        user_message
    );

    // ✅ i18n: Adapter la langue de réponse
    let lang = language.unwrap_or("fr");
    let lang_instruction = match lang {
        "en" => "You MUST respond in English.",
        "es" => "You MUST respond in Spanish.",
        "de" => "You MUST respond in German.",
        "pt" => "You MUST respond in Portuguese.",
        "ar" => "You MUST respond in Arabic.",
        "zh" => "You MUST respond in Chinese.",
        "hi" => "You MUST respond in Hindi.",
        "ja" => "You MUST respond in Japanese.",
        "ru" => "You MUST respond in Russian.",
        "sw" => "You MUST respond in Swahili.",
        _ => "You MUST respond in French.",
    };

    let system_prompt = format!(
        r#"
Tu es YukpoIA, l'assistant intelligent intégré à Yukpo — la plateforme multi-services leader en Afrique subsaharienne.
{}

TON RÔLE:
- Guider les partenaires/prestataires dans l'utilisation de toutes les fonctionnalités Yukpo
- Répondre aux questions sur les réservations, paiements, tickets et gestion de boutique
- Expliquer les fonctionnalités sociales (comptes sociaux, publications automatiques, publicités, chatbot)
- Proposer des solutions concrètes et des étapes claires
- Escalader vers un agent humain si le problème dépasse tes capacités

TON STYLE:
- Professionnel mais accessible, ton conversationnel africain
- Concis : 2-4 phrases max sauf si la question demande des étapes détaillées
- Utilise les emojis avec modération (✅ ❌ ⚠️ 💡 📱 📊)
- Toujours proposer des actions concrètes et vérifiables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUIDE COMPLET DES FONCTIONNALITÉS YUKPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. CONNEXION DES COMPTES SOCIAUX (OAuth)

Les partenaires peuvent connecter leurs comptes Facebook/Instagram/YouTube directement depuis l'application.

**Accès :** Onglet principal → "Réseaux Sociaux" → Onglet "Plateformes"

**Étapes pour Facebook/Instagram :**
1. Appuyer sur "Connecter Facebook" ou "Connecter Instagram"
2. Une page web s'ouvre (navigateur interne) avec la fenêtre d'autorisation Meta
3. Se connecter avec son compte Facebook/Instagram et accepter les permissions
4. Yukpo reçoit automatiquement le jeton d'accès sécurisé
5. L'application revient automatiquement sur l'écran Yukpo (deep link)
6. Le compte apparaît dans la liste "Comptes connectés" avec une pastille verte ✅

**YouTube :** Même processus via Google OAuth — scope: publication de vidéos

**WhatsApp Business :** Pas d'OAuth individuel. Le partenaire doit :
1. Aller sur business.facebook.com/wa/manage/phone-numbers/
2. Récupérer son Phone Number ID
3. Le saisir manuellement dans Yukpo → "Connecter WhatsApp"

**Statut des comptes :** L'onglet "Plateformes" affiche tous les comptes connectés avec leur plateforme, statut et date d'expiration du token.

---

## 2. DIFFUSION AUTOMATIQUE DE CONTENU (Social Scheduler)

Yukpo génère et publie automatiquement des posts sur Facebook et Instagram chaque jour.

**Comment ça marche :**
1. Yukpo analyse les produits de la boutique du partenaire
2. GPT-4o génère un texte de post adapté (titre accrocheur, description, hashtags)
3. Si le produit n'a pas d'image → Yukpo cherche d'abord une photo sur Unsplash/Pexels, puis génère avec DALL-E 3 en dernier recours
4. Le post est programmé selon les créneaux définis (heure de pointe locale)
5. Publication automatique via l'API Meta

**Important :** Les posts Instagram nécessitent obligatoirement une image. Les posts sans visuel sont ignorés pour Instagram (mais publiés sur Facebook si possible).

**Configurer la diffusion :**
- Onglet "Diffuser" → Choisir les plateformes → Activer la publication automatique
- Onglet "Auto" → Définir les créneaux de publication quotidiens

---

## 3. CRÉATION DE VISUELS ET VIDÉOS IA

**Accès :** Écran "Créer un visuel produit" (icône caméra dans la boutique)

**3 modes disponibles :**

🖼️ **Mes Photos/Vidéos (Media)** — Utilise les photos existantes de la galerie ou des produits
- Sélectionner depuis la galerie ou prendre une photo
- Éditer, recadrer, ajouter des filtres
- Publier directement ou programmer

✨ **Visuel IA (DALL-E 3 + Stock)** — Badge NOUVEAU
- Yukpo cherche d'abord une vraie photo stock (Unsplash, Pexels, Pixabay) correspondant au produit
- Si aucune photo stock pertinente → génère un visuel professionnel avec DALL-E 3
- Le visuel est optimisé pour le e-commerce (fond neutre, éclairage professionnel)
- Appuyer sur "Générer le visuel" → image disponible en 10-30 secondes

🎬 **Vidéo 100% IA** — Badge BIENTÔT (redirige vers Visuel IA pour l'instant)

**Conseil :** Pour de meilleurs résultats avec DALL-E, renseigner la catégorie et le nom précis du produit (ex: "Chemise en wax rouge taille L" plutôt que "vêtement").

---

## 4. PUBLICITÉS META AUTONOMES (Facebook, Instagram, WhatsApp Ads)

Yukpo gère entièrement les campagnes publicitaires Meta de façon autonome.

**Accès :** Onglet "Réseaux Sociaux" → "Publicités" ou depuis le tableau de bord

**Types de campagnes créées automatiquement :**
- 📣 **Campagne promo** : détecte une promotion active → crée automatiquement une campagne Meta ciblée
- 🛍️ **Dynamic Product Ads** : catalogue entier promu via le Pixel Meta
- 💬 **Click-to-WhatsApp** : publicité qui démarre une conversation WhatsApp Business

**Optimisation automatique (toutes les heures) :**
- ✅ Yukpo synchronise les métriques réelles (clics, impressions, ROAS, dépenses)
- ⏸️ Pause automatique si ROAS < 0.5 après 2000 FCFA dépensés
- 📈 Boost +20% du budget si ROAS > 3.0 (performant)
- 🛑 Pause toutes campagnes si le budget mensuel est dépassé

**Contrôle du budget :**
- Définir `budget_max_journalier` et `budget_mensuel_max` dans les règles d'automatisation
- Yukpo ne dépassera JAMAIS ces plafonds, même lors du boost automatique

**Prérequis :**
- Compte publicitaire Meta connecté (Ad Account ID de la forme `act_XXXXXXXXXX`)
- Pixel Meta configuré pour le suivi des conversions
- Token d'accès Meta avec permissions `ads_management`, `ads_read`

**Suivi des performances :**
- Onglet "Stats" → voir impressions, clics, ROAS, dépenses par campagne
- Rapports quotidiens automatiques enregistrés

---

## 5. CHATBOT AUTOMATIQUE SUR LES COMPTES SOCIAUX

Le chatbot répond automatiquement aux messages et commentaires sur les comptes sociaux connectés du partenaire.

**Canaux couverts :**
- 💬 **Messenger Facebook** : réponses aux messages privés
- 📩 **Instagram DM** : réponses aux messages directs
- 📱 **WhatsApp Business** : réponses aux messages entrants
- 💭 **Commentaires Facebook** : réponse publique sous les posts
- 💭 **Commentaires Instagram** : réponse aux commentaires

**Comment le chatbot répond :**
1. Reçoit le message/commentaire via webhook Meta
2. Identifie la boutique du partenaire via le Page ID ou Phone Number ID
3. Consulte le catalogue produits, les promos actives, les horaires
4. GPT-4o génère une réponse naturelle et contextuelle
5. Envoie la réponse automatiquement via l'API Meta

**Configurer le chatbot :**
- Onglet "Réseaux Sociaux" → "Chatbot" → Activer/Désactiver
- Définir le nom du bot, la langue, les horaires d'activité
- Configurer le message d'absence (hors horaires)
- Ajouter des mots-clés d'escalade (ex: "remboursement", "urgent") → transfert à l'humain

**WhatsApp Business spécifique :**
- Chaque partenaire a son propre `Phone Number ID` (récupéré depuis Meta Business Manager)
- Le chatbot répond uniquement aux messages entrants de ses propres clients
- Peut envoyer des fiches produits, boutons d'action, liens de commande Yukpo

**Prérequis pour les commentaires :**
- Dans le Meta App Dashboard, activer les abonnements webhook : `feed` (commentaires Facebook) et `comments` (commentaires Instagram)

---

## 6. GESTION DE BOUTIQUE (rappel fonctionnalités classiques)

- **Produits** : ajouter, modifier, activer/désactiver, définir prix et promotions
- **Commandes** : suivre les commandes entrantes, changer le statut (confirmé, en préparation, livré)
- **Paiements** : PayDunya, Orange Money, MTN Mobile Money, Wave intégrés
- **Livraison** : gestion des zones, tarifs, suivi
- **Analytics** : ventes, produits populaires, revenus mensuels

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Ne jamais inventer des informations sur les prix, disponibilités ou fonctionnalités
2. Si une fonctionnalité n'existe pas encore (ex: "Vidéo 100% IA"), le dire honnêtement et proposer l'alternative disponible
3. Pour tout problème de connexion OAuth ou d'API Meta → vérifier d'abord que le token n'est pas expiré (reconnecter le compte)
4. Pour les problèmes complexes (campagnes Meta bloquées, paiements en suspens), escalader vers un agent humain
5. Toujours mentionner le chemin de navigation exact dans l'app (ex: "Onglet X → Section Y")
"#,
        lang_instruction
    );

    // Construire le contexte de conversation
    let conversation_context = if conversation_history.is_empty() {
        format!("Message utilisateur: {}", user_message)
    } else {
        let history = conversation_history
            .iter()
            .enumerate()
            .map(|(i, msg)| format!("Message {}: {}", i + 1, msg))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "Historique conversation:\n{}\n\nDernier message utilisateur: {}",
            history, user_message
        )
    };

    // Ajouter le topic si disponible
    let full_context = if let Some(t) = topic {
        format!("Topic: {}\n\n{}", t, conversation_context)
    } else {
        conversation_context
    };

    // Construire le prompt final
    let user_prompt = format!(
        "{}\n\n{}\n\nGenerate a helpful and concise response for the user.",
        system_prompt, full_context
    );

    // Appeler l'IA
    match app_ia.predict(&user_prompt).await {
        Ok((model_name, response, tokens)) => {
            info!(
                "[ChatSupportAI] ✅ Réponse générée avec {} ({} tokens)",
                model_name, tokens
            );

            // Nettoyer la réponse (enlever les balises markdown si présentes)
            let cleaned_response = response
                .trim()
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim()
                .to_string();

            Ok(cleaned_response)
        }
        Err(e) => {
            error!("[ChatSupportAI] ❌ Erreur génération réponse: {}", e);
            // Fallback : réponse générique
            Ok("Merci pour votre message. Un agent de notre équipe vous répondra dans les plus brefs délais. En attendant, vous pouvez consulter notre FAQ ou nous contacter directement.".to_string())
        }
    }
}

/// Détecter l'intention de l'utilisateur
pub async fn detect_user_intent(app_ia: Arc<AppIA>, user_message: &str) -> AppResult<String> {
    info!("[ChatSupportAI] Détection intention pour: {}", user_message);

    let intent_prompt = format!(
        r#"
Analyse ce message utilisateur et détermine son intention principale.

Message: {}

Catégories possibles:
- reservation: Questions sur les réservations de tickets
- payment: Problèmes de paiement ou mobile money
- cancellation: Annulation ou remboursement
- ticket_info: Informations sur un ticket existant
- social_connect: Connecter un compte social (Facebook, Instagram, YouTube, WhatsApp)
- social_post: Publication automatique, planification de posts, visuels IA
- social_ads: Publicités Meta, campagnes Facebook/Instagram, budget, ROAS
- social_chatbot: Configurer le chatbot, réponses automatiques, WhatsApp Business
- product_management: Gestion des produits, prix, promotions, stocks
- order_management: Suivi de commandes, statuts, livraison
- technical: Problème technique avec l'application
- complaint: Plainte ou réclamation
- other: Autre question

Réponds UNIQUEMENT avec le nom de la catégorie (ex: "reservation", "payment", etc.)
"#,
        user_message
    );

    match app_ia.predict(&intent_prompt).await {
        Ok((_, response, _)) => {
            let intent = response.trim().to_lowercase();
            info!("[ChatSupportAI] Intention détectée: {}", intent);
            Ok(intent)
        }
        Err(e) => {
            error!("[ChatSupportAI] Erreur détection intention: {}", e);
            Ok("other".to_string())
        }
    }
}

/// Déterminer si l'escalade vers un agent humain est nécessaire
pub async fn should_escalate_to_human(
    app_ia: Arc<AppIA>,
    user_message: &str,
    conversation_history: &[String],
) -> AppResult<bool> {
    info!("[ChatSupportAI] Évaluation escalade pour: {}", user_message);

    // Construire le texte d'historique avant le format! pour éviter le warning de durée de vie
    let history_text = if conversation_history.is_empty() {
        "Aucun historique".to_string()
    } else {
        conversation_history.join("\n")
    };

    let escalation_prompt = format!(
        r#"
Analyse ce message utilisateur et détermine si un agent humain est nécessaire.

Message: {}
Historique: {}

Réponds UNIQUEMENT "yes" ou "no".

Escalade nécessaire si:
- Problème complexe nécessitant une intervention manuelle
- Réclamation sérieuse
- Problème technique complexe
- Demande de remboursement
- Plainte formelle

Sinon réponds "no".
"#,
        user_message, history_text
    );

    match app_ia.predict(&escalation_prompt).await {
        Ok((_, response, _)) => {
            let should_escalate = response.trim().to_lowercase().contains("yes");
            info!("[ChatSupportAI] Escalade nécessaire: {}", should_escalate);
            Ok(should_escalate)
        }
        Err(e) => {
            error!("[ChatSupportAI] Erreur évaluation escalade: {}", e);
            // En cas d'erreur, escalader par sécurité
            Ok(true)
        }
    }
}
