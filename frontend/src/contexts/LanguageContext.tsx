// 🌍 Context de Langue - Gestion globale de la langue de l'application (Frontend)
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string) => string; // Fonction de traduction
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'fr',
    setLanguage: () => { },
    t: (key) => key,
});

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

interface LanguageProviderProps {
    children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [language, setLanguageState] = useState<string>('fr');

    // Charger la langue sauvegardée au démarrage ou détecter via GPS
    useEffect(() => {
        loadOrDetectLanguage();
    }, []);

    const loadOrDetectLanguage = async () => {
        try {
            const savedLanguage = localStorage.getItem('app_language');
            const isFirstLaunch = localStorage.getItem('app_first_launch');

            if (savedLanguage) {
                // Langue déjà sauvegardée
                setLanguageState(savedLanguage);
            } else if (isFirstLaunch === null) {
                // Première visite - Détecter la langue via GPS
                console.log('[Language] Première visite - Détection langue via GPS...');
                await detectLanguageFromGPS();
                localStorage.setItem('app_first_launch', 'false');
            }
        } catch (error) {
            console.error('Erreur chargement langue:', error);
        }
    };

    const detectLanguageFromGPS = async () => {
        try {
            if ('geolocation' in navigator) {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    });
                });

                const { latitude, longitude } = position.coords;
                console.log('[Language] GPS:', latitude, longitude);

                // Déterminer la langue basée sur la région
                let detectedLang = 'fr'; // Par défaut français

                // Afrique francophone (Cameroun, Côte d'Ivoire, Sénégal, etc.)
                if (latitude >= -5 && latitude <= 20 && longitude >= -18 && longitude <= 20) {
                    detectedLang = 'fr';
                }
                // Afrique anglophone (Nigeria, Ghana, Kenya, etc.)
                else if (latitude >= -5 && latitude <= 15 && longitude >= 0 && longitude <= 45) {
                    detectedLang = 'en';
                }
                // Europe francophone
                else if (latitude >= 42 && latitude <= 51 && longitude >= -5 && longitude <= 10) {
                    detectedLang = 'fr';
                }
                // Europe anglophone
                else if (latitude >= 50 && latitude <= 60 && longitude >= -8 && longitude <= 2) {
                    detectedLang = 'en';
                }
                // Amérique du Nord
                else if (latitude >= 25 && latitude <= 50 && longitude >= -125 && longitude <= -65) {
                    detectedLang = 'en';
                }
                // Amérique Latine
                else if (latitude >= -55 && latitude <= 25 && longitude >= -120 && longitude <= -35) {
                    detectedLang = 'es';
                }

                console.log('[Language] Langue détectée via GPS:', detectedLang);
                setLanguage(detectedLang);
            }
        } catch (error) {
            console.error('[Language] Erreur détection GPS:', error);
            // Langue par défaut si erreur
            setLanguage('fr');
        }
    };

    const setLanguage = (lang: string) => {
        try {
            setLanguageState(lang);
            localStorage.setItem('app_language', lang);
            console.log('[Language] Langue changée:', lang);
        } catch (error) {
            console.error('Erreur sauvegarde langue:', error);
        }
    };

    // Fonction de traduction
    const t = (key: string): string => {
        return translations[language]?.[key] || translations['fr']?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// Traductions complètes
const translations: { [lang: string]: { [key: string]: string } } = {
    fr: {
        // Navigation
        'home.title': 'Accueil',
        'home.welcome': 'Bienvenue',
        'services.title': 'Mes Services',
        'activity.title': 'Mon Activité',
        'interactions.title': 'Mes Interactions',
        'account.title': 'Mon Compte',

        // Recherche
        'search.placeholder': 'Rechercher un service...',
        'search.create': 'Créer un service',
        'search.find': 'Rechercher',

        // Boutons
        'button.create': 'Créer',
        'button.save': 'Enregistrer',
        'button.cancel': 'Annuler',
        'button.edit': 'Modifier',
        'button.delete': 'Supprimer',
        'button.add': 'Ajouter',
        'button.close': 'Fermer',
        'button.back': 'Retour',
        'button.next': 'Suivant',
        'button.previous': 'Précédent',
        'button.confirm': 'Confirmer',
        'button.yes': 'Oui',
        'button.no': 'Non',

        // Produits
        'product.title': 'Produit',
        'product.name': 'Nom du produit',
        'product.price': 'Prix',
        'product.description': 'Description',
        'product.category': 'Catégorie',
        'product.images': 'Images',
        'product.videos': 'Vidéos',
        'product.add': 'Ajouter un produit',
        'product.edit': 'Modifier le produit',
        'product.delete': 'Supprimer le produit',
        'product.new': 'Nouveau produit',

        // Services
        'service.title': 'Service',
        'service.create': 'Créer un service',
        'service.edit': 'Modifier le service',
        'service.delete': 'Supprimer le service',
        'service.name': 'Nom du service',
        'service.description': 'Description du service',
        'service.category': 'Catégorie du service',

        // Messages
        'message.success': 'Succès',
        'message.error': 'Erreur',
        'message.loading': 'Chargement...',
        'message.no_data': 'Aucune donnée',
        'message.confirm_delete': 'Êtes-vous sûr de vouloir supprimer ?',

        // Formulaires
        'form.required': 'Ce champ est obligatoire',
        'form.invalid': 'Format invalide',
        'form.save_success': 'Enregistré avec succès',
        'form.save_error': 'Erreur lors de l\'enregistrement',

        // Géolocalisation
        'location.title': 'Localisation',
        'location.select': 'Sélectionner la localisation',
        'location.current': 'Position actuelle',
        'location.search': 'Rechercher un lieu',

        // Paiement
        'payment.title': 'Paiement',
        'payment.method': 'Méthode de paiement',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Carte Visa',
        'payment.phone': 'Numéro de téléphone',
        'payment.card_number': 'Numéro de carte',
        'payment.expiry': 'Date d\'expiration',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Message',
        'chat.send': 'Envoyer',
        'chat.typing': 'En train d\'écrire...',
        'chat.online': 'En ligne',
        'chat.offline': 'Hors ligne',

        // Profil
        'profile.title': 'Profil',
        'profile.edit': 'Modifier le profil',
        'profile.name': 'Nom',
        'profile.email': 'Email',
        'profile.phone': 'Téléphone',
        'profile.address': 'Adresse',
        'profile.avatar': 'Photo de profil',

        // Statistiques
        'stats.title': 'Statistiques',
        'stats.views': 'Vues',
        'stats.interactions': 'Interactions',
        'stats.balance': 'Solde',
        'stats.budget': 'Budget',
        'stats.total': 'Total',

        // Langues
        'language.title': 'Langue',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    en: {
        // Navigation
        'home.title': 'Home',
        'home.welcome': 'Welcome',
        'services.title': 'My Services',
        'activity.title': 'My Activity',
        'interactions.title': 'My Interactions',
        'account.title': 'My Account',

        // Search
        'search.placeholder': 'Search for a service...',
        'search.create': 'Create a service',
        'search.find': 'Search',

        // Buttons
        'button.create': 'Create',
        'button.save': 'Save',
        'button.cancel': 'Cancel',
        'button.edit': 'Edit',
        'button.delete': 'Delete',
        'button.add': 'Add',
        'button.close': 'Close',
        'button.back': 'Back',
        'button.next': 'Next',
        'button.previous': 'Previous',
        'button.confirm': 'Confirm',
        'button.yes': 'Yes',
        'button.no': 'No',

        // Products
        'product.title': 'Product',
        'product.name': 'Product name',
        'product.price': 'Price',
        'product.description': 'Description',
        'product.category': 'Category',
        'product.images': 'Images',
        'product.videos': 'Videos',
        'product.add': 'Add product',
        'product.edit': 'Edit product',
        'product.delete': 'Delete product',
        'product.new': 'New product',

        // Services
        'service.title': 'Service',
        'service.create': 'Create service',
        'service.edit': 'Edit service',
        'service.delete': 'Delete service',
        'service.name': 'Service name',
        'service.description': 'Service description',
        'service.category': 'Service category',

        // Messages
        'message.success': 'Success',
        'message.error': 'Error',
        'message.loading': 'Loading...',
        'message.no_data': 'No data',
        'message.confirm_delete': 'Are you sure you want to delete?',

        // Forms
        'form.required': 'This field is required',
        'form.invalid': 'Invalid format',
        'form.save_success': 'Saved successfully',
        'form.save_error': 'Error saving',

        // Location
        'location.title': 'Location',
        'location.select': 'Select location',
        'location.current': 'Current position',
        'location.search': 'Search place',

        // Payment
        'payment.title': 'Payment',
        'payment.method': 'Payment method',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Visa Card',
        'payment.phone': 'Phone number',
        'payment.card_number': 'Card number',
        'payment.expiry': 'Expiry date',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Message',
        'chat.send': 'Send',
        'chat.typing': 'Typing...',
        'chat.online': 'Online',
        'chat.offline': 'Offline',

        // Profile
        'profile.title': 'Profile',
        'profile.edit': 'Edit profile',
        'profile.name': 'Name',
        'profile.email': 'Email',
        'profile.phone': 'Phone',
        'profile.address': 'Address',
        'profile.avatar': 'Profile picture',

        // Statistics
        'stats.title': 'Statistics',
        'stats.views': 'Views',
        'stats.interactions': 'Interactions',
        'stats.balance': 'Balance',
        'stats.budget': 'Budget',
        'stats.total': 'Total',

        // Languages
        'language.title': 'Language',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    es: {
        // Navigation
        'home.title': 'Inicio',
        'home.welcome': 'Bienvenido',
        'services.title': 'Mis Servicios',
        'activity.title': 'Mi Actividad',
        'interactions.title': 'Mis Interacciones',
        'account.title': 'Mi Cuenta',

        // Search
        'search.placeholder': 'Buscar un servicio...',
        'search.create': 'Crear un servicio',
        'search.find': 'Buscar',

        // Buttons
        'button.create': 'Crear',
        'button.save': 'Guardar',
        'button.cancel': 'Cancelar',
        'button.edit': 'Editar',
        'button.delete': 'Eliminar',
        'button.add': 'Agregar',
        'button.close': 'Cerrar',
        'button.back': 'Atrás',
        'button.next': 'Siguiente',
        'button.previous': 'Anterior',
        'button.confirm': 'Confirmar',
        'button.yes': 'Sí',
        'button.no': 'No',

        // Products
        'product.title': 'Producto',
        'product.name': 'Nombre del producto',
        'product.price': 'Precio',
        'product.description': 'Descripción',
        'product.category': 'Categoría',
        'product.images': 'Imágenes',
        'product.videos': 'Videos',
        'product.add': 'Agregar producto',
        'product.edit': 'Editar producto',
        'product.delete': 'Eliminar producto',
        'product.new': 'Nuevo producto',

        // Services
        'service.title': 'Servicio',
        'service.create': 'Crear servicio',
        'service.edit': 'Editar servicio',
        'service.delete': 'Eliminar servicio',
        'service.name': 'Nombre del servicio',
        'service.description': 'Descripción del servicio',
        'service.category': 'Categoría del servicio',

        // Messages
        'message.success': 'Éxito',
        'message.error': 'Error',
        'message.loading': 'Cargando...',
        'message.no_data': 'Sin datos',
        'message.confirm_delete': '¿Estás seguro de que quieres eliminar?',

        // Forms
        'form.required': 'Este campo es obligatorio',
        'form.invalid': 'Formato inválido',
        'form.save_success': 'Guardado exitosamente',
        'form.save_error': 'Error al guardar',

        // Location
        'location.title': 'Ubicación',
        'location.select': 'Seleccionar ubicación',
        'location.current': 'Posición actual',
        'location.search': 'Buscar lugar',

        // Payment
        'payment.title': 'Pago',
        'payment.method': 'Método de pago',
        'payment.mobile_money': 'Mobile Money',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Tarjeta Visa',
        'payment.phone': 'Número de teléfono',
        'payment.card_number': 'Número de tarjeta',
        'payment.expiry': 'Fecha de vencimiento',

        // Chat
        'chat.title': 'Chat',
        'chat.message': 'Mensaje',
        'chat.send': 'Enviar',
        'chat.typing': 'Escribiendo...',
        'chat.online': 'En línea',
        'chat.offline': 'Desconectado',

        // Profile
        'profile.title': 'Perfil',
        'profile.edit': 'Editar perfil',
        'profile.name': 'Nombre',
        'profile.email': 'Email',
        'profile.phone': 'Teléfono',
        'profile.address': 'Dirección',
        'profile.avatar': 'Foto de perfil',

        // Statistics
        'stats.title': 'Estadísticas',
        'stats.views': 'Vistas',
        'stats.interactions': 'Interacciones',
        'stats.balance': 'Saldo',
        'stats.budget': 'Presupuesto',
        'stats.total': 'Total',

        // Languages
        'language.title': 'Idioma',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    zh: {
        // Navigation
        'home.title': '首页',
        'home.welcome': '欢迎',
        'services.title': '我的服务',
        'activity.title': '我的活动',
        'interactions.title': '我的互动',
        'account.title': '我的账户',

        // Search
        'search.placeholder': '搜索服务...',
        'search.create': '创建服务',
        'search.find': '搜索',

        // Buttons
        'button.create': '创建',
        'button.save': '保存',
        'button.cancel': '取消',
        'button.edit': '编辑',
        'button.delete': '删除',
        'button.add': '添加',
        'button.close': '关闭',
        'button.back': '返回',
        'button.next': '下一步',
        'button.previous': '上一步',
        'button.confirm': '确认',
        'button.yes': '是',
        'button.no': '否',

        // Products
        'product.title': '产品',
        'product.name': '产品名称',
        'product.price': '价格',
        'product.description': '描述',
        'product.category': '类别',
        'product.images': '图片',
        'product.videos': '视频',
        'product.add': '添加产品',
        'product.edit': '编辑产品',
        'product.delete': '删除产品',
        'product.new': '新产品',

        // Services
        'service.title': '服务',
        'service.create': '创建服务',
        'service.edit': '编辑服务',
        'service.delete': '删除服务',
        'service.name': '服务名称',
        'service.description': '服务描述',
        'service.category': '服务类别',

        // Messages
        'message.success': '成功',
        'message.error': '错误',
        'message.loading': '加载中...',
        'message.no_data': '无数据',
        'message.confirm_delete': '确定要删除吗？',

        // Forms
        'form.required': '此字段为必填项',
        'form.invalid': '格式无效',
        'form.save_success': '保存成功',
        'form.save_error': '保存错误',

        // Location
        'location.title': '位置',
        'location.select': '选择位置',
        'location.current': '当前位置',
        'location.search': '搜索地点',

        // Payment
        'payment.title': '支付',
        'payment.method': '支付方式',
        'payment.mobile_money': '移动支付',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Visa卡',
        'payment.phone': '电话号码',
        'payment.card_number': '卡号',
        'payment.expiry': '有效期',

        // Chat
        'chat.title': '聊天',
        'chat.message': '消息',
        'chat.send': '发送',
        'chat.typing': '正在输入...',
        'chat.online': '在线',
        'chat.offline': '离线',

        // Profile
        'profile.title': '个人资料',
        'profile.edit': '编辑资料',
        'profile.name': '姓名',
        'profile.email': '邮箱',
        'profile.phone': '电话',
        'profile.address': '地址',
        'profile.avatar': '头像',

        // Statistics
        'stats.title': '统计',
        'stats.views': '浏览量',
        'stats.interactions': '互动',
        'stats.balance': '余额',
        'stats.budget': '预算',
        'stats.total': '总计',

        // Languages
        'language.title': '语言',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    hi: {
        // Navigation
        'home.title': 'होम',
        'home.welcome': 'स्वागत',
        'services.title': 'मेरी सेवाएं',
        'activity.title': 'मेरी गतिविधि',
        'interactions.title': 'मेरे इंटरैक्शन',
        'account.title': 'मेरा खाता',

        // Search
        'search.placeholder': 'सेवा खोजें...',
        'search.create': 'सेवा बनाएं',
        'search.find': 'खोजें',

        // Buttons
        'button.create': 'बनाएं',
        'button.save': 'सहेजें',
        'button.cancel': 'रद्द करें',
        'button.edit': 'संपादित करें',
        'button.delete': 'हटाएं',
        'button.add': 'जोड़ें',
        'button.close': 'बंद करें',
        'button.back': 'वापस',
        'button.next': 'अगला',
        'button.previous': 'पिछला',
        'button.confirm': 'पुष्टि करें',
        'button.yes': 'हां',
        'button.no': 'नहीं',

        // Products
        'product.title': 'उत्पाद',
        'product.name': 'उत्पाद का नाम',
        'product.price': 'कीमत',
        'product.description': 'विवरण',
        'product.category': 'श्रेणी',
        'product.images': 'छवियां',
        'product.videos': 'वीडियो',
        'product.add': 'उत्पाद जोड़ें',
        'product.edit': 'उत्पाद संपादित करें',
        'product.delete': 'उत्पाद हटाएं',
        'product.new': 'नया उत्पाद',

        // Services
        'service.title': 'सेवा',
        'service.create': 'सेवा बनाएं',
        'service.edit': 'सेवा संपादित करें',
        'service.delete': 'सेवा हटाएं',
        'service.name': 'सेवा का नाम',
        'service.description': 'सेवा का विवरण',
        'service.category': 'सेवा श्रेणी',

        // Messages
        'message.success': 'सफलता',
        'message.error': 'त्रुटि',
        'message.loading': 'लोड हो रहा है...',
        'message.no_data': 'कोई डेटा नहीं',
        'message.confirm_delete': 'क्या आप वाकई हटाना चाहते हैं?',

        // Forms
        'form.required': 'यह फ़ील्ड आवश्यक है',
        'form.invalid': 'अमान्य प्रारूप',
        'form.save_success': 'सफलतापूर्वक सहेजा गया',
        'form.save_error': 'सहेजने में त्रुटि',

        // Location
        'location.title': 'स्थान',
        'location.select': 'स्थान चुनें',
        'location.current': 'वर्तमान स्थिति',
        'location.search': 'स्थान खोजें',

        // Payment
        'payment.title': 'भुगतान',
        'payment.method': 'भुगतान विधि',
        'payment.mobile_money': 'मोबाइल मनी',
        'payment.orange_money': 'ऑरेंज मनी',
        'payment.visa': 'वीज़ा कार्ड',
        'payment.phone': 'फोन नंबर',
        'payment.card_number': 'कार्ड नंबर',
        'payment.expiry': 'समाप्ति तिथि',

        // Chat
        'chat.title': 'चैट',
        'chat.message': 'संदेश',
        'chat.send': 'भेजें',
        'chat.typing': 'टाइप कर रहे हैं...',
        'chat.online': 'ऑनलाइन',
        'chat.offline': 'ऑफलाइन',

        // Profile
        'profile.title': 'प्रोफ़ाइल',
        'profile.edit': 'प्रोफ़ाइल संपादित करें',
        'profile.name': 'नाम',
        'profile.email': 'ईमेल',
        'profile.phone': 'फोन',
        'profile.address': 'पता',
        'profile.avatar': 'प्रोफ़ाइल चित्र',

        // Statistics
        'stats.title': 'आंकड़े',
        'stats.views': 'दृश्य',
        'stats.interactions': 'इंटरैक्शन',
        'stats.balance': 'बैलेंस',
        'stats.budget': 'बजट',
        'stats.total': 'कुल',

        // Languages
        'language.title': 'भाषा',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    ar: {
        // Navigation
        'home.title': 'الرئيسية',
        'home.welcome': 'مرحبا',
        'services.title': 'خدماتي',
        'activity.title': 'نشاطي',
        'interactions.title': 'تفاعلاتي',
        'account.title': 'حسابي',

        // Search
        'search.placeholder': 'البحث عن خدمة...',
        'search.create': 'إنشاء خدمة',
        'search.find': 'بحث',

        // Buttons
        'button.create': 'إنشاء',
        'button.save': 'حفظ',
        'button.cancel': 'إلغاء',
        'button.edit': 'تعديل',
        'button.delete': 'حذف',
        'button.add': 'إضافة',
        'button.close': 'إغلاق',
        'button.back': 'رجوع',
        'button.next': 'التالي',
        'button.previous': 'السابق',
        'button.confirm': 'تأكيد',
        'button.yes': 'نعم',
        'button.no': 'لا',

        // Products
        'product.title': 'منتج',
        'product.name': 'اسم المنتج',
        'product.price': 'السعر',
        'product.description': 'الوصف',
        'product.category': 'الفئة',
        'product.images': 'الصور',
        'product.videos': 'الفيديوهات',
        'product.add': 'إضافة منتج',
        'product.edit': 'تعديل المنتج',
        'product.delete': 'حذف المنتج',
        'product.new': 'منتج جديد',

        // Services
        'service.title': 'خدمة',
        'service.create': 'إنشاء خدمة',
        'service.edit': 'تعديل الخدمة',
        'service.delete': 'حذف الخدمة',
        'service.name': 'اسم الخدمة',
        'service.description': 'وصف الخدمة',
        'service.category': 'فئة الخدمة',

        // Messages
        'message.success': 'نجح',
        'message.error': 'خطأ',
        'message.loading': 'جاري التحميل...',
        'message.no_data': 'لا توجد بيانات',
        'message.confirm_delete': 'هل أنت متأكد من الحذف؟',

        // Forms
        'form.required': 'هذا الحقل مطلوب',
        'form.invalid': 'تنسيق غير صحيح',
        'form.save_success': 'تم الحفظ بنجاح',
        'form.save_error': 'خطأ في الحفظ',

        // Location
        'location.title': 'الموقع',
        'location.select': 'اختيار الموقع',
        'location.current': 'الموقع الحالي',
        'location.search': 'البحث عن مكان',

        // Payment
        'payment.title': 'الدفع',
        'payment.method': 'طريقة الدفع',
        'payment.mobile_money': 'المال المحمول',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'بطاقة فيزا',
        'payment.phone': 'رقم الهاتف',
        'payment.card_number': 'رقم البطاقة',
        'payment.expiry': 'تاريخ الانتهاء',

        // Chat
        'chat.title': 'الدردشة',
        'chat.message': 'رسالة',
        'chat.send': 'إرسال',
        'chat.typing': 'يكتب...',
        'chat.online': 'متصل',
        'chat.offline': 'غير متصل',

        // Profile
        'profile.title': 'الملف الشخصي',
        'profile.edit': 'تعديل الملف الشخصي',
        'profile.name': 'الاسم',
        'profile.email': 'البريد الإلكتروني',
        'profile.phone': 'الهاتف',
        'profile.address': 'العنوان',
        'profile.avatar': 'صورة الملف الشخصي',

        // Statistics
        'stats.title': 'الإحصائيات',
        'stats.views': 'المشاهدات',
        'stats.interactions': 'التفاعلات',
        'stats.balance': 'الرصيد',
        'stats.budget': 'الميزانية',
        'stats.total': 'المجموع',

        // Languages
        'language.title': 'اللغة',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
    ru: {
        // Navigation
        'home.title': 'Главная',
        'home.welcome': 'Добро пожаловать',
        'services.title': 'Мои Услуги',
        'activity.title': 'Моя Активность',
        'interactions.title': 'Мои Взаимодействия',
        'account.title': 'Мой Аккаунт',

        // Search
        'search.placeholder': 'Поиск услуги...',
        'search.create': 'Создать услугу',
        'search.find': 'Поиск',

        // Buttons
        'button.create': 'Создать',
        'button.save': 'Сохранить',
        'button.cancel': 'Отмена',
        'button.edit': 'Редактировать',
        'button.delete': 'Удалить',
        'button.add': 'Добавить',
        'button.close': 'Закрыть',
        'button.back': 'Назад',
        'button.next': 'Далее',
        'button.previous': 'Предыдущий',
        'button.confirm': 'Подтвердить',
        'button.yes': 'Да',
        'button.no': 'Нет',

        // Products
        'product.title': 'Продукт',
        'product.name': 'Название продукта',
        'product.price': 'Цена',
        'product.description': 'Описание',
        'product.category': 'Категория',
        'product.images': 'Изображения',
        'product.videos': 'Видео',
        'product.add': 'Добавить продукт',
        'product.edit': 'Редактировать продукт',
        'product.delete': 'Удалить продукт',
        'product.new': 'Новый продукт',

        // Services
        'service.title': 'Услуга',
        'service.create': 'Создать услугу',
        'service.edit': 'Редактировать услугу',
        'service.delete': 'Удалить услугу',
        'service.name': 'Название услуги',
        'service.description': 'Описание услуги',
        'service.category': 'Категория услуги',

        // Messages
        'message.success': 'Успех',
        'message.error': 'Ошибка',
        'message.loading': 'Загрузка...',
        'message.no_data': 'Нет данных',
        'message.confirm_delete': 'Вы уверены, что хотите удалить?',

        // Forms
        'form.required': 'Это поле обязательно',
        'form.invalid': 'Неверный формат',
        'form.save_success': 'Успешно сохранено',
        'form.save_error': 'Ошибка сохранения',

        // Location
        'location.title': 'Местоположение',
        'location.select': 'Выбрать местоположение',
        'location.current': 'Текущее местоположение',
        'location.search': 'Поиск места',

        // Payment
        'payment.title': 'Платеж',
        'payment.method': 'Способ оплаты',
        'payment.mobile_money': 'Мобильные деньги',
        'payment.orange_money': 'Orange Money',
        'payment.visa': 'Карта Visa',
        'payment.phone': 'Номер телефона',
        'payment.card_number': 'Номер карты',
        'payment.expiry': 'Срок действия',

        // Chat
        'chat.title': 'Чат',
        'chat.message': 'Сообщение',
        'chat.send': 'Отправить',
        'chat.typing': 'Печатает...',
        'chat.online': 'В сети',
        'chat.offline': 'Не в сети',

        // Profile
        'profile.title': 'Профиль',
        'profile.edit': 'Редактировать профиль',
        'profile.name': 'Имя',
        'profile.email': 'Электронная почта',
        'profile.phone': 'Телефон',
        'profile.address': 'Адрес',
        'profile.avatar': 'Фото профиля',

        // Statistics
        'stats.title': 'Статистика',
        'stats.views': 'Просмотры',
        'stats.interactions': 'Взаимодействия',
        'stats.balance': 'Баланс',
        'stats.budget': 'Бюджет',
        'stats.total': 'Всего',

        // Languages
        'language.title': 'Язык',
        'language.french': 'Français',
        'language.english': 'English',
        'language.spanish': 'Español',
        'language.chinese': '中文',
        'language.hindi': 'हिन्दी',
        'language.arabic': 'العربية',
        'language.russian': 'Русский',
    },
};

export default LanguageContext;