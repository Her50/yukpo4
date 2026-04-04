/**
 * Propagate trendPulse screen i18n keys to all 62 locale files.
 * FR is already updated manually. EN is already updated manually.
 * For all other locales: use language-specific translations for major languages,
 * fallback to FR for all others.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const translations = {
  fr: {
    screenTitle: "TrendPulse", tabForMe: "Pour moi", tabGlobal: "Global", tabSectors: "Secteurs",
    loading: "Analyse des tendances...", profileTitle: "Ton profil commercial",
    profileSummary: "{{products}} produits · {{sectors}} · {{cities}}",
    opportunities: "{{count}} opportunité", opportunitiesPlural: "{{count}} opportunités",
    trendsCount: "{{count}} tendance liée à ton catalogue",
    trendsCountPlural: "{{count}} tendances liées à ton catalogue",
    emptyForMe: "Aucune tendance ne correspond à tes produits actuellement.",
    emptyGlobal: "Aucune tendance disponible pour cette région.",
    emptyAddProducts: "Ajouter des produits", emptySectors: "Données sectorielles indisponibles",
    regionCM: "Cameroun", regionSN: "Sénégal", regionCI: "Côte d'Ivoire", regionNG: "Nigeria",
    period24h: "24h", period7d: "7 jours", period30d: "30 jours", sectorGrowth: "+{{pct}}%"
  },
  en: {
    screenTitle: "TrendPulse", tabForMe: "For me", tabGlobal: "Global", tabSectors: "Sectors",
    loading: "Analyzing trends...", profileTitle: "Your business profile",
    profileSummary: "{{products}} products · {{sectors}} · {{cities}}",
    opportunities: "{{count}} opportunity", opportunitiesPlural: "{{count}} opportunities",
    trendsCount: "{{count}} trend linked to your catalog",
    trendsCountPlural: "{{count}} trends linked to your catalog",
    emptyForMe: "No trends currently match your products.",
    emptyGlobal: "No trends available for this region.",
    emptyAddProducts: "Add products", emptySectors: "Sector data unavailable",
    regionCM: "Cameroon", regionSN: "Senegal", regionCI: "Ivory Coast", regionNG: "Nigeria",
    period24h: "24h", period7d: "7 days", period30d: "30 days", sectorGrowth: "+{{pct}}%"
  },
  ar: {
    screenTitle: "TrendPulse", tabForMe: "لي", tabGlobal: "عالمي", tabSectors: "القطاعات",
    loading: "تحليل الاتجاهات...", profileTitle: "ملفك التجاري",
    profileSummary: "{{products}} منتجات · {{sectors}} · {{cities}}",
    opportunities: "{{count}} فرصة", opportunitiesPlural: "{{count}} فرص",
    trendsCount: "{{count}} اتجاه مرتبط بكتالوجك",
    trendsCountPlural: "{{count}} اتجاهات مرتبطة بكتالوجك",
    emptyForMe: "لا توجد اتجاهات تطابق منتجاتك حالياً.",
    emptyGlobal: "لا توجد اتجاهات متاحة لهذه المنطقة.",
    emptyAddProducts: "إضافة منتجات", emptySectors: "بيانات القطاعات غير متوفرة",
    regionCM: "الكاميرون", regionSN: "السنغال", regionCI: "ساحل العاج", regionNG: "نيجيريا",
    period24h: "24 ساعة", period7d: "7 أيام", period30d: "30 يوم", sectorGrowth: "+{{pct}}%"
  },
  es: {
    screenTitle: "TrendPulse", tabForMe: "Para mí", tabGlobal: "Global", tabSectors: "Sectores",
    loading: "Analizando tendencias...", profileTitle: "Tu perfil comercial",
    profileSummary: "{{products}} productos · {{sectors}} · {{cities}}",
    opportunities: "{{count}} oportunidad", opportunitiesPlural: "{{count}} oportunidades",
    trendsCount: "{{count}} tendencia vinculada a tu catálogo",
    trendsCountPlural: "{{count}} tendencias vinculadas a tu catálogo",
    emptyForMe: "Ninguna tendencia corresponde a tus productos actualmente.",
    emptyGlobal: "No hay tendencias disponibles para esta región.",
    emptyAddProducts: "Agregar productos", emptySectors: "Datos sectoriales no disponibles",
    regionCM: "Camerún", regionSN: "Senegal", regionCI: "Costa de Marfil", regionNG: "Nigeria",
    period24h: "24h", period7d: "7 días", period30d: "30 días", sectorGrowth: "+{{pct}}%"
  },
  pt: {
    screenTitle: "TrendPulse", tabForMe: "Para mim", tabGlobal: "Global", tabSectors: "Setores",
    loading: "Analisando tendências...", profileTitle: "Seu perfil comercial",
    profileSummary: "{{products}} produtos · {{sectors}} · {{cities}}",
    opportunities: "{{count}} oportunidade", opportunitiesPlural: "{{count}} oportunidades",
    trendsCount: "{{count}} tendência vinculada ao seu catálogo",
    trendsCountPlural: "{{count}} tendências vinculadas ao seu catálogo",
    emptyForMe: "Nenhuma tendência corresponde aos seus produtos atualmente.",
    emptyGlobal: "Nenhuma tendência disponível para esta região.",
    emptyAddProducts: "Adicionar produtos", emptySectors: "Dados setoriais indisponíveis",
    regionCM: "Camarões", regionSN: "Senegal", regionCI: "Costa do Marfim", regionNG: "Nigéria",
    period24h: "24h", period7d: "7 dias", period30d: "30 dias", sectorGrowth: "+{{pct}}%"
  },
  sw: {
    screenTitle: "TrendPulse", tabForMe: "Kwangu", tabGlobal: "Kimataifa", tabSectors: "Sekta",
    loading: "Inachambua mwelekeo...", profileTitle: "Wasifu wako wa biashara",
    profileSummary: "bidhaa {{products}} · {{sectors}} · {{cities}}",
    opportunities: "fursa {{count}}", opportunitiesPlural: "fursa {{count}}",
    trendsCount: "mwelekeo {{count}} unaohusiana na katalogi yako",
    trendsCountPlural: "mwelekeo {{count}} unaohusiana na katalogi yako",
    emptyForMe: "Hakuna mwelekeo unaolingana na bidhaa zako kwa sasa.",
    emptyGlobal: "Hakuna mwelekeo unaopatikana kwa eneo hili.",
    emptyAddProducts: "Ongeza bidhaa", emptySectors: "Data ya sekta haipatikani",
    regionCM: "Kamerun", regionSN: "Senegal", regionCI: "Pwani ya Pembe", regionNG: "Nigeria",
    period24h: "24h", period7d: "Siku 7", period30d: "Siku 30", sectorGrowth: "+{{pct}}%"
  },
  ha: {
    screenTitle: "TrendPulse", tabForMe: "Nawa", tabGlobal: "Duniya", tabSectors: "Sassa",
    loading: "Ana nazarin yanayi...", profileTitle: "Bayanan kasuwancin ku",
    profileSummary: "kayan {{products}} · {{sectors}} · {{cities}}",
    opportunities: "dama {{count}}", opportunitiesPlural: "dama {{count}}",
    trendsCount: "yanayi {{count}} da ke da alaƙa da katalogu ɗin ku",
    trendsCountPlural: "yanayi {{count}} da ke da alaƙa da katalogu ɗin ku",
    emptyForMe: "Babu yanayi da ya dace da samfuranku a yanzu.",
    emptyGlobal: "Babu yanayi da ake samu a wannan yanki.",
    emptyAddProducts: "Ƙara kayan", emptySectors: "Bayanin fannonin ba ya samuwa",
    regionCM: "Kamaru", regionSN: "Senegal", regionCI: "Ivory Coast", regionNG: "Najeriya",
    period24h: "24h", period7d: "Kwanaki 7", period30d: "Kwanaki 30", sectorGrowth: "+{{pct}}%"
  },
  yo: {
    screenTitle: "TrendPulse", tabForMe: "Fun mi", tabGlobal: "Agbaye", tabSectors: "Awọn eka",
    loading: "N ṣe itupalẹ awọn aṣa...", profileTitle: "Profaili iṣowo rẹ",
    profileSummary: "ọja {{products}} · {{sectors}} · {{cities}}",
    opportunities: "anfani {{count}}", opportunitiesPlural: "anfani {{count}}",
    trendsCount: "aṣa {{count}} ti o ni ibatan si katalogi rẹ",
    trendsCountPlural: "aṣa {{count}} ti o ni ibatan si katalogi rẹ",
    emptyForMe: "Ko si aṣa ti o baamu awọn ọja rẹ lọwọlọwọ.",
    emptyGlobal: "Ko si aṣa ti o wa fun agbegbe yii.",
    emptyAddProducts: "Fi ọja kun", emptySectors: "Data eka ko si",
    regionCM: "Kamẹru", regionSN: "Sẹnẹgali", regionCI: "Ivory Coast", regionNG: "Naijiria",
    period24h: "24h", period7d: "Ọjọ 7", period30d: "Ọjọ 30", sectorGrowth: "+{{pct}}%"
  },
  zh: {
    screenTitle: "TrendPulse", tabForMe: "为我", tabGlobal: "全球", tabSectors: "行业",
    loading: "分析趋势中...", profileTitle: "您的商业档案",
    profileSummary: "{{products}} 件产品 · {{sectors}} · {{cities}}",
    opportunities: "{{count}} 个机会", opportunitiesPlural: "{{count}} 个机会",
    trendsCount: "{{count}} 个与您目录相关的趋势",
    trendsCountPlural: "{{count}} 个与您目录相关的趋势",
    emptyForMe: "目前没有与您产品匹配的趋势。",
    emptyGlobal: "该地区暂无可用趋势。",
    emptyAddProducts: "添加产品", emptySectors: "行业数据不可用",
    regionCM: "喀麦隆", regionSN: "塞内加尔", regionCI: "科特迪瓦", regionNG: "尼日利亚",
    period24h: "24小时", period7d: "7天", period30d: "30天", sectorGrowth: "+{{pct}}%"
  },
  hi: {
    screenTitle: "TrendPulse", tabForMe: "मेरे लिए", tabGlobal: "वैश्विक", tabSectors: "क्षेत्र",
    loading: "रुझान विश्लेषण...", profileTitle: "आपका व्यावसायिक प्रोफ़ाइल",
    profileSummary: "{{products}} उत्पाद · {{sectors}} · {{cities}}",
    opportunities: "{{count}} अवसर", opportunitiesPlural: "{{count}} अवसर",
    trendsCount: "{{count}} रुझान आपकी सूची से जुड़ा",
    trendsCountPlural: "{{count}} रुझान आपकी सूची से जुड़े",
    emptyForMe: "अभी कोई भी रुझान आपके उत्पादों से मेल नहीं खाता।",
    emptyGlobal: "इस क्षेत्र के लिए कोई रुझान उपलब्ध नहीं।",
    emptyAddProducts: "उत्पाद जोड़ें", emptySectors: "क्षेत्र डेटा अनुपलब्ध",
    regionCM: "कैमरून", regionSN: "सेनेगल", regionCI: "आइवरी कोस्ट", regionNG: "नाइजीरिया",
    period24h: "24 घंटे", period7d: "7 दिन", period30d: "30 दिन", sectorGrowth: "+{{pct}}%"
  },
  ru: {
    screenTitle: "TrendPulse", tabForMe: "Для меня", tabGlobal: "Глобально", tabSectors: "Секторы",
    loading: "Анализ трендов...", profileTitle: "Ваш бизнес-профиль",
    profileSummary: "{{products}} товаров · {{sectors}} · {{cities}}",
    opportunities: "{{count}} возможность", opportunitiesPlural: "{{count}} возможности",
    trendsCount: "{{count}} тренд, связанный с вашим каталогом",
    trendsCountPlural: "{{count}} трендов, связанных с вашим каталогом",
    emptyForMe: "Нет трендов, соответствующих вашим продуктам.",
    emptyGlobal: "Нет трендов для этого региона.",
    emptyAddProducts: "Добавить товары", emptySectors: "Данные по секторам недоступны",
    regionCM: "Камерун", regionSN: "Сенегал", regionCI: "Кот-д'Ивуар", regionNG: "Нигерия",
    period24h: "24ч", period7d: "7 дней", period30d: "30 дней", sectorGrowth: "+{{pct}}%"
  },
};

const fallback = translations.fr;

let updated = 0;
let skipped = 0;

for (const file of files) {
  const langCode = file.replace('.json', '');
  // fr et en already done manually
  if (langCode === 'fr' || langCode === 'en') {
    skipped++;
    continue;
  }
  const filePath = path.join(localesDir, file);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = translations[langCode] || fallback;

    if (!data.trendPulse) {
      data.trendPulse = keys;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
      updated++;
    } else {
      // Ajouter les clés manquantes
      let changed = false;
      for (const [key, value] of Object.entries(keys)) {
        if (data.trendPulse[key] === undefined) {
          data.trendPulse[key] = value;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        updated++;
      } else {
        skipped++;
      }
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

console.log(`TrendPulse screen i18n: ${updated} files updated, ${skipped} skipped`);
