/**
 * Propagate TrendPulse i18n keys to all 62 locale files.
 * Adds `ai.featureTrendTitle` and `ai.featureTrendDesc` to every locale.
 * Uses language-specific translations for major languages, FR as fallback for others.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

// Translations per language code
const trendKeys = {
  fr: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendances du marché africain en temps réel — personnalisées pour ton activité',
  },
  en: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'African market trends in real time — personalized for your business',
  },
  ar: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'اتجاهات السوق الأفريقية في الوقت الحقيقي — مخصصة لنشاطك التجاري',
  },
  es: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendencias del mercado africano en tiempo real — personalizadas para tu negocio',
  },
  pt: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendências do mercado africano em tempo real — personalizadas para o seu negócio',
  },
  sw: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Mwelekeo wa soko la Afrika kwa wakati halisi — umbiwa kwa biashara yako',
  },
  ha: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Yanayin kasuwar Afirka a lokaci na gaske — an keɓance don kasuwancin ku',
  },
  yo: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Awọn aṣa ọja Afirika ni akoko gidi — ti a ṣe deede fun iṣowo rẹ',
  },
  ig: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Ọnọdụ ahịa Africa n\'oge n\'oge — e haziri maka azụmahịa gị',
  },
  wo: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Yëgël yi ci màrse bi Afrig ci diggante — bëgg na bind ci liggéey bi nga def',
  },
  zh: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: '非洲市场实时趋势 — 为您的业务量身定制',
  },
  hi: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'अफ्रीकी बाजार के रियल-टाइम ट्रेंड — आपके व्यवसाय के लिए व्यक्तिगत',
  },
  ru: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Тренды африканского рынка в реальном времени — персонализированы для вашего бизнеса',
  },
  ja: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'アフリカ市場のリアルタイムトレンド — あなたのビジネスに合わせてカスタマイズ',
  },
  de: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Afrikanische Markttrends in Echtzeit — personalisiert für Ihr Unternehmen',
  },
  it: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendenze del mercato africano in tempo reale — personalizzate per la tua attività',
  },
  nl: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Afrikaanse markttrends in realtime — gepersonaliseerd voor uw bedrijf',
  },
  tr: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Afrika piyasası trendleri gerçek zamanlı — işletmenize özel',
  },
  pl: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Trendy afrykańskiego rynku w czasie rzeczywistym — spersonalizowane pod Twój biznes',
  },
  uk: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Тренди африканського ринку в реальному часі — персоналізовані для вашого бізнесу',
  },
  vi: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Xu hướng thị trường châu Phi theo thời gian thực — được cá nhân hóa cho doanh nghiệp của bạn',
  },
  id: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tren pasar Afrika secara real-time — dipersonalisasi untuk bisnis Anda',
  },
  ms: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Trend pasaran Afrika dalam masa nyata — diperibadikan untuk perniagaan anda',
  },
  th: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'เทรนด์ตลาดแอฟริกาแบบเรียลไทม์ — ปรับแต่งสำหรับธุรกิจของคุณ',
  },
  ko: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: '아프리카 시장 실시간 트렌드 — 비즈니스에 맞게 개인화',
  },
  bn: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'আফ্রিকার বাজারের রিয়েল-টাইম ট্রেন্ড — আপনার ব্যবসার জন্য ব্যক্তিগতকৃত',
  },
  // African languages — FR as base, adapted label
  dua: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Buka bi a Afrika na wakati — a bêbê na mosûma mô',
  },
  ewo: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendances du marché africain en temps réel — pour votre activité',
  },
  bbj: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendances du marché africain en temps réel — pour votre activité',
  },
  bum: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendances du marché africain en temps réel — pour votre activité',
  },
  fan: {
    featureTrendTitle: 'TrendPulse',
    featureTrendDesc: 'Tendances du marché africain en temps réel — pour votre activité',
  },
};

// Fallback for all unspecified languages
const fallback = {
  featureTrendTitle: 'TrendPulse',
  featureTrendDesc: 'Tendances du marché africain en temps réel — personnalisées pour ton activité',
};

let updated = 0;
let skipped = 0;

for (const file of files) {
  const langCode = file.replace('.json', '');
  const filePath = path.join(localesDir, file);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = trendKeys[langCode] || fallback;

    if (!data.ai) {
      // Section ai absente — créer avec les nouvelles clés seulement
      data.ai = keys;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
      updated++;
      continue;
    }

    let changed = false;
    for (const [key, value] of Object.entries(keys)) {
      if (!data.ai[key]) {
        data.ai[key] = value;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
      updated++;
    } else {
      skipped++;
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

console.log(`TrendPulse i18n: ${updated} files updated, ${skipped} already up to date`);
