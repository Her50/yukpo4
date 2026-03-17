#!/usr/bin/env node
/**
 * translate-en-keys.js — Translate all EN keys that are still copies of FR text.
 * Uses a comprehensive French→English dictionary for word/phrase-level translation.
 * Also syncs missing EN keys from FR with rough translation.
 */
const fs = require('fs');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

// Comprehensive phrase-level dictionary (longest first for priority)
const phrases = {
    // Complete common phrases
    "Impossible de se connecter": "Unable to connect",
    "Impossible de charger": "Unable to load",
    "Impossible de sauvegarder": "Unable to save",
    "Impossible de supprimer": "Unable to delete",
    "Impossible de créer": "Unable to create",
    "Impossible de modifier": "Unable to modify",
    "Impossible de mettre à jour": "Unable to update",
    "Impossible de récupérer": "Unable to retrieve",
    "Impossible de vérifier": "Unable to verify",
    "Impossible de générer": "Unable to generate",
    "Impossible de démarrer": "Unable to start",
    "Impossible de terminer": "Unable to finish",
    "Impossible de sélectionner": "Unable to select",
    "Impossible de télécharger": "Unable to download",
    "Impossible d'envoyer": "Unable to send",
    "Impossible d'enregistrer": "Unable to save",
    "Impossible d'accéder": "Unable to access",
    "Impossible d'uploader": "Unable to upload",
    "Impossible d'ouvrir": "Unable to open",
    "Impossible d'obtenir": "Unable to get",
    "Impossible de": "Unable to",
    "Veuillez réessayer": "Please try again",
    "Veuillez vous connecter": "Please log in",
    "Veuillez remplir tous les champs": "Please fill in all fields",
    "Veuillez sélectionner": "Please select",
    "Veuillez renseigner": "Please provide",
    "Veuillez entrer": "Please enter",
    "Veuillez saisir": "Please enter",
    "Veuillez confirmer": "Please confirm",
    "Veuillez patienter": "Please wait",
    "Veuillez vérifier": "Please verify",
    "Veuillez activer": "Please enable",
    "Veuillez autoriser": "Please allow",
    "Veuillez accepter": "Please accept",
    "Veuillez choisir": "Please choose",
    "En cours de chargement": "Loading",
    "En cours de traitement": "Processing",
    "En cours d'envoi": "Sending",
    "En cours": "In progress",
    "Mis à jour": "Updated",
    "Mise à jour": "Update",
    "Mise en ligne": "Publishing",
    "Mot de passe": "Password",
    "Adresse e-mail": "Email address",
    "Adresse email": "Email address",
    "Numéro de téléphone": "Phone number",
    "Nom complet": "Full name",
    "Nom d'utilisateur": "Username",
    "Nom de famille": "Last name",
    "Nom du produit": "Product name",
    "Nom du service": "Service name",
    "Date de naissance": "Date of birth",
    "Date de début": "Start date",
    "Date de fin": "End date",
    "Date de création": "Creation date",
    "Date d'expiration": "Expiration date",
    "Lieu de départ": "Departure location",
    "Lieu d'arrivée": "Arrival location",
    "Point de départ": "Starting point",
    "Point d'arrivée": "Arrival point",
    "Modes de paiement": "Payment methods",
    "Mode de paiement": "Payment method",
    "Mode de livraison": "Delivery method",
    "Pas de résultats": "No results",
    "Aucun résultat": "No results",
    "Aucun produit": "No product",
    "Aucun service": "No service",
    "Aucune donnée": "No data",
    "Aucune commande": "No order",
    "Aucune réservation": "No reservation",
    "Aucune notification": "No notification",
    "Aucun commentaire": "No comment",
    "Aucun avis": "No review",
    "Aucun favori": "No favorites",
    "Aucun résultat trouvé": "No results found",
    "Aucun produit trouvé": "No product found",
    "Aucune offre": "No offer",
    "Aucun véhicule": "No vehicle",
    "Aucun trajet": "No trip",
    "Aucun document": "No document",
    "Aucun média": "No media",
    "Tout sélectionner": "Select all",
    "Tout désélectionner": "Deselect all",
    "Voir tout": "View all",
    "Voir plus": "View more",
    "Voir moins": "View less",
    "Voir les détails": "View details",
    "Voir le profil": "View profile",
    "Fermer la fenêtre": "Close window",
    "Retour à l'accueil": "Back to home",
    "Ajouter au panier": "Add to cart",
    "Ajouter un produit": "Add a product",
    "Ajouter un service": "Add a service",
    "Ajouter une photo": "Add a photo",
    "Ajouter une vidéo": "Add a video",
    "Ajouter un commentaire": "Add a comment",
    "Ajouter un avis": "Add a review",
    "Créer un compte": "Create an account",
    "Créer un service": "Create a service",
    "Créer un produit": "Create a product",
    "Se connecter": "Log in",
    "Se déconnecter": "Log out",
    "S'inscrire": "Sign up",
    "Mon compte": "My account",
    "Mon profil": "My profile",
    "Mes commandes": "My orders",
    "Mes services": "My services",
    "Mes produits": "My products",
    "Mes favoris": "My favorites",
    "Mes réservations": "My reservations",
    "Mes notifications": "My notifications",
    "Mes messages": "My messages",
    "Mon panier": "My cart",
    "Ma position": "My position",
    "Gérer mon service": "Manage my service",
    "Gestion des services": "Service management",
    "Gestion des produits": "Product management",
    "Gestion des commandes": "Order management",
    "Gestion des réservations": "Reservation management",
    "Gestion de l'équipe": "Team management",
    "Conditions générales": "Terms and conditions",
    "Politique de confidentialité": "Privacy policy",
    "Centre d'aide": "Help center",
    "À propos": "About",
    "Nous contacter": "Contact us",
    "Questions fréquentes": "FAQ",
    "Paramètres du compte": "Account settings",
    "Changer la langue": "Change language",
    "Changer le mot de passe": "Change password",
    "Prendre une photo": "Take a photo",
    "Choisir depuis la galerie": "Choose from gallery",
    "Depuis la galerie": "From gallery",
    "Depuis la caméra": "From camera",
    "Partager le lien": "Share the link",
    "Copier le lien": "Copy the link",
    "Lien copié": "Link copied",
    "Erreur de connexion": "Connection error",
    "Erreur de chargement": "Loading error",
    "Erreur de réseau": "Network error",
    "Erreur interne": "Internal error",
    "Erreur serveur": "Server error",
    "Erreur inattendue": "Unexpected error",
    "Erreur lors de": "Error during",
    "Une erreur est survenue": "An error occurred",
    "Une erreur inattendue": "An unexpected error",
    "Opération réussie": "Operation successful",
    "Sauvegarde réussie": "Save successful",
    "Envoi réussi": "Send successful",
    "Suppression réussie": "Deletion successful",
    "Création réussie": "Creation successful",
    "Modification réussie": "Modification successful",
    "Inscription réussie": "Registration successful",
    "Connexion réussie": "Connection successful",
    "Commande créée": "Order created",
    "Réservation confirmée": "Reservation confirmed",
    "Réservation annulée": "Reservation cancelled",
    "Paiement effectué": "Payment completed",
    "Livraison en cours": "Delivery in progress",
    "Commande livrée": "Order delivered",
    "Rechercher un produit": "Search for a product",
    "Rechercher un service": "Search for a service",
    "Rechercher un lieu": "Search for a place",
    "Rechercher une adresse": "Search for an address",
    "Rechercher un prestataire": "Search for a provider",
    "Rechercher ici": "Search here",
    "Exprimez votre besoin": "Express your need",
    "Que recherchez-vous": "What are you looking for",
    "Commencer la recherche": "Start search",
    "Fonctionnalité à venir": "Feature coming soon",
    "Fonctionnalité à implémenter": "Feature to implement",
    "Bientôt disponible": "Coming soon",
    "Non disponible": "Not available",
    "Accès refusé": "Access denied",
    "Permission refusée": "Permission denied",
    "Session expirée": "Session expired",
    "Compte désactivé": "Account disabled",
    "Trajet partagé": "Shared trip",
    "Ticket de voyage": "Travel ticket",
    "Billet de bus": "Bus ticket",
    "Réservation de taxi": "Taxi booking",
    "Suivi de livraison": "Delivery tracking",
    "Suivi en temps réel": "Real-time tracking",
    "Partage de trajet": "Trip sharing",
    "Transport rapide": "Fast transport",
    "Véhicules d'occasions": "Used vehicles",
    "Santé et bien-être": "Health and wellness",
    "Don de sang": "Blood donation",
    "Banque de sang": "Blood bank",
    "Groupe sanguin": "Blood type",
    "Centre de santé": "Health center",
    "Résultats d'analyses": "Analysis results",
    "Prise de rendez-vous": "Appointment booking",
    "Consultation en ligne": "Online consultation",
    "Troc de livres": "Book exchange",
    "Bourse du livre": "Book market",
    "Livres scolaires": "School books",
    "Vidéo de présentation": "Presentation video",
    "Création de vidéo": "Video creation",
    "Montage vidéo": "Video editing",
    "Génération de vidéo": "Video generation",
    "Galerie de médias": "Media gallery",
    "Tableau de bord": "Dashboard",
    "Vue d'ensemble": "Overview",
    "Statistiques détaillées": "Detailed statistics",
    "Chiffre d'affaires": "Revenue",
    "Nombre de commandes": "Number of orders",
    "Note moyenne": "Average rating",
    "Taux de satisfaction": "Satisfaction rate",
    "Jour": "Day",
    "Semaine": "Week",
    "Mois": "Month",
    "Année": "Year",
    "Aujourd'hui": "Today",
    "Hier": "Yesterday",
    "Cette semaine": "This week",
    "Ce mois": "This month",
    "Derniers 7 jours": "Last 7 days",
    "Derniers 30 jours": "Last 30 days",
    "Offres d'emploi": "Job offers",
    "Promotions flash": "Flash promotions",
    "Publicité": "Advertising",
    "Campagne publicitaire": "Advertising campaign",
    "Budget publicitaire": "Advertising budget",
    "Ciblage géographique": "Geographic targeting",
    "Intelligence artificielle": "Artificial intelligence",
    "Suggestions intelligentes": "Smart suggestions",
    "Recommandations personnalisées": "Personalized recommendations",
    "Analyse automatique": "Automatic analysis",
    "Détection automatique": "Automatic detection",
    "Reconnaissance d'image": "Image recognition",
    "Traduction automatique": "Automatic translation",
    "Navigation intelligente": "Smart navigation",
    "Itinéraire optimal": "Optimal route",
    "Temps estimé": "Estimated time",
    "Distance estimée": "Estimated distance",
    "Arrivée estimée": "Estimated arrival",
    "Départ prévu": "Scheduled departure",
    "Arrivée prévue": "Scheduled arrival",
    "Places disponibles": "Available seats",
    "Place réservée": "Reserved seat",
    "Sélectionner les places": "Select seats",
    "Coût estimé": "Estimated cost",
    "Prix total": "Total price",
    "Prix unitaire": "Unit price",
    "Frais de livraison": "Delivery fees",
    "Frais de service": "Service fees",
    "Commission": "Commission",
    "Montant total": "Total amount",
    "Montant à payer": "Amount to pay",
    "Solde disponible": "Available balance",
    "Mobile Money": "Mobile Money",
    "Carte bancaire": "Bank card",
    "Paiement en espèces": "Cash payment",
    "Paiement à la livraison": "Cash on delivery",
    "Confirmer le paiement": "Confirm payment",
    "Annuler la commande": "Cancel order",
    "Confirmer la commande": "Confirm order",
    "Suivre ma commande": "Track my order",
    "Évaluer le service": "Rate the service",
    "Laisser un avis": "Leave a review",
    "Signaler un problème": "Report a problem",
    "Contacter le support": "Contact support",
    "Besoin d'aide": "Need help",
    "Champs obligatoires": "Required fields",
    "Champ obligatoire": "Required field",
    "Format invalide": "Invalid format",
    "Déjà inscrit": "Already registered",
    "Pas encore de compte": "No account yet",
    "Créez votre compte": "Create your account",
    "Bienvenue": "Welcome",
    "Félicitations": "Congratulations",
    "Merci": "Thank you",
    "Attention": "Warning",
    "Information": "Information",
    "Confirmation": "Confirmation",
    "Succès": "Success",
};

// Word-level dictionary for remaining words
const words = {
    "Rechercher": "Search", "Chercher": "Search",
    "Sélectionner": "Select", "Sélectionnez": "Select",
    "Confirmer": "Confirm", "Confirmez": "Confirm",
    "Annuler": "Cancel", "Supprimer": "Delete",
    "Modifier": "Edit", "Ajouter": "Add",
    "Créer": "Create", "Enregistrer": "Save",
    "Sauvegarder": "Save", "Envoyer": "Send",
    "Valider": "Validate", "Fermer": "Close",
    "Ouvrir": "Open", "Réserver": "Book",
    "Partager": "Share", "Copier": "Copy",
    "Coller": "Paste", "Couper": "Cut",
    "Télécharger": "Download", "Uploader": "Upload",
    "Démarrer": "Start", "Arrêter": "Stop",
    "Terminer": "Finish", "Continuer": "Continue",
    "Suivant": "Next", "Précédent": "Previous",
    "Retour": "Back", "Accueil": "Home",
    "Connexion": "Login", "Déconnexion": "Logout",
    "Inscription": "Registration", "Paramètres": "Settings",
    "Profil": "Profile", "Compte": "Account",
    "Panier": "Cart", "Commande": "Order",
    "Commandes": "Orders", "Livraison": "Delivery",
    "Livraisons": "Deliveries", "Réservation": "Reservation",
    "Réservations": "Reservations", "Notification": "Notification",
    "Notifications": "Notifications", "Message": "Message",
    "Messages": "Messages", "Commentaire": "Comment",
    "Commentaires": "Comments", "Favoris": "Favorites",
    "Produit": "Product", "Produits": "Products",
    "Service": "Service", "Services": "Services",
    "Catégorie": "Category", "Catégories": "Categories",
    "Sous-catégorie": "Subcategory", "Sous-catégories": "Subcategories",
    "Description": "Description", "Titre": "Title",
    "Prix": "Price", "Quantité": "Quantity",
    "Stock": "Stock", "Photo": "Photo",
    "Photos": "Photos", "Vidéo": "Video",
    "Vidéos": "Videos", "Image": "Image",
    "Images": "Images", "Fichier": "File",
    "Fichiers": "Files", "Document": "Document",
    "Documents": "Documents", "Adresse": "Address",
    "Téléphone": "Phone", "Email": "Email",
    "Nom": "Name", "Prénom": "First name",
    "Entreprise": "Company", "Société": "Company",
    "Boutique": "Shop", "Magasin": "Store",
    "Pharmacie": "Pharmacy", "Hôpital": "Hospital",
    "Clinique": "Clinic", "Laboratoire": "Laboratory",
    "Hôtel": "Hotel", "Meublé": "Furnished",
    "Restaurant": "Restaurant", "Café": "Coffee",
    "Boulangerie": "Bakery", "Supermarché": "Supermarket",
    "Marché": "Market", "Taxi": "Taxi",
    "Bus": "Bus", "Covoiturage": "Carpooling",
    "Transport": "Transport", "Véhicule": "Vehicle",
    "Véhicules": "Vehicles", "Chauffeur": "Driver",
    "Conducteur": "Driver", "Passager": "Passenger",
    "Passagers": "Passengers", "Voyageur": "Traveler",
    "Coursier": "Courier", "Livreur": "Delivery person",
    "Prestataire": "Provider", "Partenaire": "Partner",
    "Client": "Client", "Utilisateur": "User",
    "Administrateur": "Administrator", "Équipe": "Team",
    "Membre": "Member", "Employé": "Employee",
    "Disponible": "Available", "Indisponible": "Unavailable",
    "Actif": "Active", "Inactif": "Inactive",
    "Activé": "Enabled", "Désactivé": "Disabled",
    "Ouvert": "Open", "Fermé": "Closed",
    "Gratuit": "Free", "Payant": "Paid",
    "Nouveau": "New", "Nouvelle": "New",
    "Ancien": "Old", "Récent": "Recent",
    "Populaire": "Popular", "Recommandé": "Recommended",
    "Vérifié": "Verified", "Certifié": "Certified",
    "Urgent": "Urgent", "Important": "Important",
    "Optionnel": "Optional", "Obligatoire": "Required",
    "Chargement": "Loading", "Traitement": "Processing",
    "Envoi": "Sending", "Réception": "Reception",
    "Téléchargement": "Download", "Installation": "Installation",
    "Détails": "Details", "Résumé": "Summary",
    "Historique": "History", "Statistiques": "Statistics",
    "Analytiques": "Analytics", "Rapport": "Report",
    "Graphique": "Chart", "Tableau": "Table",
    "Liste": "List", "Grille": "Grid",
    "Carte": "Map", "Plan": "Plan",
    "Calendrier": "Calendar", "Horaire": "Schedule",
    "Horaires": "Schedules", "Planning": "Planning",
    "Agenda": "Agenda", "Rendez-vous": "Appointment",
    "Réunion": "Meeting", "Événement": "Event",
    "Promotion": "Promotion", "Remise": "Discount",
    "Solde": "Sale", "Offre": "Offer",
    "Coupon": "Coupon", "Code promo": "Promo code",
    "Avis": "Review", "Note": "Rating",
    "Étoile": "Star", "Étoiles": "Stars",
    "Évaluation": "Evaluation", "Classement": "Ranking",
    "Position": "Position", "Localisation": "Location",
    "Géolocalisation": "Geolocation", "GPS": "GPS",
    "Itinéraire": "Route", "Trajet": "Trip",
    "Distance": "Distance", "Durée": "Duration",
    "Temps": "Time", "Minute": "Minute",
    "Minutes": "Minutes", "Heure": "Hour",
    "Heures": "Hours", "Seconde": "Second",
    "Aujourd'hui": "Today", "Demain": "Tomorrow",
    "Lundi": "Monday", "Mardi": "Tuesday",
    "Mercredi": "Wednesday", "Jeudi": "Thursday",
    "Vendredi": "Friday", "Samedi": "Saturday",
    "Dimanche": "Sunday",
    "Janvier": "January", "Février": "February",
    "Mars": "March", "Avril": "April",
    "Mai": "May", "Juin": "June",
    "Juillet": "July", "Août": "August",
    "Septembre": "September", "Octobre": "October",
    "Novembre": "November", "Décembre": "December",
    "Couleur": "Color", "Taille": "Size",
    "Poids": "Weight", "Dimension": "Dimension",
    "Format": "Format", "Version": "Version",
    "Type": "Type", "Modèle": "Model",
    "Marque": "Brand", "Référence": "Reference",
    "État": "Condition", "Neuf": "New",
    "Occasion": "Used", "Reconditionné": "Refurbished",
    "Garantie": "Warranty", "Retour": "Return",
    "Échange": "Exchange", "Remboursement": "Refund",
    "Facture": "Invoice", "Reçu": "Receipt",
    "Devis": "Quote", "Contrat": "Contract",
    "Signature": "Signature", "Accord": "Agreement",
    "Accepter": "Accept", "Refuser": "Decline",
    "Approuver": "Approve", "Rejeter": "Reject",
    "Suspendre": "Suspend", "Réactiver": "Reactivate",
    "Bloquer": "Block", "Débloquer": "Unblock",
    "Signaler": "Report", "Signalement": "Report",
    "Plainte": "Complaint", "Réclamation": "Claim",
    "Aide": "Help", "Support": "Support",
    "Contact": "Contact", "Appel": "Call",
    "Chat": "Chat", "Discussion": "Discussion",
    "Conversation": "Conversation", "Groupe": "Group",
    "Fil": "Thread", "Réponse": "Reply",
    "Pièce jointe": "Attachment", "Lien": "Link",
    "Tout": "All", "Rien": "Nothing",
    "Oui": "Yes", "Non": "No",
    "Vrai": "True", "Faux": "False",
    "Ou": "Or", "Et": "And",
    "Avec": "With", "Sans": "Without",
    "Plus": "More", "Moins": "Less",
    "Maximum": "Maximum", "Minimum": "Minimum",
    "Total": "Total", "Sous-total": "Subtotal",
    "Moyenne": "Average", "Pourcentage": "Percentage",
    "Devise": "Currency", "Monnaie": "Currency",
    "Tarif": "Rate", "Estimation": "Estimate",
    "Réduction": "Reduction", "Augmentation": "Increase",
    "Bénéfice": "Profit", "Perte": "Loss",
    "Soldes": "Sales", "Inventaire": "Inventory",
    "Catalogue": "Catalog", "Collection": "Collection",
    "Variante": "Variant", "Option": "Option",
    "Préférence": "Preference", "Configuration": "Configuration",
    "Personnalisation": "Customization",
    "Automatique": "Automatic", "Manuel": "Manual",
    "Rapide": "Fast", "Standard": "Standard",
    "Express": "Express", "Programmé": "Scheduled",
    "Immédiat": "Immediate", "Différé": "Delayed",
    "Permanent": "Permanent", "Temporaire": "Temporary",
    "Principal": "Main", "Secondaire": "Secondary",
    "Général": "General", "Spécifique": "Specific",
    "Global": "Global", "Local": "Local",
    "Public": "Public", "Privé": "Private",
    "Vérifié": "Verified", "En attente": "Pending",
    "Approuvé": "Approved", "Rejeté": "Rejected",
    "Terminé": "Completed", "Annulé": "Cancelled",
    "Échoué": "Failed", "Réussi": "Successful",
    "Erreur": "Error", "Avertissement": "Warning",
    "Succès": "Success", "Info": "Info",
    "Critique": "Critical", "Alertes": "Alerts",
    "Alerte": "Alert",
    "Découvrez": "Discover", "Explorez": "Explore",
    "Commencez": "Start", "Essayez": "Try",
    "Profitez": "Enjoy", "Rejoignez": "Join",
    "Partagez": "Share", "Invitez": "Invite",
    "Gagnez": "Earn", "Économisez": "Save",
    "Comparez": "Compare", "Filtrez": "Filter",
    "Triez": "Sort", "Organisez": "Organize",
    "Gérez": "Manage", "Configurez": "Configure",
    "Personnalisez": "Customize", "Activez": "Enable",
    "Désactivez": "Disable", "Connectez": "Connect",
    "Envoyez": "Send", "Recevez": "Receive",
    "Consultez": "View", "Téléchargez": "Download",
    "Accédez": "Access",
    "Votre": "Your", "Notre": "Our",
    "Leur": "Their",
    // Common small words
    "le": "the", "la": "the", "les": "the",
    "un": "a", "une": "a", "des": "some",
    "du": "of the", "de": "of", "d'": "of ",
    "et": "and", "ou": "or", "ni": "nor",
    "en": "in", "au": "at the", "aux": "at the",
    "sur": "on", "dans": "in", "par": "by",
    "pour": "for", "avec": "with", "sans": "without",
    "vers": "towards", "chez": "at",
    "est": "is", "sont": "are",
    "a": "has", "ont": "have",
    "pas": "not", "plus": "more",
    "ce": "this", "cet": "this", "cette": "this", "ces": "these",
    "mon": "my", "ma": "my", "mes": "my",
    "ton": "your", "ta": "your", "tes": "your",
    "son": "his", "sa": "his", "ses": "his",
    "votre": "your", "vos": "your",
    "notre": "our", "nos": "our",
    "leur": "their", "leurs": "their",
    "je": "I", "tu": "you", "il": "he", "elle": "she",
    "nous": "we", "vous": "you", "ils": "they", "elles": "they",
    "qui": "who", "que": "that", "quoi": "what",
    "où": "where", "quand": "when", "comment": "how",
    "pourquoi": "why", "combien": "how much",
    "ici": "here", "là": "there",
    "très": "very", "trop": "too",
    "bien": "well", "mal": "badly",
    "aussi": "also", "encore": "still",
    "déjà": "already", "jamais": "never",
    "toujours": "always", "souvent": "often",
    "parfois": "sometimes", "maintenant": "now",
    "avant": "before", "après": "after",
    "pendant": "during", "depuis": "since",
    "entre": "between", "sous": "under",
    "jusqu'à": "until", "sauf": "except",
    "comme": "like", "même": "same",
    "autre": "other", "autres": "others",
    "chaque": "each", "tout": "all",
    "plusieurs": "several", "quelques": "some",
    "certain": "certain", "certains": "some",
    "premier": "first", "dernier": "last",
    "prochain": "next", "précédent": "previous",
    "meilleur": "best", "pire": "worst",
    "bon": "good", "mauvais": "bad",
    "grand": "large", "petit": "small",
    "long": "long", "court": "short",
    "haut": "high", "bas": "low",
    "cher": "expensive", "gratuit": "free",
    "plein": "full", "vide": "empty",
    "prêt": "ready", "terminé": "finished",
};

function translateValue(frText) {
    if (!frText || typeof frText !== 'string') return frText;
    
    let result = frText;
    
    // 1. Try exact phrase matches (longest first)
    const sortedPhrases = Object.entries(phrases).sort((a, b) => b[0].length - a[0].length);
    for (const [fr, en] of sortedPhrases) {
        if (result === fr) return en;
        // Case-insensitive match for the whole string
        if (result.toLowerCase() === fr.toLowerCase()) {
            // Preserve original casing of first char
            return result[0] === result[0].toUpperCase() 
                ? en.charAt(0).toUpperCase() + en.slice(1) 
                : en;
        }
    }
    
    // 2. Try phrase-level replacements within the text
    for (const [fr, en] of sortedPhrases) {
        const regex = new RegExp(fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, (match) => {
            // Preserve capitalization
            if (match[0] === match[0].toUpperCase() && en[0] === en[0].toLowerCase()) {
                return en.charAt(0).toUpperCase() + en.slice(1);
            }
            return en;
        });
    }
    
    // 3. Try word-level replacements
    const sortedWords = Object.entries(words).sort((a, b) => b[0].length - a[0].length);
    for (const [fr, en] of sortedWords) {
        // Word boundary replacement
        const regex = new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        result = result.replace(regex, (match) => {
            if (match[0] === match[0].toUpperCase() && en[0] === en[0].toLowerCase()) {
                return en.charAt(0).toUpperCase() + en.slice(1);
            }
            if (match === match.toLowerCase()) return en.toLowerCase();
            return en;
        });
    }
    
    // 4. Handle common French patterns
    result = result.replace(/l'/gi, 'the ');
    result = result.replace(/d'/gi, 'of ');
    result = result.replace(/n'/gi, 'not ');
    result = result.replace(/s'/gi, '');
    result = result.replace(/qu'/gi, 'that ');
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
}

let translated = 0, synced = 0;

// Translate EN keys that are copies of FR
for (const ns of Object.keys(fr)) {
    if (!en[ns]) en[ns] = {};
    for (const key of Object.keys(fr[ns])) {
        const frVal = fr[ns][key];
        const enVal = en[ns]?.[key];
        
        // Sync missing keys
        if (enVal === undefined) {
            en[ns][key] = translateValue(frVal);
            synced++;
            continue;
        }
        
        // Skip if EN is already different from FR (already translated)
        if (enVal !== frVal) continue;
        
        // Skip if text has no French characters (might be a proper name, URL, code, etc.)
        if (!/[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/.test(frVal) && 
            !/\b(Veuillez|Rechercher|Choisir|Entrez|Confirmez|Saisissez|Chargement|Connexion|Inscription|Sauvegarder|Voir tout|Voir plus|Ajouter|Aucun|Aucune|Filtre|Trier par|Tous les|Toutes les|Nouveau|Nouvelle|Obligatoire|Optionnel|Gratuit|En cours|Disponible|Indisponible|Sélectionner|Sélectionnez|Confirmer|Supprimer|Modifier|Envoyer|Enregistrer|Fermer|Retour|Suivant|Précédent|Réserver|Annuler|Créer|Bienvenue|Félicitations|Merci|Attention|Erreur|Succès|Information|Confirmation)\b/i.test(frVal)) {
            continue;
        }
        
        // Translate
        const newEn = translateValue(frVal);
        if (newEn !== frVal) {
            en[ns][key] = newEn;
            translated++;
        }
    }
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log('\n=== EN Translation Results ===');
console.log('Keys translated:', translated);
console.log('Keys synced (missing):', synced);
console.log('Total EN keys:', Object.values(en).reduce((a, ns) => a + Object.keys(ns).length, 0));
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }

// Quick check: how many copies remain?
let copies = 0;
for (const ns of Object.keys(fr)) {
    for (const key of Object.keys(fr[ns])) {
        if (en[ns]?.[key] === fr[ns][key] && /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/.test(fr[ns][key])) {
            copies++;
        }
    }
}
console.log('Remaining FR copies in EN (with accents):', copies);
