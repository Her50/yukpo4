// Service de dictionnaire de traduction pour Yukpo
export interface LanguageDictionary {
  [key: string]: string;
}

export interface TranslationDictionaries {
  [languageCode: string]: LanguageDictionary;
}

export class DictionaryService {
  private static instance: DictionaryService;
  private dictionaries: TranslationDictionaries = {};
  private currentLanguage: string = 'fr';

  private constructor() {
    this.initializeDictionaries();
  }

  public static getInstance(): DictionaryService {
    if (!DictionaryService.instance) {
      DictionaryService.instance = new DictionaryService();
    }
    return DictionaryService.instance;
  }

  private initializeDictionaries() {
    // Dictionnaire français (langue de base)
    this.dictionaries.fr = {
      // Navigation et header
      'Accueil': 'Accueil',
      'Services': 'Services',
      'Mes services': 'Mes services',
      'Mon historique': 'Mon historique',
      'Paramètres': 'Paramètres',
      'Recharge tokens': 'Recharge tokens',
      'Déconnexion': 'Déconnexion',
      'Connexion': 'Connexion',
      'Inscription': 'Inscription',
      
      // Page d'accueil
      'Trouvez le service dont vous avez besoin': 'Trouvez le service dont vous avez besoin',
      'Rechercher un service...': 'Rechercher un service...',
      'Rechercher': 'Rechercher',
      'Catégories populaires': 'Catégories populaires',
      'Services récents': 'Services récents',
      'Voir tout': 'Voir tout',
      
      // Services
      'Titre du service': 'Titre du service',
      'Description': 'Description',
      'Prix': 'Prix',
      'Localisation': 'Localisation',
      'Contacter': 'Contacter',
      'Conversation': 'Conversation',
      'Galerie': 'Galerie',
      
      // Paramètres
      'Nom complet': 'Nom complet',
      'Email': 'Email',
      'Téléphone': 'Téléphone',
      'Bio': 'Bio',
      'Photo de profil': 'Photo de profil',
      'Sauvegarder': 'Sauvegarder',
      'Annuler': 'Annuler',
      
      // Recharge tokens
      'Rechargez vos Tokens Yukpo': 'Rechargez vos Tokens Yukpo',
      'Augmentez votre solde pour accéder à plus de services et fonctionnalités.': 'Augmentez votre solde pour accéder à plus de services et fonctionnalités.',
      'Votre solde actuel': 'Votre solde actuel',
      'Tokens': 'Tokens',
      'Voir l\'historique': 'Voir l\'historique',
      'Choisissez un montant de recharge': 'Choisissez un montant de recharge',
      'Sélectionnez votre mode de paiement': 'Sélectionnez votre mode de paiement',
      'Recharger maintenant': 'Recharger maintenant',
      'Recharger': 'Recharger',
      
      // Messages généraux
      'Chargement...': 'Chargement...',
      'Erreur': 'Erreur',
      'Succès': 'Succès',
      'Confirmer': 'Confirmer',
      'Fermer': 'Fermer',
    };

    // Dictionnaire anglais
    this.dictionaries.en = {
      // Navigation et header
      'Accueil': 'Home',
      'Services': 'Services',
      'Mes services': 'My services',
      'Mon historique': 'My history',
      'Paramètres': 'Settings',
      'Recharge tokens': 'Recharge tokens',
      'Déconnexion': 'Logout',
      'Connexion': 'Login',
      'Inscription': 'Register',
      
      // Page d'accueil
      'Trouvez le service dont vous avez besoin': 'Find the service you need',
      'Rechercher un service...': 'Search for a service...',
      'Rechercher': 'Search',
      'Catégories populaires': 'Popular categories',
      'Services récents': 'Recent services',
      'Voir tout': 'See all',
      
      // Services
      'Titre du service': 'Service title',
      'Description': 'Description',
      'Prix': 'Price',
      'Localisation': 'Location',
      'Contacter': 'Contact',
      'Conversation': 'Conversation',
      'Galerie': 'Gallery',
      
      // Paramètres
      'Nom complet': 'Full name',
      'Email': 'Email',
      'Téléphone': 'Phone',
      'Bio': 'Bio',
      'Photo de profil': 'Profile photo',
      'Sauvegarder': 'Save',
      'Annuler': 'Cancel',
      
      // Recharge tokens
      'Rechargez vos Tokens Yukpo': 'Recharge your Yukpo Tokens',
      'Augmentez votre solde pour accéder à plus de services et fonctionnalités.': 'Increase your balance to access more services and features.',
      'Votre solde actuel': 'Your current balance',
      'Tokens': 'Tokens',
      'Voir l\'historique': 'View history',
      'Choisissez un montant de recharge': 'Choose a recharge amount',
      'Sélectionnez votre mode de paiement': 'Select your payment method',
      'Recharger maintenant': 'Recharge now',
      'Recharger': 'Recharge',
      
      // Messages généraux
      'Chargement...': 'Loading...',
      'Erreur': 'Error',
      'Succès': 'Success',
      'Confirmer': 'Confirm',
      'Fermer': 'Close',
    };

    // Dictionnaire portugais
    this.dictionaries.pt = {
      // Navigation et header
      'Accueil': 'Início',
      'Services': 'Serviços',
      'Mes services': 'Meus serviços',
      'Mon historique': 'Meu histórico',
      'Paramètres': 'Configurações',
      'Recharge tokens': 'Recarregar tokens',
      'Déconnexion': 'Sair',
      'Connexion': 'Entrar',
      'Inscription': 'Registrar',
      
      // Page d'accueil
      'Trouvez le service dont vous avez besoin': 'Encontre o serviço que você precisa',
      'Rechercher un service...': 'Pesquisar um serviço...',
      'Rechercher': 'Pesquisar',
      'Catégories populaires': 'Categorias populares',
      'Services récents': 'Serviços recentes',
      'Voir tout': 'Ver tudo',
      
      // Services
      'Titre du service': 'Título do serviço',
      'Description': 'Descrição',
      'Prix': 'Preço',
      'Localisation': 'Localização',
      'Contacter': 'Contatar',
      'Conversation': 'Conversa',
      'Galerie': 'Galeria',
      
      // Paramètres
      'Nom complet': 'Nome completo',
      'Email': 'Email',
      'Téléphone': 'Telefone',
      'Bio': 'Bio',
      'Photo de profil': 'Foto do perfil',
      'Sauvegarder': 'Salvar',
      'Annuler': 'Cancelar',
      
      // Recharge tokens
      'Rechargez vos Tokens Yukpo': 'Recarregue seus Tokens Yukpo',
      'Augmentez votre solde pour accéder à plus de services et fonctionnalités.': 'Aumente seu saldo para acessar mais serviços e funcionalidades.',
      'Votre solde actuel': 'Seu saldo atual',
      'Tokens': 'Tokens',
      'Voir l\'historique': 'Ver histórico',
      'Choisissez un montant de recharge': 'Escolha um valor de recarga',
      'Sélectionnez votre mode de paiement': 'Selecione seu método de pagamento',
      'Recharger maintenant': 'Recarregar agora',
      'Recharger': 'Recarregar',
      
      // Messages généraux
      'Chargement...': 'Carregando...',
      'Erreur': 'Erro',
      'Succès': 'Sucesso',
      'Confirmer': 'Confirmar',
      'Fermer': 'Fechar',
    };

    // Dictionnaire arabe
    this.dictionaries.ar = {
      // Navigation et header
      'Accueil': 'الرئيسية',
      'Services': 'الخدمات',
      'Mes services': 'خدماتي',
      'Mon historique': 'سجلّي',
      'Paramètres': 'الإعدادات',
      'Recharge tokens': 'إعادة شحن الرموز',
      'Déconnexion': 'تسجيل الخروج',
      'Connexion': 'تسجيل الدخول',
      'Inscription': 'التسجيل',
      
      // Page d'accueil
      'Trouvez le service dont vous avez besoin': 'ابحث عن الخدمة التي تحتاجها',
      'Rechercher un service...': 'البحث عن خدمة...',
      'Rechercher': 'بحث',
      'Catégories populaires': 'الفئات الشائعة',
      'Services récents': 'الخدمات الأخيرة',
      'Voir tout': 'عرض الكل',
      
      // Services
      'Titre du service': 'عنوان الخدمة',
      'Description': 'الوصف',
      'Prix': 'السعر',
      'Localisation': 'الموقع',
      'Contacter': 'اتصل',
      'Conversation': 'محادثة',
      'Galerie': 'المعرض',
      
      // Paramètres
      'Nom complet': 'الاسم الكامل',
      'Email': 'البريد الإلكتروني',
      'Téléphone': 'الهاتف',
      'Bio': 'نبذة شخصية',
      'Photo de profil': 'صورة الملف الشخصي',
      'Sauvegarder': 'حفظ',
      'Annuler': 'إلغاء',
      
      // Recharge tokens
      'Rechargez vos Tokens Yukpo': 'أعد شحن رموز Yukpo الخاصة بك',
      'Augmentez votre solde pour accéder à plus de services et fonctionnalités.': 'زد رصيدك للوصول إلى المزيد من الخدمات والميزات.',
      'Votre solde actuel': 'رصيدك الحالي',
      'Tokens': 'الرموز',
      'Voir l\'historique': 'عرض السجل',
      'Choisissez un montant de recharge': 'اختر مبلغ إعادة الشحن',
      'Sélectionnez votre mode de paiement': 'اختر طريقة الدفع',
      'Recharger maintenant': 'إعادة شحن الآن',
      'Recharger': 'إعادة شحن',
      
      // Messages généraux
      'Chargement...': 'جاري التحميل...',
      'Erreur': 'خطأ',
      'Succès': 'نجح',
      'Confirmer': 'تأكيد',
      'Fermer': 'إغلاق',
    };

    // Dictionnaire fula
    this.dictionaries.ff = {
      // Navigation et header
      'Accueil': 'Fuɗɗorde',
      'Services': 'Baɗɗe',
      'Mes services': 'Baɗɗe am',
      'Mon historique': 'Tarihi am',
      'Paramètres': 'Teelte',
      'Recharge tokens': 'Tokkenji yaltude',
      'Déconnexion': 'Seertude',
      'Connexion': 'Seertude',
      'Inscription': 'Winndude',
      
      // Page d'accueil
      'Trouvez le service dont vous avez besoin': 'Yiɗ baɗɗe maaɗa eɓɓaani',
      'Rechercher un service...': 'Yiɗ baɗɗe...',
      'Rechercher': 'Yiɗ',
      'Catégories populaires': 'Fedde ɓurɓe',
      'Services récents': 'Baɗɗe kesɗe',
      'Voir tout': 'Yiyee fof',
      
      // Services
      'Titre du service': 'Innde baɗɗe',
      'Description': 'Ciftaaɗe',
      'Prix': 'Njoɓdi',
      'Localisation': 'Nokku',
      'Contacter': 'Hollude',
      'Conversation': 'Hollude',
      'Galerie': 'Njuɓɓudi',
      
      // Paramètres
      'Nom complet': 'Innde fof',
      'Email': 'Iimeel',
      'Téléphone': 'Telefoon',
      'Bio': 'Bio',
      'Photo de profil': 'Fotooɗe',
      'Sauvegarder': 'Danndude',
      'Annuler': 'Uddude',
      
      // Recharge tokens
      'Rechargez vos Tokens Yukpo': 'Yalt tokkenji Yukpo maaɗa',
      'Augmentez votre solde pour accéder à plus de services et fonctionnalités.': 'Yalt njoɓdi maaɗa ngam yottude baɗɗe eɓɓaani e baɗɗe.',
      'Votre solde actuel': 'Njoɓdi maaɗa jooni',
      'Tokens': 'Tokkenji',
      'Voir l\'historique': 'Yiyee tarihi',
      'Choisissez un montant de recharge': 'Suɓɓo njoɓdi yaltude',
      'Sélectionnez votre mode de paiement': 'Suɓɓo no njoɓdi',
      'Recharger maintenant': 'Yalt jooni',
      'Recharger': 'Yalt',
      
      // Messages généraux
      'Chargement...': 'Lootude...',
      'Erreur': 'Juumre',
      'Succès': 'Moƴƴi',
      'Confirmer': 'Tiiɗnude',
      'Fermer': 'Uddu',
    };
  }

  public setLanguage(languageCode: string) {
    this.currentLanguage = languageCode;
  }

  public getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  public translate(text: string): string {
    const dictionary = this.dictionaries[this.currentLanguage];
    if (!dictionary) {
      return text; // Retourner le texte original si la langue n'est pas supportée
    }
    
    return dictionary[text] || text; // Retourner la traduction ou le texte original
  }

  public translatePage(): void {
    const textNodes = this.getTextNodes(document.body);
    
    for (const node of textNodes) {
      if (node.textContent && node.textContent.trim().length > 0) {
        const originalText = node.textContent.trim();
        const translatedText = this.translate(originalText);
        
        if (translatedText !== originalText) {
          node.textContent = translatedText;
        }
      }
    }

    // Traduire les attributs
    this.translateAttributes();
  }

  private getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'code', 'pre'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  private translateAttributes(): void {
    const elements = document.querySelectorAll('[alt], [title], [placeholder]');
    const attributes = ['alt', 'title', 'placeholder'];

    for (const element of elements) {
      for (const attr of attributes) {
        const value = element.getAttribute(attr);
        if (value && value.trim().length > 0) {
          const translatedValue = this.translate(value);
          if (translatedValue !== value) {
            element.setAttribute(attr, translatedValue);
          }
        }
      }
    }
  }
}

export default DictionaryService;
