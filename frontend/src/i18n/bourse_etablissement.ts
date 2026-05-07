// ============================================================================
// i18n — Bourse du Livre + Pages Établissements
// ============================================================================
// Détection automatique de la langue système du téléphone via
// `i18next-browser-languagedetector` (déjà configuré dans `i18n/i18n.ts`).
// Ce module exporte les ressources de traduction et un helper pour la
// détection initiale, à fusionner dans la config i18next existante.
// ============================================================================

export type SupportedLng = 'fr' | 'en' | 'pt' | 'ar' | 'ff';

export const SUPPORTED_LNGS: SupportedLng[] = ['fr', 'en', 'pt', 'ar', 'ff'];

/** Détecte la langue préférée à partir de l'OS / navigateur du téléphone. */
export function detectDeviceLanguage(): SupportedLng {
  // 1. localStorage (préférence utilisateur)
  const saved = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('yukpo_lang')
    : null) as SupportedLng | null;
  if (saved && SUPPORTED_LNGS.includes(saved)) return saved;

  // 2. navigator.languages (langue système Android/iOS)
  const langs = (typeof navigator !== 'undefined' && navigator.languages) || [];
  for (const l of langs) {
    const short = l.toLowerCase().split('-')[0] as SupportedLng;
    if (SUPPORTED_LNGS.includes(short)) return short;
  }

  // 3. navigator.language fallback
  const single =
    (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().split('-')[0]) ||
    'fr';
  if (SUPPORTED_LNGS.includes(single as SupportedLng)) {
    return single as SupportedLng;
  }

  return 'fr';
}

/** Ressources i18n pour la Bourse du Livre + Pages Établissements. */
export const BOURSE_TRANSLATIONS: Record<SupportedLng, Record<string, any>> = {
  fr: {
    bourse: {
      home: {
        title: 'Bourse du Livre',
        subtitle: "Scannez votre liste — on s'occupe du reste.",
        scan_cta: 'Scanner ma liste',
        scan_description:
          "Prenez en photo la liste fournie par l'école. Yukpo extrait les manuels, cahiers et fournitures.",
        or: 'ou',
        partner_school_cta: 'Mon école est partenaire Yukpo',
        partner_school_description:
          "Trouvez votre école et accédez directement à la liste de votre classe.",
        librairie_portal: 'Espace Yukpo Librairie',
        etablissement_portal: 'Espace Yukpo Établissement',
        cart_count: 'Reprendre ma commande ({{count}})',
      },
      search: {
        title: 'Rechercher mon établissement',
        placeholder: 'Tapez le nom de votre école…',
        empty: 'Aucun établissement trouvé.',
        not_partner_yet:
          "Votre école n'est pas encore partenaire ? Demandez-lui de rejoindre Yukpo.",
        scan_fallback: 'Ou scannez directement la liste scolaire',
        loading: 'Recherche en cours…',
      },
      decision: {
        question: 'Que souhaitez-vous faire ?',
        order_books: 'Commander les manuels et fournitures',
        order_books_desc: 'Voir la liste de la classe et passer commande',
        view_infos: 'Voir les informations de l\'établissement',
        view_infos_desc:
          'Inscription, transport, cantine, activités, calendrier, contacts',
      },
      classe: {
        title: 'Sélectionnez la classe de votre enfant',
        no_class: 'Aucune classe disponible pour cet établissement.',
        primaire: 'Primaire',
        secondaire_1: 'Secondaire 1er cycle',
        secondaire_2: 'Secondaire 2nd cycle',
      },
      liste: {
        title_prefix: 'Liste',
        annee: 'Année 2026-2027',
        total_estime: 'Total estimé',
        commander: 'Commander et faire livrer',
        empty: 'Cette classe n\'a pas encore de liste publiée.',
      },
      infos: {
        sections: {
          inscription: 'Inscription & frais',
          transport: 'Transport scolaire',
          cantine: 'Cantine',
          perisco: 'Activités périscolaires',
          internat: 'Internat',
          uniforme: 'Uniforme',
          calendrier: "Calendrier de l'année",
          annonces: 'Tableau d\'affichage',
          contacts: 'Contacts utiles',
          laureats: 'Lauréats & bourses',
        },
        commander_shortcut: '→ Voir la liste scolaire et commander',
      },
    },
    etabAdmin: {
      portal: {
        title: 'Espace Établissement Yukpo',
        login_required: 'Connexion requise pour accéder à votre espace.',
        my_etabs: 'Mes établissements',
        no_etab: "Vous ne gérez encore aucun établissement.",
        claim_help: "Vous êtes administrateur ? Demandez à Yukpo le rattachement de votre établissement.",
      },
      dashboard: {
        page_url: 'URL publique',
        view_public: 'Voir la page publique',
        copy_link: 'Copier le lien',
        qr_code: 'QR code',
        download_qr: 'Télécharger le QR code',
        stats_30d: 'Statistiques 30 jours',
        visites: 'Visites',
        clics_commande: 'Clics commande',
        clics_infos: 'Clics infos',
        publish: 'Publier ma page',
        published: 'Page publiée',
        draft: 'Brouillon',
      },
      blocs: {
        edit: 'Éditer',
        active: 'Actif',
        inactive: 'Inactif',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        confirm_delete: 'Supprimer cet élément ?',
      },
    },
    common: {
      back: 'Retour',
      loading: 'Chargement…',
      error: 'Une erreur est survenue',
      retry: 'Réessayer',
      currency_xaf: 'FCFA',
    },
  },
  en: {
    bourse: {
      home: {
        title: 'Book Exchange',
        subtitle: "Scan your list — we'll handle the rest.",
        scan_cta: 'Scan my list',
        scan_description:
          "Take a photo of the school's list. Yukpo extracts textbooks, notebooks, and supplies.",
        or: 'or',
        partner_school_cta: 'My school is a Yukpo partner',
        partner_school_description:
          "Find your school and access your class's list directly.",
        librairie_portal: 'Yukpo Bookshop Area',
        etablissement_portal: 'Yukpo School Area',
        cart_count: 'Resume my order ({{count}})',
      },
      search: {
        title: 'Find my school',
        placeholder: 'Type your school name…',
        empty: 'No school found.',
        not_partner_yet:
          "Your school isn't a partner yet? Ask them to join Yukpo.",
        scan_fallback: 'Or scan the school list directly',
        loading: 'Searching…',
      },
      decision: {
        question: 'What would you like to do?',
        order_books: 'Order textbooks and supplies',
        order_books_desc: 'See the class list and place an order',
        view_infos: 'View school information',
        view_infos_desc:
          'Registration, transport, canteen, activities, calendar, contacts',
      },
      classe: {
        title: "Select your child's class",
        no_class: 'No class available for this school.',
        primaire: 'Primary',
        secondaire_1: 'Lower Secondary',
        secondaire_2: 'Upper Secondary',
      },
      liste: {
        title_prefix: 'List',
        annee: '2026-2027 academic year',
        total_estime: 'Estimated total',
        commander: 'Order and deliver',
        empty: 'This class has no published list yet.',
      },
      infos: {
        sections: {
          inscription: 'Registration & fees',
          transport: 'Transport',
          cantine: 'Canteen',
          perisco: 'Extracurricular activities',
          internat: 'Boarding',
          uniforme: 'Uniform',
          calendrier: 'Year calendar',
          annonces: 'Notice board',
          contacts: 'Useful contacts',
          laureats: 'Honor roll & scholarships',
        },
        commander_shortcut: '→ See school list and order',
      },
    },
    etabAdmin: {
      portal: {
        title: 'Yukpo School Area',
        login_required: 'Sign in required to access your area.',
        my_etabs: 'My schools',
        no_etab: 'You do not manage any school yet.',
        claim_help: 'Are you an administrator? Ask Yukpo to link your school.',
      },
      dashboard: {
        page_url: 'Public URL',
        view_public: 'View public page',
        copy_link: 'Copy link',
        qr_code: 'QR code',
        download_qr: 'Download QR code',
        stats_30d: '30-day stats',
        visites: 'Visits',
        clics_commande: 'Order clicks',
        clics_infos: 'Info clicks',
        publish: 'Publish my page',
        published: 'Page published',
        draft: 'Draft',
      },
      blocs: {
        edit: 'Edit',
        active: 'Active',
        inactive: 'Inactive',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        confirm_delete: 'Delete this item?',
      },
    },
    common: {
      back: 'Back',
      loading: 'Loading…',
      error: 'An error occurred',
      retry: 'Retry',
      currency_xaf: 'XAF',
    },
  },
  pt: {
    bourse: {
      home: {
        title: 'Bolsa do Livro',
        subtitle: 'Digitalize sua lista — cuidamos do resto.',
        scan_cta: 'Digitalizar minha lista',
        scan_description: 'Tire uma foto da lista escolar. O Yukpo extrai os livros e materiais.',
        or: 'ou',
        partner_school_cta: 'Minha escola é parceira Yukpo',
        partner_school_description: 'Encontre sua escola e acesse a lista da turma.',
        librairie_portal: 'Espaço Yukpo Livraria',
        etablissement_portal: 'Espaço Yukpo Escola',
        cart_count: 'Continuar meu pedido ({{count}})',
      },
      common: { back: 'Voltar', loading: 'Carregando…' },
    },
    common: { back: 'Voltar', loading: 'Carregando…', error: 'Erro', retry: 'Tentar novamente', currency_xaf: 'FCFA' },
  },
  ar: {
    bourse: {
      home: {
        title: 'بورصة الكتب',
        subtitle: 'امسح قائمتك ضوئيًا — سنتولى الباقي.',
        scan_cta: 'مسح قائمتي',
        scan_description: 'التقط صورة لقائمة المدرسة. يستخرج Yukpo الكتب واللوازم.',
        or: 'أو',
        partner_school_cta: 'مدرستي شريكة في Yukpo',
        partner_school_description: 'ابحث عن مدرستك وادخل قائمة الفصل.',
        librairie_portal: 'مساحة مكتبة Yukpo',
        etablissement_portal: 'مساحة مدرسة Yukpo',
      },
    },
    common: { back: 'رجوع', loading: 'جارٍ التحميل…', error: 'خطأ', retry: 'إعادة المحاولة', currency_xaf: 'FCFA' },
  },
  ff: {
    bourse: {
      home: {
        title: 'Tooytol Defte',
        subtitle: 'Skanner tooytol maa — min waawi heen.',
        scan_cta: 'Skanner tooytol',
        partner_school_cta: 'Jangirde am ko nde Yukpo',
        librairie_portal: 'Marse Yukpo Librairie',
        etablissement_portal: 'Marse Yukpo Jangirde',
      },
    },
    common: { back: 'Yiltude', loading: 'Tappa…', error: 'Juumre', retry: 'Filde', currency_xaf: 'FCFA' },
  },
};

/**
 * Helper pour fusionner les ressources Bourse dans la config i18next existante.
 * Appelé une fois au démarrage de l'app.
 */
export function registerBourseTranslations(i18n: any): void {
  for (const lng of SUPPORTED_LNGS) {
    i18n.addResourceBundle(lng, 'translation', BOURSE_TRANSLATIONS[lng], true, false);
  }
  // Active la langue détectée si différente de l'actuelle
  const detected = detectDeviceLanguage();
  if (i18n.language !== detected) {
    i18n.changeLanguage(detected);
  }
}
