/**
 * Propagate smartLanguageSelector, languageSelector, and ticketNotifications keys
 * to all locale files that don't have them yet.
 * Uses FR as template for languages without specific translations.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

// Translation map for major languages
const translations = {
    en: {
        smartLanguageSelector: {
            chooseLanguage: "Choose language",
            detectedCountry: "Detected country",
            detectingPosition: "Detecting your location...",
            suggestedLanguages: "Suggested languages",
            suggestedForYou: "Suggested for you",
            allLanguages: "All languages",
            official: "Official",
            local: "Local"
        },
        languageSelector: {
            speakers: "speakers",
            translationAvailableSoon: "Translation is available in all supported languages"
        },
        ticketNotifications: {
            reminder24hTitle: "Reminder: Your trip tomorrow",
            reminder24hBody: "{{from}} → {{to}} tomorrow at {{time}}",
            reminder2hTitle: "⏰ Departure in 2 hours!",
            reminder2hBody: "Don't forget your trip {{from}} → {{to}} at {{time}}",
            confirmationTitle: "✅ Booking confirmed",
            confirmationBody: "Your ticket {{from}} → {{to}} is confirmed",
            delayTitle: "⚠️ Delay announced",
            delayBody: "Your bus {{from}} → {{to}} is {{minutes}} minutes late"
        }
    },
    es: {
        smartLanguageSelector: {
            chooseLanguage: "Elegir idioma",
            detectedCountry: "País detectado",
            detectingPosition: "Detectando tu ubicación...",
            suggestedLanguages: "Idiomas sugeridos",
            suggestedForYou: "Sugeridos para ti",
            allLanguages: "Todos los idiomas",
            official: "Oficial",
            local: "Local"
        },
        languageSelector: {
            speakers: "hablantes",
            translationAvailableSoon: "La traducción está disponible en todos los idiomas soportados"
        },
        ticketNotifications: {
            reminder24hTitle: "Recordatorio: Tu viaje mañana",
            reminder24hBody: "{{from}} → {{to}} mañana a las {{time}}",
            reminder2hTitle: "⏰ ¡Salida en 2 horas!",
            reminder2hBody: "No olvides tu viaje {{from}} → {{to}} a las {{time}}",
            confirmationTitle: "✅ Reserva confirmada",
            confirmationBody: "Tu ticket {{from}} → {{to}} está confirmado",
            delayTitle: "⚠️ Retraso anunciado",
            delayBody: "Tu bus {{from}} → {{to}} tiene {{minutes}} minutos de retraso"
        }
    },
    de: {
        smartLanguageSelector: {
            chooseLanguage: "Sprache wählen",
            detectedCountry: "Erkanntes Land",
            detectingPosition: "Standort wird erkannt...",
            suggestedLanguages: "Vorgeschlagene Sprachen",
            suggestedForYou: "Für Sie vorgeschlagen",
            allLanguages: "Alle Sprachen",
            official: "Offiziell",
            local: "Lokal"
        },
        languageSelector: {
            speakers: "Sprecher",
            translationAvailableSoon: "Die Übersetzung ist in allen unterstützten Sprachen verfügbar"
        },
        ticketNotifications: {
            reminder24hTitle: "Erinnerung: Ihre Reise morgen",
            reminder24hBody: "{{from}} → {{to}} morgen um {{time}}",
            reminder2hTitle: "⏰ Abfahrt in 2 Stunden!",
            reminder2hBody: "Vergessen Sie nicht Ihre Reise {{from}} → {{to}} um {{time}}",
            confirmationTitle: "✅ Buchung bestätigt",
            confirmationBody: "Ihr Ticket {{from}} → {{to}} ist bestätigt",
            delayTitle: "⚠️ Verspätung angekündigt",
            delayBody: "Ihr Bus {{from}} → {{to}} hat {{minutes}} Minuten Verspätung"
        }
    },
    pt: {
        smartLanguageSelector: {
            chooseLanguage: "Escolher idioma",
            detectedCountry: "País detectado",
            detectingPosition: "Detectando sua localização...",
            suggestedLanguages: "Idiomas sugeridos",
            suggestedForYou: "Sugeridos para você",
            allLanguages: "Todos os idiomas",
            official: "Oficial",
            local: "Local"
        },
        languageSelector: {
            speakers: "falantes",
            translationAvailableSoon: "A tradução está disponível em todos os idiomas suportados"
        },
        ticketNotifications: {
            reminder24hTitle: "Lembrete: Sua viagem amanhã",
            reminder24hBody: "{{from}} → {{to}} amanhã às {{time}}",
            reminder2hTitle: "⏰ Partida em 2 horas!",
            reminder2hBody: "Não esqueça sua viagem {{from}} → {{to}} às {{time}}",
            confirmationTitle: "✅ Reserva confirmada",
            confirmationBody: "Seu ticket {{from}} → {{to}} está confirmado",
            delayTitle: "⚠️ Atraso anunciado",
            delayBody: "Seu ônibus {{from}} → {{to}} tem {{minutes}} minutos de atraso"
        }
    },
    ar: {
        smartLanguageSelector: {
            chooseLanguage: "اختر اللغة",
            detectedCountry: "البلد المكتشف",
            detectingPosition: "جاري تحديد موقعك...",
            suggestedLanguages: "اللغات المقترحة",
            suggestedForYou: "مقترحة لك",
            allLanguages: "جميع اللغات",
            official: "رسمي",
            local: "محلي"
        },
        languageSelector: {
            speakers: "متحدث",
            translationAvailableSoon: "الترجمة متوفرة بجميع اللغات المدعومة"
        },
        ticketNotifications: {
            reminder24hTitle: "تذكير: رحلتك غداً",
            reminder24hBody: "{{from}} → {{to}} غداً الساعة {{time}}",
            reminder2hTitle: "⏰ المغادرة خلال ساعتين!",
            reminder2hBody: "لا تنسَ رحلتك {{from}} → {{to}} الساعة {{time}}",
            confirmationTitle: "✅ تم تأكيد الحجز",
            confirmationBody: "تذكرتك {{from}} → {{to}} مؤكدة",
            delayTitle: "⚠️ تأخير معلن",
            delayBody: "حافلتك {{from}} → {{to}} متأخرة {{minutes}} دقيقة"
        }
    },
    sw: {
        smartLanguageSelector: {
            chooseLanguage: "Chagua lugha",
            detectedCountry: "Nchi iliyogunduliwa",
            detectingPosition: "Inatafuta eneo lako...",
            suggestedLanguages: "Lugha zilizopendekezwa",
            suggestedForYou: "Zimependekezwa kwako",
            allLanguages: "Lugha zote",
            official: "Rasmi",
            local: "Ya mtaa"
        },
        languageSelector: {
            speakers: "wazungumzaji",
            translationAvailableSoon: "Tafsiri inapatikana katika lugha zote zinazotumika"
        },
        ticketNotifications: {
            reminder24hTitle: "Kumbusho: Safari yako kesho",
            reminder24hBody: "{{from}} → {{to}} kesho saa {{time}}",
            reminder2hTitle: "⏰ Kuondoka kwa masaa 2!",
            reminder2hBody: "Usisahau safari yako {{from}} → {{to}} saa {{time}}",
            confirmationTitle: "✅ Uhifadhi umethibitishwa",
            confirmationBody: "Tiketi yako {{from}} → {{to}} imethibitishwa",
            delayTitle: "⚠️ Kuchelewa kumetangazwa",
            delayBody: "Basi yako {{from}} → {{to}} imechelewa dakika {{minutes}}"
        }
    },
    zh: {
        smartLanguageSelector: {
            chooseLanguage: "选择语言",
            detectedCountry: "检测到的国家",
            detectingPosition: "正在检测您的位置...",
            suggestedLanguages: "推荐语言",
            suggestedForYou: "为您推荐",
            allLanguages: "所有语言",
            official: "官方",
            local: "本地"
        },
        languageSelector: {
            speakers: "使用者",
            translationAvailableSoon: "翻译已支持所有语言"
        },
        ticketNotifications: {
            reminder24hTitle: "提醒：您明天的行程",
            reminder24hBody: "{{from}} → {{to}} 明天 {{time}}",
            reminder2hTitle: "⏰ 2小时后出发！",
            reminder2hBody: "别忘了您的行程 {{from}} → {{to}} {{time}}",
            confirmationTitle: "✅ 预订已确认",
            confirmationBody: "您的票 {{from}} → {{to}} 已确认",
            delayTitle: "⚠️ 延迟通知",
            delayBody: "您的巴士 {{from}} → {{to}} 延迟 {{minutes}} 分钟"
        }
    },
    hi: {
        smartLanguageSelector: {
            chooseLanguage: "भाषा चुनें",
            detectedCountry: "पहचाना गया देश",
            detectingPosition: "आपका स्थान पता लगा रहे हैं...",
            suggestedLanguages: "सुझाई गई भाषाएं",
            suggestedForYou: "आपके लिए सुझाव",
            allLanguages: "सभी भाषाएं",
            official: "आधिकारिक",
            local: "स्थानीय"
        },
        languageSelector: {
            speakers: "वक्ता",
            translationAvailableSoon: "अनुवाद सभी समर्थित भाषाओं में उपलब्ध है"
        },
        ticketNotifications: {
            reminder24hTitle: "अनुस्मारक: कल आपकी यात्रा",
            reminder24hBody: "{{from}} → {{to}} कल {{time}} बजे",
            reminder2hTitle: "⏰ 2 घंटे में प्रस्थान!",
            reminder2hBody: "अपनी यात्रा न भूलें {{from}} → {{to}} {{time}} बजे",
            confirmationTitle: "✅ बुकिंग पुष्ट",
            confirmationBody: "आपका टिकट {{from}} → {{to}} पुष्ट है",
            delayTitle: "⚠️ विलंब की घोषणा",
            delayBody: "आपकी बस {{from}} → {{to}} {{minutes}} मिनट देरी से है"
        }
    },
    ru: {
        smartLanguageSelector: {
            chooseLanguage: "Выбрать язык",
            detectedCountry: "Обнаруженная страна",
            detectingPosition: "Определяем ваше местоположение...",
            suggestedLanguages: "Рекомендуемые языки",
            suggestedForYou: "Рекомендации для вас",
            allLanguages: "Все языки",
            official: "Официальный",
            local: "Местный"
        },
        languageSelector: {
            speakers: "говорящих",
            translationAvailableSoon: "Перевод доступен на всех поддерживаемых языках"
        },
        ticketNotifications: {
            reminder24hTitle: "Напоминание: Ваша поездка завтра",
            reminder24hBody: "{{from}} → {{to}} завтра в {{time}}",
            reminder2hTitle: "⏰ Отправление через 2 часа!",
            reminder2hBody: "Не забудьте о поездке {{from}} → {{to}} в {{time}}",
            confirmationTitle: "✅ Бронирование подтверждено",
            confirmationBody: "Ваш билет {{from}} → {{to}} подтвержден",
            delayTitle: "⚠️ Объявлена задержка",
            delayBody: "Ваш автобус {{from}} → {{to}} опаздывает на {{minutes}} минут"
        }
    },
    ja: {
        smartLanguageSelector: {
            chooseLanguage: "言語を選択",
            detectedCountry: "検出された国",
            detectingPosition: "現在地を検出中...",
            suggestedLanguages: "おすすめの言語",
            suggestedForYou: "あなたへのおすすめ",
            allLanguages: "すべての言語",
            official: "公式",
            local: "ローカル"
        },
        languageSelector: {
            speakers: "話者",
            translationAvailableSoon: "翻訳はすべての対応言語で利用できます"
        },
        ticketNotifications: {
            reminder24hTitle: "リマインダー：明日の旅行",
            reminder24hBody: "{{from}} → {{to}} 明日 {{time}}",
            reminder2hTitle: "⏰ 出発まで2時間！",
            reminder2hBody: "旅行をお忘れなく {{from}} → {{to}} {{time}}",
            confirmationTitle: "✅ 予約確認済み",
            confirmationBody: "チケット {{from}} → {{to}} が確認されました",
            delayTitle: "⚠️ 遅延のお知らせ",
            delayBody: "バス {{from}} → {{to}} は {{minutes}} 分遅れています"
        }
    }
};

// FR template (fallback for all languages without specific translations)
const frTemplate = {
    smartLanguageSelector: {
        chooseLanguage: "Choisir la langue",
        detectedCountry: "Pays détecté",
        detectingPosition: "Détection de votre position...",
        suggestedLanguages: "Langues suggérées",
        suggestedForYou: "Suggérées pour vous",
        allLanguages: "Toutes les langues",
        official: "Officiel",
        local: "Local"
    },
    languageSelector: {
        speakers: "locuteurs",
        translationAvailableSoon: "La traduction est disponible dans toutes les langues supportées"
    },
    ticketNotifications: {
        reminder24hTitle: "Rappel : Votre voyage demain",
        reminder24hBody: "{{from}} → {{to}} demain à {{time}}",
        reminder2hTitle: "⏰ Départ dans 2 heures !",
        reminder2hBody: "N'oubliez pas votre voyage {{from}} → {{to}} à {{time}}",
        confirmationTitle: "✅ Réservation confirmée",
        confirmationBody: "Votre ticket {{from}} → {{to}} est confirmé",
        delayTitle: "⚠️ Retard annoncé",
        delayBody: "Votre bus {{from}} → {{to}} a {{minutes}} minutes de retard"
    }
};

let updated = 0;
let skipped = 0;

for (const file of files) {
    const langCode = file.replace('.json', '');
    const filePath = path.join(localesDir, file);
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let changed = false;
        
        // Get translations for this language, fallback to EN, then FR
        const langTranslations = translations[langCode] || translations['en'] || frTemplate;
        
        // Add missing sections
        for (const section of ['smartLanguageSelector', 'languageSelector', 'ticketNotifications']) {
            if (!data[section]) {
                data[section] = langTranslations[section] || frTemplate[section];
                changed = true;
            } else {
                // Add any missing keys within the section
                const source = langTranslations[section] || frTemplate[section];
                for (const [key, value] of Object.entries(source)) {
                    if (!data[section][key]) {
                        data[section][key] = value;
                        changed = true;
                    }
                }
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

console.log(`Done: ${updated} files updated, ${skipped} already up to date`);
