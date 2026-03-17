#!/usr/bin/env node
/**
 * translate-en-keys-v2.js — Comprehensive FR→EN translation for remaining 1984 keys.
 * Massively expanded dictionary covering domain-specific vocabulary.
 */
const fs = require('fs');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

// Mega dictionary — phrases first (longest match wins), then words
const dict = {
    // ---- PHRASES (multi-word, sorted by length at runtime) ----
    // Auth & Account
    "Authentification à deux facteurs": "Two-factor authentication",
    "Réinitialiser le mot de passe": "Reset password",
    "Réseaux sociaux": "Social networks",
    "Informations générales": "General information",
    "Informations personnelles": "Personal information",
    "Informations de contact": "Contact information",
    "Conditions d'utilisation": "Terms of use",
    "Politique de confidentialité": "Privacy policy",
    
    // Medical / Health
    "Prescription médicale requise": "Medical prescription required",
    "Assistant IA Santé": "AI Health Assistant",
    "Conseils santé": "Health tips",
    "Interactions médicamenteuses": "Drug interactions",
    "Interactions Médicamenteuses": "Drug Interactions",
    "Vérifier interactions": "Check interactions",
    "Alternatives suggérées": "Suggested alternatives",
    "Fonctionnalités IA": "AI Features",
    "Analyse complétée": "Analysis completed",
    "Prestations médicales": "Medical services",
    "Consultation générale": "General consultation",
    "Prévision remplissage": "Fill prediction",
    "Éléments détectés": "Detected elements",
    "Restrictions diététiques": "Dietary restrictions",
    "Préférences alimentaires": "Food preferences",
    "Notes / demandes spéciales": "Notes / special requests",
    "Score Santé": "Health Score",
    "Score Santé & Coach IA": "Health Score & AI Coach",
    "VO2max, défis, CO2, badges, conseils...": "VO2max, challenges, CO2, badges, tips...",
    "CO2, santé, défis": "CO2, health, challenges",
    "Centre de santé": "Health center",
    "Don de sang": "Blood donation",
    "Banque de sang": "Blood bank",
    "Groupe sanguin": "Blood type",
    "Résultats d'analyses": "Analysis results",
    
    // Insurance
    "Dernières polices": "Latest policies",
    "Émettre police": "Issue policy",
    "Expertise demandée": "Expertise requested",
    "Partiellement approuvé": "Partially approved",
    "Indemnisé": "Compensated",
    "Contesté": "Contested",
    "Résiliée": "Terminated",
    "Expirée": "Expired",
    "À renouveler": "To renew",
    "Indemnisés": "Compensated",
    "Refusés": "Refused",
    
    // Education / Books
    "Livre souhaité": "Desired book",
    "Supérieur (Université)": "Higher education (University)",
    "Établissement Scolaire": "School",
    "Établissement public": "Public institution",
    "Livres scolaires": "School books",
    "Bourse du livre": "Book market",
    "Troc de livres": "Book exchange",
    "Points à améliorer": "Areas for improvement",
    "Compétences identifiées": "Identified skills",
    "Compétences manquantes": "Missing skills",
    "Compétences requises": "Required skills",
    "Caractéristiques principales": "Main features",
    "Prédiction Salaire IA": "AI Salary Prediction",
    "Comparaison marché": "Market comparison",
    "Secteur recherché": "Desired sector",
    "Lettre téléchargée": "Letter downloaded",
    
    // Transport
    "Courses Marché": "Market Shopping",
    "Courses supermarché": "Supermarket shopping",
    "Déménagement": "Moving",
    "Suivi financier détaillé": "Detailed financial tracking",
    "Transactions récentes": "Recent transactions",
    "Transferts effectués": "Transfers completed",
    "Colis récupéré": "Package picked up",
    "Suivi en temps réel": "Real-time tracking",
    "Partage de trajet": "Trip sharing",
    "Transport rapide": "Fast transport",
    "Émission tickets bus": "Bus ticket issuance",
    "Compagnies affiliées": "Affiliated companies",
    "Résumé embarquement": "Boarding summary",
    "Gérer embarquement": "Manage boarding",
    "Gérer places": "Manage seats",
    "Gérer équipe": "Manage team",
    
    // Jobs
    "Télétravail possible": "Remote work possible",
    "Télétravail complet": "Full remote work",
    "Télétravail partiel": "Partial remote work",
    "Télétravail uniquement": "Remote only",
    "Salaire négociable": "Negotiable salary",
    "Offres d'emploi": "Job offers",
    "Expérience min": "Min experience",
    
    // Navigation
    "Lieux visités": "Places visited",
    "Activités récentes": "Recent activities",
    "Défis Personnalisés": "Custom Challenges",
    "Services liés": "Related services",
    "À proximité": "Nearby",
    "Coordonnées GPS": "GPS coordinates",
    "Coordonnées manuelles": "Manual coordinates",
    "Rayon (mètres)": "Radius (meters)",
    "Ciblage avancé": "Advanced targeting",
    "Zones géographiques": "Geographic zones",
    "Zone sélectionnée": "Selected zone",
    "Pays détecté": "Detected country",
    "Langues suggérées": "Suggested languages",
    
    // Video / Media
    "Vidéo de présentation": "Presentation video",
    "Création de vidéo": "Video creation",
    "Montage vidéo": "Video editing",
    "Génération de vidéo": "Video generation",
    "Galerie de médias": "Media gallery",
    "Barre latérale": "Sidebar",
    "BPM détecté": "BPM detected",
    "Gras, centré, impactant": "Bold, centered, impactful",
    "Raffiné, discret": "Refined, discreet",
    
    // Finance
    "Coût total estimé": "Estimated total cost",
    "Épargne retraite": "Retirement savings",
    "Numéro MTN Money": "MTN Money number",
    "Numéro Orange Money": "Orange Money number",
    "Mobile Money": "Mobile Money",
    "Paiement en espèces": "Cash payment",
    "Carte bancaire": "Bank card",
    
    // Ads / Promo
    "Gagnant identifié": "Winner identified",
    "Métrique à comparer": "Metric to compare",
    "Filtres appliqués": "Filters applied",
    "Filtres appliqués!": "Filters applied!",
    
    // Real estate
    "Services proposés": "Offered services",
    "Tableau de bord": "Dashboard",
    "Vue d'ensemble": "Overview",
    "Statistiques détaillées": "Detailed statistics",
    "Chiffre d'affaires": "Revenue",
    
    // Food
    "Ingrédients": "Ingredients",
    "Protéines": "Proteins",
    "Marché sélectionné": "Selected market",
    
    // Common phrases
    "Avance payée": "Advance paid",
    "Dons acceptés": "Donations accepted",
    "Décrivez brièvement": "Briefly describe",
    "à implémenter": "to implement",
    "à venir": "coming soon",
    "En cours": "In progress",
    "En attente": "Pending",
    "Hôpitaux suggérés": "Suggested hospitals",
    "Cameroun, Sénégal, etc.": "Cameroon, Senegal, etc.",
};

// Single-word dictionary (expanded massively)
const wordDict = {
    // Accented words that need translation
    "Récapitulatif": "Summary", "Médias": "Media", "Média": "Media",
    "Désactiver": "Disable", "Réinitialiser": "Reset",
    "Résilier": "Terminate", "Résultat": "Result", "Résultats": "Results",
    "résultat": "result", "résultats": "results",
    "Disponibilités": "Availability", "Propriétés": "Properties",
    "Propriété": "Property", "Payé": "Paid", "Terminé": "Completed",
    "Confirmé": "Confirmed", "Annulé": "Cancelled", "Équipe": "Team",
    "Compatibilité": "Compatibility", "Fréquence": "Frequency",
    "Précautions": "Precautions", "Interprétation": "Interpretation",
    "Vérifié": "Verified", "Vérifier": "Verify",
    "Âge": "Age", "Déclaré": "Declared", "Approuvé": "Approved",
    "Expirées": "Expired", "Filières": "Fields",
    "Français": "French", "Español": "Spanish",
    "Chaîne": "Chain", "Étape": "Step",
    "Recommandé": "Recommended", "Réduire": "Reduce",
    "Hébergement": "Accommodation", "Sécurité": "Security",
    "Vélo": "Bicycle", "Acceptés": "Accepted",
    "Complétés": "Completed", "Sponsorisé": "Sponsored",
    "Intéressant": "Interesting", "Déçu": "Disappointed",
    "réfléchir": "think about", "Négociable": "Negotiable",
    "Compétences": "Skills", "Rémunération": "Compensation",
    "Générer": "Generate", "Mathématiques": "Mathematics",
    "Médian": "Median", "Régional": "Regional",
    "Saisonnière": "Seasonal", "Témoignage": "Testimonial",
    "Aperçu": "Preview", "Beauté": "Beauty",
    "Éducation": "Education", "Embarqués": "Boarded",
    "Complétion": "Completion", "Complétude": "Completeness",
    "Qualité": "Quality", "Expérience": "Experience",
    "Complétées": "Completed", "Réessayer": "Retry",
    "Modéré": "Moderate", "Élégant": "Elegant",
    "Récente": "Recent", "unités": "units",
    "Débits": "Debits", "Télécom": "Telecom",
    "Supermarché": "Supermarket", "Livré": "Delivered",
    "Intérêts": "Interests", "Période": "Period",
    "Coût": "Cost", "Thème": "Theme",
    
    // More domain words
    "Confidentialité": "Privacy", "Sécurité": "Security",
    "Spécialité": "Specialty", "Spécialités": "Specialties",
    "Spécialiste": "Specialist", "Spécialistes": "Specialists",
    "Généraliste": "General practitioner", "Urgences": "Emergency",
    "Chirurgie": "Surgery", "Pédiatrie": "Pediatrics",
    "Gynécologie": "Gynecology", "Cardiologie": "Cardiology",
    "Dermatologie": "Dermatology", "Ophtalmologie": "Ophthalmology",
    "Orthopédie": "Orthopedics", "Radiologie": "Radiology",
    "Échographie": "Ultrasound", "Biologie": "Biology",
    "Hématologie": "Hematology", "Biochimie": "Biochemistry",
    "Immunologie": "Immunology", "Microbiologie": "Microbiology",
    "Pathologie": "Pathology", "Anatomie": "Anatomy",
    "Physiologie": "Physiology", "Neurologie": "Neurology",
    "Psychiatrie": "Psychiatry", "Kinésithérapie": "Physiotherapy",
    "Ostéopathie": "Osteopathy", "Diététique": "Dietetics",
    "Réanimation": "Resuscitation", "Anesthésie": "Anesthesia",
    "Stérilisation": "Sterilization", "Désinfection": "Disinfection",
    "Médicaments": "Medications", "Médicament": "Medication",
    "Ordonnance": "Prescription", "Posologie": "Dosage",
    "Comprimé": "Tablet", "Comprimés": "Tablets",
    "Gélule": "Capsule", "Gélules": "Capsules",
    "Sirop": "Syrup", "Pommade": "Ointment",
    "Crème": "Cream", "Injection": "Injection",
    "Vaccin": "Vaccine", "Vaccins": "Vaccines",
    "Symptômes": "Symptoms", "Symptôme": "Symptom",
    "Diagnostic": "Diagnosis", "Pronostic": "Prognosis",
    "Traitement": "Treatment", "Thérapie": "Therapy",
    "Allergie": "Allergy", "Allergies": "Allergies",
    "Diabète": "Diabetes", "Hypertension": "Hypertension",
    "Grossesse": "Pregnancy", "Accouchement": "Childbirth",
    "Césarienne": "Cesarean", "Pédiatre": "Pediatrician",
    "Néonatalogie": "Neonatology", "Maternité": "Maternity",
    
    // Real estate
    "Appartement": "Apartment", "Maison": "House",
    "Villa": "Villa", "Studio": "Studio",
    "Chambre": "Room", "Chambres": "Rooms",
    "Salon": "Living room", "Cuisine": "Kitchen",
    "Salle de bain": "Bathroom", "Toilettes": "Toilet",
    "Balcon": "Balcony", "Terrasse": "Terrace",
    "Jardin": "Garden", "Garage": "Garage",
    "Parking": "Parking", "Piscine": "Pool",
    "Étage": "Floor", "Étages": "Floors",
    "Loyer": "Rent", "Caution": "Deposit",
    "Meublé": "Furnished", "Équipé": "Equipped",
    "Climatisé": "Air-conditioned", "Clôturé": "Fenced",
    "Sécurisé": "Secured", "Résidence": "Residence",
    "Immeuble": "Building", "Quartier": "Neighborhood",
    "Superficie": "Area", "Pièces": "Rooms",
    "Propriétaire": "Owner", "Locataire": "Tenant",
    "Gérant": "Manager", "Syndic": "Property manager",
    
    // Transport
    "Itinéraire": "Route", "Destination": "Destination",
    "Départ": "Departure", "Arrivée": "Arrival",
    "Arrêt": "Stop", "Arrêts": "Stops",
    "Gare": "Station", "Aéroport": "Airport",
    "Véhicule": "Vehicle", "Véhicules": "Vehicles",
    "Moto": "Motorcycle", "Camion": "Truck",
    "Fourgon": "Van", "Remorque": "Trailer",
    "Carburant": "Fuel", "Essence": "Gasoline",
    "Gazole": "Diesel", "Péage": "Toll",
    "Embouteillage": "Traffic jam", "Déviation": "Detour",
    "Raccourci": "Shortcut", "Autoroute": "Highway",
    "Nationale": "National road", "Départementale": "County road",
    "Kilomètre": "Kilometer", "Kilomètres": "Kilometers",
    "Vitesse": "Speed", "Accélération": "Acceleration",
    "Freinage": "Braking", "Stationnement": "Parking",
    "Immatriculation": "Registration", "Permis": "License",
    "Assurance": "Insurance", "Contrôle": "Inspection",
    "Réparation": "Repair", "Entretien": "Maintenance",
    "Vidange": "Oil change", "Pneumatique": "Tire",
    "Pneumatiques": "Tires",
    
    // Food / Commerce
    "Boulangerie": "Bakery", "Pâtisserie": "Pastry shop",
    "Boucherie": "Butcher shop", "Poissonnerie": "Fish shop",
    "Épicerie": "Grocery store", "Traiteur": "Caterer",
    "Alimentaire": "Food", "Boisson": "Beverage",
    "Boissons": "Beverages", "Dessert": "Dessert",
    "Entrée": "Starter", "Plat": "Main course",
    "Recette": "Recipe", "Recettes": "Recipes",
    "Préparation": "Preparation", "Cuisson": "Cooking",
    "Ingrédient": "Ingredient", "Portion": "Serving",
    "Calories": "Calories", "Glucides": "Carbs",
    "Lipides": "Fats", "Fibres": "Fiber",
    "Vitamines": "Vitamins", "Minéraux": "Minerals",
    
    // Finance
    "Facture": "Invoice", "Reçu": "Receipt",
    "Devis": "Quote", "Remise": "Discount",
    "Réduction": "Discount", "Solde": "Balance",
    "Crédit": "Credit", "Débit": "Debit",
    "Virement": "Transfer", "Retrait": "Withdrawal",
    "Dépôt": "Deposit", "Épargne": "Savings",
    "Intérêt": "Interest", "Intérêts": "Interest",
    "Bénéfice": "Profit", "Déficit": "Deficit",
    "Impôt": "Tax", "Impôts": "Taxes",
    "TVA": "VAT", "HT": "Excl. tax", "TTC": "Incl. tax",
    "Devise": "Currency", "Taux": "Rate",
    "Monnaie": "Currency", "Espèces": "Cash",
    "Chèque": "Check", "Virement bancaire": "Bank transfer",
    
    // Education
    "Élève": "Student", "Élèves": "Students",
    "Étudiant": "Student", "Étudiants": "Students",
    "Professeur": "Teacher", "Enseignant": "Teacher",
    "Directeur": "Director", "Proviseur": "Principal",
    "Classe": "Class", "Matière": "Subject",
    "Matières": "Subjects", "Examen": "Exam",
    "Diplôme": "Diploma", "Diplômes": "Diplomas",
    "Baccalauréat": "Baccalaureate", "Licence": "Bachelor",
    "Maîtrise": "Master's", "Doctorat": "Doctorate",
    "Formation": "Training", "Apprentissage": "Learning",
    "Révision": "Review", "Exercice": "Exercise",
    "Dictée": "Dictation", "Rédaction": "Writing",
    "Bibliothèque": "Library", "Librairie": "Bookstore",
    "Cahier": "Notebook", "Crayon": "Pencil",
    "Stylo": "Pen", "Cartable": "School bag",
    "Rentrée": "Back to school", "Vacances": "Holidays",
    "Trimestre": "Quarter", "Semestre": "Semester",
    "Année scolaire": "School year", "Programme": "Program",
    "Mathématiques": "Mathematics", "Sciences": "Sciences",
    "Histoire": "History", "Géographie": "Geography",
    "Littérature": "Literature", "Philosophie": "Philosophy",
    "Physique": "Physics", "Chimie": "Chemistry",
    "Informatique": "Computer science", "Technologie": "Technology",
    "Économie": "Economics", "Comptabilité": "Accounting",
    "Gestion": "Management", "Commerce": "Commerce",
    "6ème": "6th grade", "5ème": "5th grade",
    "4ème": "4th grade", "3ème": "3rd grade",
    "Seconde": "10th grade", "Première": "11th grade",
    "Terminale": "12th grade",
    
    // Common UI / general words
    "Récapitulatif": "Summary", "Récapitulation": "Recap",
    "Détaillé": "Detailed", "Détaillée": "Detailed",
    "Résumé": "Summary", "Aperçu": "Preview",
    "Formulaire": "Form", "Champ": "Field",
    "Saisie": "Input", "Entrée": "Entry",
    "Sortie": "Exit", "Début": "Start", "Fin": "End",
    "Création": "Creation", "Édition": "Editing",
    "Suppression": "Deletion", "Ajout": "Addition",
    "Mise": "Setting", "Accès": "Access",
    "Identifiant": "Identifier", "Clé": "Key",
    "Valeur": "Value", "Libellé": "Label",
    "Intitulé": "Title", "Référence": "Reference",
    "Numéro": "Number", "Code": "Code",
    "Catégorie": "Category", "Sous-catégorie": "Subcategory",
    "Étiquette": "Tag", "Balise": "Tag",
    "Filtre": "Filter", "Tri": "Sort",
    "Recherche": "Search", "Résultat": "Result",
    "Sélection": "Selection", "Option": "Option",
    "Choix": "Choice", "Préférence": "Preference",
    "Priorité": "Priority", "Urgence": "Urgency",
    "Criticité": "Criticality", "Sévérité": "Severity",
    "Fréquence": "Frequency", "Récurrence": "Recurrence",
    "Périodicité": "Periodicity", "Durée": "Duration",
    "Délai": "Delay", "Échéance": "Deadline",
    "Validité": "Validity", "Expiration": "Expiration",
    "Activité": "Activity", "Activités": "Activities",
    "Opération": "Operation", "Opérations": "Operations",
    "Fonctionnalité": "Feature", "Fonctionnalités": "Features",
    "Caractéristique": "Characteristic", "Spécification": "Specification",
    "Exigence": "Requirement", "Critère": "Criterion",
    "Critères": "Criteria", "Règle": "Rule",
    "Procédure": "Procedure", "Processus": "Process",
    "Étapes": "Steps", "Flux": "Flow",
    "Progression": "Progress", "Avancement": "Progress",
    "État": "Status", "Statut": "Status",
    "Disponibilité": "Availability",
    "Fiabilité": "Reliability", "Performance": "Performance",
    "Efficacité": "Efficiency", "Productivité": "Productivity",
    "Stabilité": "Stability", "Scalabilité": "Scalability",
    "Sûreté": "Safety", "Confidentialité": "Privacy",
    "Intégrité": "Integrity", "Authenticité": "Authenticity",
    "Conformité": "Compliance", "Légalité": "Legality",
    "Évaluation": "Evaluation", "Vérification": "Verification",
    "Validation": "Validation", "Approbation": "Approval",
    "Autorisation": "Authorization", "Habilitation": "Clearance",
    "Certification": "Certification", "Accréditation": "Accreditation",
    "Décision": "Decision", "Résolution": "Resolution",
    "Solution": "Solution", "Recommandation": "Recommendation",
    "Suggestion": "Suggestion", "Proposition": "Proposal",
    "Demande": "Request", "Réclamation": "Claim",
    "Signalement": "Report", "Incident": "Incident",
    "Problème": "Problem", "Anomalie": "Anomaly",
    "Défaut": "Defect", "Panne": "Breakdown",
    "Réparation": "Repair", "Maintenance": "Maintenance",
    "Amélioration": "Improvement", "Optimisation": "Optimization",
    "Personnalisation": "Customization", "Configuration": "Configuration",
    "Paramétrage": "Setup", "Calibrage": "Calibration",
    "Initialisation": "Initialization", "Démarrage": "Startup",
    "Redémarrage": "Restart", "Arrêt": "Stop",
    "Suspension": "Suspension", "Reprise": "Resume",
    "Relance": "Relaunch", "Actualisation": "Refresh",
    "Synchronisation": "Synchronization", "Sauvegarde": "Backup",
    "Restauration": "Restoration", "Migration": "Migration",
    "Importation": "Import", "Exportation": "Export",
    "Téléchargement": "Download", "Téléversement": "Upload",
    "Envoi": "Sending", "Réception": "Reception",
    "Distribution": "Distribution", "Diffusion": "Broadcast",
    "Publication": "Publication", "Notification": "Notification",
    "Rappel": "Reminder", "Relance": "Follow-up",
    "Abonnement": "Subscription", "Désabonnement": "Unsubscription",
    "Adhésion": "Membership", "Affiliation": "Affiliation",
    "Parrainage": "Sponsorship", "Fidélité": "Loyalty",
    "Récompense": "Reward", "Récompenses": "Rewards",
    "Badge": "Badge", "Badges": "Badges",
    "Niveau": "Level", "Niveaux": "Levels",
    "Classement": "Ranking", "Palmarès": "Leaderboard",
    "Objectif": "Goal", "Objectifs": "Goals",
    "Défi": "Challenge", "Défis": "Challenges",
    "Mission": "Mission", "Quête": "Quest",
    "Tâche": "Task", "Tâches": "Tasks",
    "Projet": "Project", "Projets": "Projects",
    "Programme": "Program", "Campagne": "Campaign",
    "Événement": "Event", "Événements": "Events",
    "Réunion": "Meeting", "Rendez-vous": "Appointment",
    "Séance": "Session", "Séances": "Sessions",
    "Cours": "Course", "Leçon": "Lesson",
    "Tutoriel": "Tutorial", "Guide": "Guide",
    "Documentation": "Documentation", "Manuel": "Manual",
    "Référence": "Reference",
    
    // Misc common
    "Donner": "Give", "Donne": "Gives", "Donné": "Given",
    "Recevoir": "Receive", "Reçu": "Received",
    "Acheter": "Buy", "Acheté": "Bought",
    "Vendre": "Sell", "Vendu": "Sold",
    "Louer": "Rent", "Loué": "Rented",
    "Échanger": "Exchange", "Échangé": "Exchanged",
    "Retourner": "Return", "Retourné": "Returned",
    "Livrer": "Deliver", "Livré": "Delivered",
    "Expédier": "Ship", "Expédié": "Shipped",
    "Récupérer": "Retrieve", "Récupéré": "Retrieved",
    "Ramasser": "Pick up", "Déposer": "Drop off",
    "Installer": "Install", "Installé": "Installed",
    "Configurer": "Configure", "Configuré": "Configured",
    "Activer": "Activate", "Activé": "Activated",
    "Désactiver": "Disable", "Désactivé": "Disabled",
    "Suspendre": "Suspend", "Suspendu": "Suspended",
    "Réactiver": "Reactivate", "Réactivé": "Reactivated",
    "Bloquer": "Block", "Bloqué": "Blocked",
    "Débloquer": "Unblock", "Débloqué": "Unblocked",
    "Vérifier": "Verify", "Vérifié": "Verified",
    "Certifier": "Certify", "Certifié": "Certified",
    "Valider": "Validate", "Validé": "Validated",
    "Approuver": "Approve", "Approuvé": "Approved",
    "Rejeter": "Reject", "Rejeté": "Rejected",
    "Accepter": "Accept", "Accepté": "Accepted",
    "Refuser": "Decline", "Refusé": "Declined",
    "Confirmer": "Confirm", "Confirmé": "Confirmed",
    "Annuler": "Cancel", "Annulé": "Cancelled",
    "Terminer": "Complete", "Terminé": "Completed",
    "Échouer": "Fail", "Échoué": "Failed",
    "Réussir": "Succeed", "Réussi": "Successful",
    "Commencer": "Begin", "Commencé": "Started",
    "Finir": "Finish", "Fini": "Finished",
    "Continuer": "Continue", "Poursuivre": "Continue",
    "Reprendre": "Resume", "Reprendre": "Resume",
    "Interrompre": "Interrupt", "Interrompu": "Interrupted",
    "Relancer": "Relaunch", "Relancé": "Relaunched",
    "Rafraîchir": "Refresh", "Rafraîchi": "Refreshed",
    "Actualiser": "Update", "Actualisé": "Updated",
    "Sauvegarder": "Save", "Sauvegardé": "Saved",
    "Exporter": "Export", "Exporté": "Exported",
    "Importer": "Import", "Importé": "Imported",
    "Copier": "Copy", "Copié": "Copied",
    "Coller": "Paste", "Collé": "Pasted",
    "Déplacer": "Move", "Déplacé": "Moved",
    "Renommer": "Rename", "Renommé": "Renamed",
    "Dupliquer": "Duplicate", "Dupliqué": "Duplicated",
    "Archiver": "Archive", "Archivé": "Archived",
    "Partager": "Share", "Partagé": "Shared",
    "Publier": "Publish", "Publié": "Published",
    "Dépublier": "Unpublish", "Masquer": "Hide", "Masqué": "Hidden",
    "Afficher": "Display", "Affiché": "Displayed",
    "Trier": "Sort", "Trié": "Sorted",
    "Filtrer": "Filter", "Filtré": "Filtered",
    "Grouper": "Group", "Groupé": "Grouped",
    "Séparer": "Separate", "Séparé": "Separated",
    "Fusionner": "Merge", "Fusionné": "Merged",
    "Diviser": "Divide", "Divisé": "Divided",
    "Agrandir": "Enlarge", "Agrandi": "Enlarged",
    "Réduire": "Reduce", "Réduit": "Reduced",
    "Zoomer": "Zoom in", "Dézoomer": "Zoom out",
    "Pivoter": "Rotate", "Pivoté": "Rotated",
    "Redimensionner": "Resize", "Recadrer": "Crop",
    
    // Emojis prefix patterns - we skip these, just translate the text
    "pied": "foot", "À pied": "On foot",
};

function translateValue(frText) {
    if (!frText || typeof frText !== 'string') return frText;
    
    // Skip if contains {{interpolation}} placeholders — translate the static parts only
    let result = frText;
    
    // Remove emoji prefixes for matching, then restore
    const emojiPrefix = result.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{2702}-\u{27B0}\u{E000}-\u{F8FF}✅❌⚠️🔒🛡️🔄🌐📝🫀🎯🎚️👁️🏆✏️📍📋🌱🏥]+\s*)/u);
    let prefix = '';
    if (emojiPrefix) {
        prefix = emojiPrefix[1];
        result = result.substring(prefix.length);
    }
    
    // Build sorted entries (longest first)
    const allEntries = [...Object.entries(dict), ...Object.entries(wordDict)]
        .sort((a, b) => b[0].length - a[0].length);
    
    // Try exact match first
    for (const [fr, en] of allEntries) {
        if (result === fr) return prefix + en;
        if (result.toLowerCase() === fr.toLowerCase()) {
            return prefix + (result[0] === result[0].toUpperCase() ? en.charAt(0).toUpperCase() + en.slice(1) : en);
        }
    }
    
    // Phrase-level replacements
    for (const [fr, en] of allEntries) {
        if (fr.length < 3) continue; // Skip tiny words for phrase matching
        const escaped = fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        result = result.replace(regex, (match) => {
            if (match[0] === match[0].toUpperCase() && en[0] === en[0].toLowerCase()) {
                return en.charAt(0).toUpperCase() + en.slice(1);
            }
            if (match === match.toLowerCase()) return en.toLowerCase();
            return en;
        });
    }
    
    // Common French patterns
    result = result.replace(/\bl'/gi, 'the ');
    result = result.replace(/\bd'/gi, 'of ');
    result = result.replace(/\bn'/gi, 'not ');
    result = result.replace(/\bs'/gi, '');
    result = result.replace(/\bqu'/gi, 'that ');
    result = result.replace(/\bà\b/gi, 'to');
    result = result.replace(/\best\b/gi, 'is');
    result = result.replace(/\bsont\b/gi, 'are');
    result = result.replace(/\bpas\b/gi, 'not');
    result = result.replace(/\bne\b/gi, '');
    result = result.replace(/\ble\b/gi, 'the');
    result = result.replace(/\bla\b/gi, 'the');
    result = result.replace(/\bles\b/gi, 'the');
    result = result.replace(/\bun\b/gi, 'a');
    result = result.replace(/\bune\b/gi, 'a');
    result = result.replace(/\bdes\b/gi, 'some');
    result = result.replace(/\bdu\b/gi, 'of the');
    result = result.replace(/\bde\b/gi, 'of');
    result = result.replace(/\bet\b/gi, 'and');
    result = result.replace(/\bou\b/gi, 'or');
    result = result.replace(/\ben\b/gi, 'in');
    result = result.replace(/\bau\b/gi, 'at the');
    result = result.replace(/\baux\b/gi, 'at the');
    result = result.replace(/\bsur\b/gi, 'on');
    result = result.replace(/\bdans\b/gi, 'in');
    result = result.replace(/\bpar\b/gi, 'by');
    result = result.replace(/\bpour\b/gi, 'for');
    result = result.replace(/\bavec\b/gi, 'with');
    result = result.replace(/\bsans\b/gi, 'without');
    result = result.replace(/\bvotre\b/gi, 'your');
    result = result.replace(/\bvos\b/gi, 'your');
    result = result.replace(/\bnotre\b/gi, 'our');
    result = result.replace(/\bnos\b/gi, 'our');
    result = result.replace(/\bmon\b/gi, 'my');
    result = result.replace(/\bma\b/gi, 'my');
    result = result.replace(/\bmes\b/gi, 'my');
    result = result.replace(/\bce\b/gi, 'this');
    result = result.replace(/\bcet\b/gi, 'this');
    result = result.replace(/\bcette\b/gi, 'this');
    result = result.replace(/\bces\b/gi, 'these');
    result = result.replace(/\bplus\b/gi, 'more');
    result = result.replace(/\bmoins\b/gi, 'less');
    result = result.replace(/\btrès\b/gi, 'very');
    result = result.replace(/\bbien\b/gi, 'well');
    
    // Clean up multiple spaces
    result = result.replace(/\s+/g, ' ').trim();
    
    return prefix + result;
}

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;

let translated = 0;

for (const ns of Object.keys(fr)) {
    if (!en[ns]) en[ns] = {};
    for (const key of Object.keys(fr[ns])) {
        const frVal = fr[ns][key];
        const enVal = en[ns]?.[key];
        
        if (enVal === undefined) {
            en[ns][key] = translateValue(frVal);
            translated++;
            continue;
        }
        
        // Only translate if EN is still exact copy of FR AND contains French chars
        if (enVal !== frVal) continue;
        if (!frChars.test(frVal)) continue;
        
        const newEn = translateValue(frVal);
        if (newEn !== frVal) {
            en[ns][key] = newEn;
            translated++;
        }
    }
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

// Count remaining
let copies = 0;
for (const ns of Object.keys(fr)) {
    for (const key of Object.keys(fr[ns])) {
        if (en[ns]?.[key] === fr[ns][key] && frChars.test(fr[ns][key])) copies++;
    }
}

console.log('\n=== EN Translation V2 Results ===');
console.log('Keys translated:', translated);
console.log('Remaining FR copies in EN:', copies);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
