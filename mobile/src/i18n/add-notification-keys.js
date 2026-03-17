const fs = require('fs');

const frPath = 'mobile/src/i18n/locales/fr.json';
const enPath = 'mobile/src/i18n/locales/en.json';

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

fr.ticketNotifications = {
    reminder24hTitle: "Rappel : Votre voyage demain",
    reminder24hBody: "{{from}} \u2192 {{to}} demain \u00e0 {{time}}",
    reminder2hTitle: "\u23f0 D\u00e9part dans 2 heures !",
    reminder2hBody: "N'oubliez pas votre voyage {{from}} \u2192 {{to}} \u00e0 {{time}}",
    confirmationTitle: "\u2705 R\u00e9servation confirm\u00e9e",
    confirmationBody: "Votre ticket {{from}} \u2192 {{to}} est confirm\u00e9",
    delayTitle: "\u26a0\ufe0f Retard annonc\u00e9",
    delayBody: "Votre bus {{from}} \u2192 {{to}} a {{minutes}} minutes de retard"
};

en.ticketNotifications = {
    reminder24hTitle: "Reminder: Your trip tomorrow",
    reminder24hBody: "{{from}} \u2192 {{to}} tomorrow at {{time}}",
    reminder2hTitle: "\u23f0 Departure in 2 hours!",
    reminder2hBody: "Don't forget your trip {{from}} \u2192 {{to}} at {{time}}",
    confirmationTitle: "\u2705 Booking confirmed",
    confirmationBody: "Your ticket {{from}} \u2192 {{to}} is confirmed",
    delayTitle: "\u26a0\ufe0f Delay announced",
    delayBody: "Your bus {{from}} \u2192 {{to}} is {{minutes}} minutes late"
};

fs.writeFileSync(frPath, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 4), 'utf8');
console.log('Added ticketNotifications keys to FR and EN');
