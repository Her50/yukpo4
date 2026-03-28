# -*- coding: utf-8 -*-
"""Données des tableaux — textes vulgarisés, déploiement, liens officiels."""
from __future__ import annotations

def industry_plastic() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Les défauts visibles sur les pièces (fissures, bulles) sont repérés trop tard : tout un lot peut être jeté.",
            "Le système regarde chaque pièce comme un contrôleur : il dit « OK » ou « à vérifier » et alerte avant d'expédier.",
            "Caméra au-dessus du tapis ou du poste contrôle ; ordinateur industriel ou petit calculateur branché au réseau d'atelier (souvent en local pour la vitesse).",
            "Cognex VisionPro Deep Learning",
            "https://www.cognex.com/products/deep-learning",
            "Payant / industrie",
        ),
        (
            "Les machines tournent « normalement » puis cassent sans prévenir : arrêt brutal et réparation coûteuse.",
            "Le logiciel lit en continu capteurs (vibration, température) et signale un comportement anormal avant la panne.",
            "Capteurs existants reliés à un service cloud ou un serveur interne ; alertes vers maintenance (e-mail, tableau de bord).",
            "Microsoft Azure AI Anomaly Detector",
            "https://azure.microsoft.com/en-us/products/ai-services/ai-anomaly-detector",
            "Payant à l'usage (Azure)",
        ),
        (
            "Régler température et vitesse à l'essai, c'est long et coûteux à chaque nouveau produit.",
            "Le système propose des réglages à partir des données passées : moins d'essais au hasard, moins de rebut.",
            "Données d'usine importées dans la plateforme cloud ; essais pilotes puis recommandations (équipe technique valide).",
            "Google Cloud Vertex AI",
            "https://cloud.google.com/vertex-ai?hl=fr",
            "Payant (GCP)",
        ),
        (
            "Contrôler à l'œil 100 % des pièces, c'est impossible toute la journée sans se tromper.",
            "Un modèle entraîné sur vos photos repère les micro-défauts et les regroupe par type pour agir sur la chaîne.",
            "Images envoyées au cloud AWS ou caméra edge ; intégration possible à MES / base qualité.",
            "AWS Lookout for Vision",
            "https://aws.amazon.com/lookout-for-vision/",
            "Payant (AWS)",
        ),
        (
            "Pas d'équipe « data » pour coder un outil sur mesure : besoin d'étiqueter et tester vite.",
            "Interface web : on charge des images, on entraîne, on déploie une API ou une petite caméra intelligente.",
            "Navigateur + compte ; déploiement sur poste, Raspberry ou serveur selon l'offre.",
            "Roboflow",
            "https://roboflow.com",
            "Freemium / payant",
        ),
    ]


def doctor_gp() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Après chaque consultation, taper le compte rendu au clavier prend du temps et éloigne du patient.",
            "L'outil écoute (micro) et propose un texte structuré : le médecin relit et signe avant d'enregistrer.",
            "Micro au cabinet ou salle ; logiciel sur poste sécurisé ou offre hôpital — déploiement par l'IT selon contrat.",
            "Microsoft Dragon Ambient eXperience",
            "https://www.nuance.com/healthcare.html",
            "Payant / établissement ou offre pro",
        ),
        (
            "Rédiger courriers et synthèses pour les confrères : charge mentale élevée.",
            "Assistant texte spécialisé santé : premiers jets à partir du contexte — données anonymisées, relecture obligatoire.",
            "Application web ou intégration dossier patient (selon offre) ; usage sous contrat HDS / employeur.",
            "Nabla Copilot",
            "https://www.nabla.com",
            "Pro / essai — usage encadré",
        ),
        (
            "Le patient ne comprend pas les termes médicaux ; il faut reformuler simplement sans déformer le sens.",
            "Reformulation de texte à niveau de langage adapté — le médecin valide le fond.",
            "Application web grand public ou API ; ne jamais y coller d'identité réelle sans cadre.",
            "ChatGPT (usage prudent, anonymisé)",
            "https://chat.openai.com",
            "Freemium",
        ),
        (
            "La paperasse réduit le temps d'écoute au fil des semaines.",
            "Dictée intelligente : le logiciel remplit les champs habituels du dossier pour signature.",
            "App mobile / web connectée au DMP ou dossier selon intégration entreprise.",
            "Suki",
            "https://www.suki.ai/",
            "Payant / organisation",
        ),
        (
            "Une radiographie thorax est lue vite : un oubli ou un doute peut retarder une orientation.",
            "Logiciel d'aide à la lecture : il surligne des zones à risque sur l'image — la décision reste médicale.",
            "Serveur hôpital ou cloud agréé ; intégration PACS / RIS selon pays et marquage CE / FDA des produits.",
            "Qure.ai",
            "https://qure.ai",
            "Payant / institution",
        ),
        (
            "Le médecin veut un ordre d'idées avant d'affiner : symptômes flous, plusieurs causes possibles.",
            "Moteur de questions / diagnostics différentiels à partir de signes — liste d'hypothèses à confronter au dossier réel.",
            "Site web ou intégration cabinet ; ne remplace pas l'examen — l'intention est d'organiser la réflexion.",
            "Isabel Healthcare",
            "https://www.isabelhealthcare.com/",
            "Payant / pro",
        ),
        (
            "Dépistage de la rétinopathie diabétique en première ligne : file d'attente ophtalmologue longue.",
            "Caméra rétine + logiciel classe « envoyer en urgence » ou « suivi classique » — selon dispositif homologué localement.",
            "Appareil photo rétinien branché sur PC avec logiciel certifié ; workflow défini par l'établissement.",
            "Digital Diagnostics",
            "https://www.digitaldiagnostics.com/",
            "Payant / réseau de soins",
        ),
    ]


def surgeon() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Avant une opération, mesurer et segmenter organes sur scanner prend du temps et varie selon qui le fait.",
            "Le logiciel découpe l'image 3D et prépare un modèle pour le bloc — le chirurgien valide le plan.",
            "Poste de travail avec logiciel certifié ; données DICOM depuis le PACS hospitalier.",
            "Materialise Mimics",
            "https://www.materialise.com/en/medical/mimics",
            "Payant / hôpital",
        ),
        (
            "Un AVC ou une grosse lésion vasculaire : il faut mobiliser l'équipe tout de suite.",
            "L'IA analyse l'image et envoie une alerte sur téléphone/tablette de l'équipe selon protocole hôpital.",
            "Intégration PACS + messagerie sécurisée ; déploiement réseau de soins.",
            "Viz.ai",
            "https://www.viz.ai",
            "Payant / réseau de soins",
        ),
        (
            "Savoir si le bloc tourne « bien » (temps, matériel) est flou sans tableau de bord.",
            "Tableaux de bord et analyses à partir des flux du bloc (données anonymisées) pour améliorer l'organisation.",
            "Passerelle vers données bloc + serveur hôpital ; projet avec direction et DSI.",
            "Caresyntax",
            "https://caresyntax.com",
            "Payant / hôpital",
        ),
        (
            "Trop d'images à lire : les urgences peuvent attendre derrière des examens moins graves.",
            "L'IA classe les examens pour que le radiologue traite d'abord les cas signalés comme critiques (selon produit).",
            "Routeur d'examens sur serveur imagerie ; connexion au PACS.",
            "Aidoc",
            "https://www.aidoc.com/",
            "Payant / réseau de soins",
        ),
    ]


def legal_insurance() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Un contrat de dizaines de pages : risque de passer à côté d'une clause importante.",
            "Le logiciel surligne et score les clauses sensibles pour prioriser la lecture humaine.",
            "Navigateur SaaS ou intégration SharePoint ; compte entreprise.",
            "LawGeex",
            "https://www.lawgeex.com",
            "Payant / entreprise",
        ),
        (
            "La réglementation change souvent : difficile de tout suivre à la main.",
            "Recherche en langage naturel et alertes sur textes officiels (selon abonnement).",
            "Web + compte LexisNexis ; souvent lien avec base documentaire interne.",
            "Lexis+ (LexisNexis)",
            "https://www.lexisnexis.com",
            "Payant",
        ),
        (
            "Besoin d'un premier plan avant la revue détaillée d'un dossier long.",
            "Grand modèle de langage : résumés et plans — chaque citation doit être revérée à la source.",
            "Site web Claude ; copier-coller sans données personnelles hors cadre.",
            "Claude",
            "https://claude.ai",
            "Freemium / payant",
        ),
        (
            "Beaucoup de contrats se ressemblent mais diffèrent sur un mot : les comparer à la main est long.",
            "Extraction et alignement de clauses pour comparaison rapide — validation juridique finale.",
            "Cloud Litera ; import de contrats PDF/Word.",
            "Kira (Litera)",
            "https://kira.litera.com/",
            "Payant / entreprise",
        ),
    ]


def lawyer() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Trouver la bonne décision de justice avec des mots du quotidien plutôt que des codes juridiques.",
            "Assistant posé sur les bases payantes LexisNexis — réponses avec références à vérifier.",
            "Application web cabinet avec abonnement base de données.",
            "LexisNexis CoCounsel",
            "https://www.lexisnexis.com/en-us/products/cocounsel",
            "Payant / cabinet",
        ),
        (
            "Dossiers de centaines de pages à résumer pour audience.",
            "Résumés et extraction assistés par IA — relecture et citation au dossier obligatoires.",
            "Web Harvey (invitation cabinet).",
            "Harvey",
            "https://www.harvey.ai",
            "Payant / cabinet",
        ),
        (
            "Premier jet de chronologie ou de mémoire pour gagner du temps.",
            "Génération de texte — données anonymisées ; secret professionnel : cadre cabinet / pas de données clients sur outils grand public sans accord.",
            "Navigateur web ; ne pas y coller de données identifiables sans accord.",
            "ChatGPT",
            "https://chat.openai.com",
            "Freemium",
        ),
        (
            "Question juridique posée comme à un collègue.",
            "Recherche sémantique sur jurisprudence (selon base Thomson Reuters).",
            "Abonnement Thomson Reuters ; application web cabinet.",
            "Casetext",
            "https://casetext.com/",
            "Payant / cabinet",
        ),
    ]


def med_rep() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Préparer une visite : trouver vite les articles qui vont dans le sens de la discussion.",
            "Moteur de recherche orienté articles scientifiques avec extraits synthétiques — vérifier les sources.",
            "Site web Consensus.",
            "Consensus",
            "https://consensus.app",
            "Freemium",
        ),
        (
            "Lire dix résumés d'études pour une réunion le lendemain.",
            "Tableur de questions sur la littérature — chaque chiffre doit être recoupé sur l'article original.",
            "Web Elicit.",
            "Elicit",
            "https://elicit.com",
            "Freemium / abonnement",
        ),
        (
            "Aligner le discours avec ce que fait réellement le terrain (CRM).",
            "Suggestions « prochaine action » et scoring intégrés au CRM pharma (déploiement entreprise).",
            "Instance entreprise Veeva ; intégration IT pharma.",
            "Veeva CRM",
            "https://www.veeva.com",
            "Payant / entreprise",
        ),
        (
            "Voir qui cite qui dans un domaine pour ne pas lire dans le désordre.",
            "Carte de citations et résumés — point d'entrée vers PubMed.",
            "Site web Semantic Scholar.",
            "Semantic Scholar",
            "https://www.semanticscholar.org/",
            "Gratuit",
        ),
    ]


def marketing_telco() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Dépenser en publicité sans savoir quelle combinaison fonctionne vraiment.",
            "Campagne pilotée par algorithmes sur objectifs (Google Ads).",
            "Compte Google Ads ; liaison compte et budgets.",
            "Google Ads Performance Max",
            "https://ads.google.com",
            "Payant (budget pub)",
        ),
        (
            "Créer beaucoup de visuels publicitaires prend du temps créatif.",
            "Génération et variation d'images à partir de consignes texte (Adobe).",
            "Creative Cloud / navigateur selon offre Firefly.",
            "Adobe Firefly",
            "https://www.adobe.com/products/firefly.html",
            "Souvent abonnement Creative Cloud",
        ),
        (
            "Savoir qui rappeler en priorité parmi les prospects.",
            "Scores et suggestions dans le CRM (HubSpot).",
            "HubSpot connecté au site et aux campagnes.",
            "HubSpot AI (Breeze)",
            "https://www.hubspot.com/products/artificial-intelligence",
            "Freemium / payant",
        ),
        (
            "Grands comptes : quel geste commercial au bon moment.",
            "Modèles prédictifs intégrés Salesforce (Einstein).",
            "Org Salesforce + données CRM.",
            "Salesforce Einstein",
            "https://www.salesforce.com/products/einstein-ai-solutions/",
            "Payant (Salesforce)",
        ),
    ]


def civil_engineer() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Planning de chantier qui se télescope : une retard en entraîne d'autres.",
            "Moteur d'optimisation de calendrier avec scénarios « et si… ».",
            "Import planning dans logiciel Alice (cloud projet).",
            "Alice Technologies",
            "https://www.alicetechnologies.com",
            "Payant / projet",
        ),
        (
            "Comparer ce qui est construit au plan sur le papier.",
            "Visite 360° + vision : repérer l'écart entre chantier et modèle.",
            "Casque / trépied + compte OpenSpace sur chantier.",
            "OpenSpace",
            "https://www.openspace.ai",
            "Payant / chantier",
        ),
        (
            "Comptes rendus de réunion et suivi de dossiers techniques.",
            "Copilot sur documents SharePoint / Teams (résumés, actions).",
            "Microsoft 365 avec Copilot activé.",
            "Microsoft Copilot (365)",
            "https://www.microsoft.com/microsoft-365/copilot",
            "Payant (365)",
        ),
        (
            "Savoir où en est le chantier par rapport au planning sans tout mesurer à la main.",
            "Vidéos / images comparées au modèle BIM pour estimer l'avancement.",
            "Caméras chantier + plateforme Buildots.",
            "Buildots",
            "https://www.buildots.com/",
            "Payant / grand chantier",
        ),
    ]


def claims_broker() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Des dossiers qui arrivent en masse : lesquels traiter en premier.",
            "Score de priorité et routage automatique vers la bonne équipe.",
            "API assureur + workflow Shift (cloud entreprise).",
            "Shift Technology",
            "https://www.shift-technology.com",
            "Payant / assureur",
        ),
        (
            "Repérer les déclarations douteuses sans tout auditer à la main.",
            "Modèles entraînés sur historiques de fraude et réseaux de liens.",
            "Intégration SI sinistres FRISS.",
            "FRISS",
            "https://www.friss.com",
            "Payant / entreprise",
        ),
        (
            "Pièces en photo ou PDF : tout retaper au clavier.",
            "Service Azure lit la mise en page et renvoie champs structurés vers votre logiciel métier.",
            "Abonnement Azure + connecteurs IT.",
            "Azure AI Document Intelligence",
            "https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence",
            "Payant (Azure)",
        ),
        (
            "Chiffrer un sinistre auto ou habitation à partir de photos.",
            "Estimation assistée par image pour accélérer la proposition d'indemnisation (validation humaine).",
            "API Tractable côté assureur ou appli démarche sinistre.",
            "Tractable",
            "https://tractable.ai/",
            "Payant / assurance",
        ),
    ]


def reinsurance() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Tarifer et segmenter les risques sur gros volumes.",
            "Modèles de tarification transparents (GLM + ML) intégrés au processus souscription.",
            "SaaS Akur8 ; données actuarielles importées.",
            "Akur8",
            "https://www.akur8.com",
            "Payant / assurance",
        ),
        (
            "Prototyper des modèles prédictifs sans tout coder à la main.",
            "AutoML H2O — export vers production.",
            "H2O Driverless AI (on-prem ou cloud).",
            "H2O Driverless AI",
            "https://h2o.ai/products/h2o-driverless-ai/",
            "Payant / data science",
        ),
        (
            "Comités : besoin d'expliquer les chiffres en langage clair.",
            "Copilot dans Power BI pour questions en langage naturel sur les rapports.",
            "Tenant Microsoft avec licence Copilot BI.",
            "Power BI",
            "https://powerbi.microsoft.com",
            "Selon licence Microsoft",
        ),
        (
            "Équipes actuariat / data / métier sur un même pipeline.",
            "Plateforme collaborative ML avec traçabilité des jeux de données et modèles.",
            "Dataiku sur cloud ou serveur entreprise.",
            "Dataiku",
            "https://www.dataiku.com/",
            "Payant / entreprise",
        ),
    ]


def data_scientist() -> list[tuple[str, str, str, str, str, str]]:
    return [
        (
            "Modèles classiques (régression, forêts) sur tableaux de chiffres.",
            "Bibliothèque Python standard pour entraîner et évaluer sur une seule API cohérente.",
            "Environnement Python (conda, venv) ; scripts ou notebooks.",
            "scikit-learn",
            "https://scikit-learn.org/stable/",
            "Open source",
        ),
        (
            "Aller vite sur des modèles prédictifs avec explication des variables.",
            "AutoML H2O open source ou cloud.",
            "Cluster ou H2O en local / cloud.",
            "H2O.ai",
            "https://h2o.ai",
            "Gratuit (open source) / payant cloud",
        ),
        (
            "Suivre les modèles en production (dérive, versions).",
            "MLflow : journalisation des runs et déploiement.",
            "Serveur MLflow ou Databricks / OSS.",
            "MLflow",
            "https://mlflow.org",
            "Open source",
        ),
        (
            "Réseaux de neurones recherche ou production.",
            "PyTorch : entraînement GPU, export ONNX.",
            "Python + CUDA sur station ou cloud.",
            "PyTorch",
            "https://pytorch.org",
            "Open source",
        ),
        (
            "Mise en production TensorFlow à grande échelle.",
            "TFX / Serving pour pipelines et API.",
            "Cluster Kubernetes ou cloud GCP.",
            "TensorFlow",
            "https://www.tensorflow.org/",
            "Open source",
        ),
    ]
