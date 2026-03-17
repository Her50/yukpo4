/**
 * Propagate livresNeufs keys to all locale files that don't have them yet.
 * Uses language-specific translations for major languages, FR as fallback.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const translations = {
    en: {
        title: "New Books",
        subtitle: "New books catalog from partner bookstores",
        neuf: "New",
        neufsCourt: "New",
        auProgramme: "In curriculum",
        tous: "All",
        primaire: "Primary",
        college: "Middle School",
        lycee: "High School",
        toutesClasses: "All classes",
        rechercherPlaceholder: "Search for a new book (title, author)...",
        chargement: "Loading new books...",
        aucunLivre: "No new books available",
        aucunLivreDesc: "Partner bookstores haven't published books for these criteria yet.",
        totalDisponibles: "{{count}} new books available",
        comparer: "Compare",
        acheter: "Buy",
        acheterNeuf: "Buy this new book",
        confirmerAchat: "Do you want to buy \"{{titre}}\" for {{prix}} XAF?",
        annuler: "Cancel",
        confirmer: "Confirm purchase",
        achatReussi: "Purchase successful!",
        erreurAchat: "Purchase error",
        erreurChargement: "Error loading new books",
        erreurComparaison: "Error comparing prices",
        comparaisonPrix: "Price comparison",
        programmeOfficiel: "Official curriculum",
        neufsDisponibles: "New books available",
        occasionDisponibles: "Used books available",
        aucuneComparaison: "No comparison data available for this class."
    },
    es: {
        title: "Libros Nuevos",
        subtitle: "Catálogo de libros nuevos de librerías asociadas",
        neuf: "Nuevo",
        neufsCourt: "Nuevos",
        auProgramme: "En el programa",
        tous: "Todos",
        primaire: "Primaria",
        college: "Secundaria",
        lycee: "Bachillerato",
        toutesClasses: "Todas las clases",
        rechercherPlaceholder: "Buscar un libro nuevo (título, autor)...",
        chargement: "Cargando libros nuevos...",
        aucunLivre: "No hay libros nuevos disponibles",
        aucunLivreDesc: "Las librerías asociadas aún no han publicado libros para estos criterios.",
        totalDisponibles: "{{count}} libros nuevos disponibles",
        comparer: "Comparar",
        acheter: "Comprar",
        acheterNeuf: "Comprar este libro nuevo",
        confirmerAchat: "¿Quieres comprar \"{{titre}}\" por {{prix}} XAF?",
        annuler: "Cancelar",
        confirmer: "Confirmar compra",
        achatReussi: "¡Compra exitosa!",
        erreurAchat: "Error en la compra",
        erreurChargement: "Error al cargar libros nuevos",
        erreurComparaison: "Error al comparar precios",
        comparaisonPrix: "Comparación de precios",
        programmeOfficiel: "Programa oficial",
        neufsDisponibles: "Libros nuevos disponibles",
        occasionDisponibles: "Libros de segunda mano disponibles",
        aucuneComparaison: "No hay datos de comparación para esta clase."
    },
    de: {
        title: "Neue Bücher",
        subtitle: "Neue Bücher Katalog von Partnerbuchhandlungen",
        neuf: "Neu",
        neufsCourt: "Neu",
        auProgramme: "Im Lehrplan",
        tous: "Alle",
        primaire: "Grundschule",
        college: "Mittelschule",
        lycee: "Gymnasium",
        toutesClasses: "Alle Klassen",
        rechercherPlaceholder: "Neues Buch suchen (Titel, Autor)...",
        chargement: "Lade neue Bücher...",
        aucunLivre: "Keine neuen Bücher verfügbar",
        aucunLivreDesc: "Partnerbuchhandlungen haben noch keine Bücher für diese Kriterien veröffentlicht.",
        totalDisponibles: "{{count}} neue Bücher verfügbar",
        comparer: "Vergleichen",
        acheter: "Kaufen",
        acheterNeuf: "Dieses neue Buch kaufen",
        confirmerAchat: "Möchten Sie \"{{titre}}\" für {{prix}} XAF kaufen?",
        annuler: "Abbrechen",
        confirmer: "Kauf bestätigen",
        achatReussi: "Kauf erfolgreich!",
        erreurAchat: "Kauffehler",
        erreurChargement: "Fehler beim Laden neuer Bücher",
        erreurComparaison: "Fehler beim Preisvergleich",
        comparaisonPrix: "Preisvergleich",
        programmeOfficiel: "Offizieller Lehrplan",
        neufsDisponibles: "Neue Bücher verfügbar",
        occasionDisponibles: "Gebrauchte Bücher verfügbar",
        aucuneComparaison: "Keine Vergleichsdaten für diese Klasse verfügbar."
    },
    pt: {
        title: "Livros Novos",
        subtitle: "Catálogo de livros novos de livrarias parceiras",
        neuf: "Novo",
        neufsCourt: "Novos",
        auProgramme: "No programa",
        tous: "Todos",
        primaire: "Primário",
        college: "Médio",
        lycee: "Secundário",
        toutesClasses: "Todas as classes",
        rechercherPlaceholder: "Buscar livro novo (título, autor)...",
        chargement: "Carregando livros novos...",
        aucunLivre: "Nenhum livro novo disponível",
        aucunLivreDesc: "As livrarias parceiras ainda não publicaram livros para estes critérios.",
        totalDisponibles: "{{count}} livros novos disponíveis",
        comparer: "Comparar",
        acheter: "Comprar",
        acheterNeuf: "Comprar este livro novo",
        confirmerAchat: "Deseja comprar \"{{titre}}\" por {{prix}} XAF?",
        annuler: "Cancelar",
        confirmer: "Confirmar compra",
        achatReussi: "Compra bem-sucedida!",
        erreurAchat: "Erro na compra",
        erreurChargement: "Erro ao carregar livros novos",
        erreurComparaison: "Erro ao comparar preços",
        comparaisonPrix: "Comparação de preços",
        programmeOfficiel: "Programa oficial",
        neufsDisponibles: "Livros novos disponíveis",
        occasionDisponibles: "Livros usados disponíveis",
        aucuneComparaison: "Nenhum dado de comparação disponível para esta classe."
    },
    it: {
        title: "Libri Nuovi",
        subtitle: "Catalogo libri nuovi delle librerie partner",
        neuf: "Nuovo",
        neufsCourt: "Nuovi",
        auProgramme: "Nel programma",
        tous: "Tutti",
        primaire: "Primaria",
        college: "Media",
        lycee: "Superiori",
        toutesClasses: "Tutte le classi",
        rechercherPlaceholder: "Cerca libro nuovo (titolo, autore)...",
        chargement: "Caricamento libri nuovi...",
        aucunLivre: "Nessun libro nuovo disponibile",
        aucunLivreDesc: "Le librerie partner non hanno ancora pubblicato libri per questi criteri.",
        totalDisponibles: "{{count}} libri nuovi disponibili",
        comparer: "Confronta",
        acheter: "Acquista",
        acheterNeuf: "Acquista questo libro nuovo",
        confirmerAchat: "Vuoi acquistare \"{{titre}}\" per {{prix}} XAF?",
        annuler: "Annulla",
        confirmer: "Conferma acquisto",
        achatReussi: "Acquisto riuscito!",
        erreurAchat: "Errore acquisto",
        erreurChargement: "Errore caricamento libri nuovi",
        erreurComparaison: "Errore confronto prezzi",
        comparaisonPrix: "Confronto prezzi",
        programmeOfficiel: "Programma ufficiale",
        neufsDisponibles: "Libri nuovi disponibili",
        occasionDisponibles: "Libri usati disponibili",
        aucuneComparaison: "Nessun dato di confronto per questa classe."
    },
    ar: {
        title: "كتب جديدة",
        subtitle: "كتالوج الكتب الجديدة من المكتبات الشريكة",
        neuf: "جديد",
        neufsCourt: "جديد",
        auProgramme: "في المنهج",
        tous: "الكل",
        primaire: "ابتدائي",
        college: "إعدادي",
        lycee: "ثانوي",
        toutesClasses: "جميع الفصول",
        rechercherPlaceholder: "البحث عن كتاب جديد (عنوان، مؤلف)...",
        chargement: "تحميل الكتب الجديدة...",
        aucunLivre: "لا توجد كتب جديدة متاحة",
        aucunLivreDesc: "لم تنشر المكتبات الشريكة كتباً لهذه المعايير بعد.",
        totalDisponibles: "{{count}} كتاب جديد متاح",
        comparer: "مقارنة",
        acheter: "شراء",
        acheterNeuf: "شراء هذا الكتاب الجديد",
        confirmerAchat: "هل تريد شراء \"{{titre}}\" مقابل {{prix}} XAF؟",
        annuler: "إلغاء",
        confirmer: "تأكيد الشراء",
        achatReussi: "تم الشراء بنجاح!",
        erreurAchat: "خطأ في الشراء",
        erreurChargement: "خطأ في تحميل الكتب الجديدة",
        erreurComparaison: "خطأ في مقارنة الأسعار",
        comparaisonPrix: "مقارنة الأسعار",
        programmeOfficiel: "المنهج الرسمي",
        neufsDisponibles: "كتب جديدة متاحة",
        occasionDisponibles: "كتب مستعملة متاحة",
        aucuneComparaison: "لا توجد بيانات مقارنة لهذه الفئة."
    },
    zh: {
        title: "新书",
        subtitle: "合作书店新书目录",
        neuf: "新书",
        neufsCourt: "新书",
        auProgramme: "在课程中",
        tous: "全部",
        primaire: "小学",
        college: "初中",
        lycee: "高中",
        toutesClasses: "所有班级",
        rechercherPlaceholder: "搜索新书（书名、作者）...",
        chargement: "加载新书...",
        aucunLivre: "没有新书可用",
        aucunLivreDesc: "合作书店尚未发布符合这些标准的书籍。",
        totalDisponibles: "{{count}} 本新书可用",
        comparer: "比较",
        acheter: "购买",
        acheterNeuf: "购买这本新书",
        confirmerAchat: "您要以 {{prix}} XAF 购买 \"{{titre}}\" 吗？",
        annuler: "取消",
        confirmer: "确认购买",
        achatReussi: "购买成功！",
        erreurAchat: "购买错误",
        erreurChargement: "加载新书错误",
        erreurComparaison: "价格比较错误",
        comparaisonPrix: "价格比较",
        programmeOfficiel: "官方课程",
        neufsDisponibles: "新书可用",
        occasionDisponibles: "二手书可用",
        aucuneComparaison: "此班级没有比较数据。"
    },
    ja: {
        title: "新书",
        subtitle: "パートナー書店の新書カタログ",
        neuf: "新品",
        neufsCourt: "新品",
        auProgramme: "カリキュラム内",
        tous: "すべて",
        primaire: "小学校",
        college: "中学校",
        lycee: "高等学校",
        toutesClasses: "すべてのクラス",
        rechercherPlaceholder: "新书を検索（タイトル、著者）...",
        chargement: "新书を読み込み中...",
        aucunLivre: "利用可能な新书がありません",
        aucunLivreDesc: "パートナー書店はまだこれらの基準の本を公開していません。",
        totalDisponibles: "{{count}}冊の新书が利用可能",
        comparer: "比較",
        acheter: "購入",
        acheterNeuf: "この新书を購入",
        confirmerAchat: "\"{{titre}}\"を{{prix}} XAFで購入しますか？",
        annuler: "キャンセル",
        confirmer: "購入を確認",
        achatReussi: "購入成功！",
        erreurAchat: "購入エラー",
        erreurChargement: "新书の読み込みエラー",
        erreurComparaison: "価格比較エラー",
        comparaisonPrix: "価格比較",
        programmeOfficiel: "公式カリキュラム",
        neufsDisponibles: "新书が利用可能",
        occasionDisponibles: "中古書が利用可能",
        aucuneComparaison: "このクラスには比較データがありません。"
    },
    ko: {
        title: "새 책",
        subtitle: "파트너 서점 새 책 카탈로그",
        neuf: "새 것",
        neufsCourt: "새 것",
        auProgramme: "커리큘럼 내",
        tous: "모두",
        primaire: "초등학교",
        college: "중학교",
        lycee: "고등학교",
        toutesClasses: "모든 클래스",
        rechercherPlaceholder: "새 책 검색 (제목, 저자)...",
        chargement: "새 책 로딩 중...",
        aucunLivre: "사용 가능한 새 책이 없습니다",
        aucunLivreDesc: "파트너 서점이 아직 이 기준에 대한 책을 게시하지 않았습니다.",
        totalDisponibles: "{{count}}권의 새 책이 사용 가능",
        comparer: "비교",
        acheter: "구매",
        acheterNeuf: "이 새 책 구매",
        confirmerAchat: "\"{{titre}}\"를 {{prix}} XAF에 구매하시겠습니까?",
        annuler: "취소",
        confirmer: "구매 확인",
        achatReussi: "구매 성공!",
        erreurAchat: "구매 오류",
        erreurChargement: "새 책 로딩 오류",
        erreurComparaison: "가격 비교 오류",
        comparaisonPrix: "가격 비교",
        programmeOfficiel: "공식 커리큘럼",
        neufsDisponibles: "새 책 사용 가능",
        occasionDisponibles: "중고 책 사용 가능",
        aucuneComparaison: "이 클래스에 대한 비교 데이터가 없습니다."
    },
    ru: {
        title: "Новые книги",
        subtitle: "Каталог новых книг от книжных магазинов-партнеров",
        neuf: "Новый",
        neufsCourt: "Новые",
        auProgramme: "В программе",
        tous: "Все",
        primaire: "Начальная школа",
        college: "Средняя школа",
        lycee: "Старшая школа",
        toutesClasses: "Все классы",
        rechercherPlaceholder: "Поиск новой книги (название, автор)...",
        chargement: "Загрузка новых книг...",
        aucunLivre: "Нет доступных новых книг",
        aucunLivreDesc: "Партнерские книжные магазины еще не опубликовали книги для этих критериев.",
        totalDisponibles: "{{count}} новых книг доступно",
        comparer: "Сравнить",
        acheter: "Купить",
        acheterNeuf: "Купить эту новую книгу",
        confirmerAchat: "Хотите купить \"{{titre}}\" за {{prix}} XAF?",
        annuler: "Отмена",
        confirmer: "Подтвердить покупку",
        achatReussi: "Покупка успешна!",
        erreurAchat: "Ошибка покупки",
        erreurChargement: "Ошибка загрузки новых книг",
        erreurComparaison: "Ошибка сравнения цен",
        comparaisonPrix: "Сравнение цен",
        programmeOfficiel: "Официальная программа",
        neufsDisponibles: "Новые книги доступны",
        occasionDisponibles: "Б/У книги доступны",
        aucuneComparaison: "Нет данных сравнения для этого класса."
    },
    hi: {
        title: "नई किताबें",
        subtitle: "पार्टनर बुकस्टोर से नई किताबें कैटलॉग",
        neuf: "नई",
        neufsCourt: "नई",
        auProgramme: "पाठ्यक्रम में",
        tous: "सभी",
        primaire: "प्राथमिक",
        college: "माध्यमिक",
        lycee: "उच्च माध्यमिक",
        toutesClasses: "सभी कक्षाएं",
        rechercherPlaceholder: "नई किताब खोजें (शीर्षक, लेखक)...",
        chargement: "नई किताबें लोड हो रही हैं...",
        aucunLivre: "कोई नई किताब उपलब्ध नहीं",
        aucunLivreDesc: "पार्टनर बुकस्टोर ने अभी तक इन मानदंडों के लिए किताबें प्रकाशित नहीं की हैं।",
        totalDisponibles: "{{count}} नई किताबें उपलब्ध",
        comparer: "तुलना करें",
        acheter: "खरीदें",
        acheterNeuf: "यह नई किताब खरीदें",
        confirmerAchat: "क्या आप \"{{titre}}\" {{prix}} XAF में खरीदना चाहते हैं?",
        annuler: "रद्द करें",
        confirmer: "खरीदारी पुष्टि करें",
        achatReussi: "खरीदारी सफल!",
        erreurAchat: "खरीदारी त्रुटि",
        erreurChargement: "नई किताबें लोड करने में त्रुटि",
        erreurComparaison: "मूल्य तुलना में त्रुटि",
        comparaisonPrix: "मूल्य तुलना",
        programmeOfficiel: "आधिकारिक पाठ्यक्रम",
        neufsDisponibles: "नई किताबें उपलब्ध",
        occasionDisponibles: "प्रयुक्त किताबें उपलब्ध",
        aucuneComparaison: "इस कक्षा के लिए कोई तुलना डेटा उपलब्ध नहीं।"
    },
    // Fallback to French for all other languages
    fr: {
        title: "Livres Neufs",
        subtitle: "Catalogue de livres neufs des librairies partenaires",
        neuf: "Neuf",
        neufsCourt: "Neufs",
        auProgramme: "Au programme",
        tous: "Tous",
        primaire: "Primaire",
        college: "Collège",
        lycee: "Lycée",
        toutesClasses: "Toutes les classes",
        rechercherPlaceholder: "Rechercher un livre neuf (titre, auteur)...",
        chargement: "Chargement des livres neufs...",
        aucunLivre: "Aucun livre neuf disponible",
        aucunLivreDesc: "Les librairies partenaires n'ont pas encore publié de livres pour ces critères.",
        totalDisponibles: "{{count}} livres neufs disponibles",
        comparer: "Comparer",
        acheter: "Acheter",
        acheterNeuf: "Acheter ce livre neuf",
        confirmerAchat: "Voulez-vous acheter \"{{titre}}\" au prix de {{prix}} XAF ?",
        annuler: "Annuler",
        confirmer: "Confirmer l'achat",
        achatReussi: "Achat effectué avec succès !",
        erreurAchat: "Erreur lors de l'achat",
        erreurChargement: "Erreur lors du chargement des livres neufs",
        erreurComparaison: "Erreur lors de la comparaison des prix",
        comparaisonPrix: "Comparaison des prix",
        programmeOfficiel: "Programme officiel",
        neufsDisponibles: "Neufs disponibles",
        occasionDisponibles: "Occasion disponibles",
        aucuneComparaison: "Aucune donnée de comparaison disponible pour cette classe."
    }
};

// Map locale code to translation set (fallback to fr)
function getTranslation(locale) {
    const code = locale.replace('.json', '');
    return translations[code] || translations.fr;
}

// Main propagation
let updatedCount = 0;
files.forEach(file => {
    const filePath = path.join(localesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Check if livresNeufs already exists
    if (content.livresNeufs) {
        console.log(`✓ ${file}: livresNeufs already exists`);
        return;
    }
    
    // Determine appropriate translation set
    const locale = file.replace('.json', '');
    const t = getTranslation(locale);
    
    // Add livresNeufs section after livreScolaireHome (or before livreScolaireList)
    const keys = Object.keys(content);
    const insertIndex = keys.indexOf('livreScolaireHome') >= 0 
        ? keys.indexOf('livreScolaireHome') + 1
        : keys.indexOf('livreScolaireList') >= 0
        ? keys.indexOf('livreScolaireList')
        : keys.length;
    
    // Rebuild object with livresNeufs inserted
    const newContent = {};
    let i = 0;
    for (const key of keys) {
        newContent[key] = content[key];
        if (i === insertIndex - 1) {
            newContent.livresNeufs = t;
        }
        i++;
    }
    if (insertIndex === keys.length) {
        newContent.livresNeufs = t;
    }
    
    // Write back
    fs.writeFileSync(filePath, JSON.stringify(newContent, null, 2) + '\n');
    console.log(`✓ ${file}: Added livresNeufs (${Object.keys(t).length} keys)`);
    updatedCount++;
});

console.log(`\n✅ Done: Updated ${updatedCount} locale files with livresNeufs keys`);
