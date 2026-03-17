const fs = require('fs');
const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

if (!fr.productManagerMobile) fr.productManagerMobile = {};
if (!en.productManagerMobile) en.productManagerMobile = {};

fr.productManagerMobile.conseilRestauration = "💡 Conseil Restauration : Plus vous détaillez votre carte et vos spécialités locales, plus vous aurez de visibilité auprès des clients recherchant des plats spécifiques !\n\n🍽️ Ajoutez au minimum 3-5 plats phares de votre carte\n🍹 Précisez vos boissons locales (bissap, gingembre, etc.)\n🚗 Indiquez vos zones de livraison pour attirer les clients à proximité";
en.productManagerMobile.conseilRestauration = "💡 Restaurant Tips: The more you detail your menu and local specialties, the more visibility you will get!\n\n🍽️ Add at least 3-5 signature dishes from your menu\n🍹 Specify your local drinks (bissap, ginger, etc.)\n🚗 Indicate your delivery areas to attract nearby customers";

fr.productManagerMobile.conseilHighTech = "💡 Conseil High-Tech : Précisez les spécifications techniques, l'état exact (rayures, fonctionnement), et ajoutez des photos de qualité pour rassurer les acheteurs !\n\n📸 Photos recommandées : Vue d'ensemble, écran allumé, ports/connectiques, emballage/accessoires\n🎯 Mentionnez la version/année du modèle pour plus de précision";
en.productManagerMobile.conseilHighTech = "💡 High-Tech Tips: Specify technical specifications, exact condition (scratches, functionality), and add quality photos to reassure buyers!\n\n📸 Recommended photos: Overview, screen on, ports/connectors, packaging/accessories\n🎯 Mention the version/year of the model for more precision";

fr.productManagerMobile.conseilFormation = "💡 Conseil Formation : Plus vous détaillez votre programme, vos objectifs pédagogiques et vos résultats attendus, plus vous attirerez des candidats motivés !\n\n🎓 Mentionnez les certifications reconnues (Cambridge, TOEFL, etc.)\n👨‍🏫 Indiquez l'expérience et les qualifications du formateur\n📊 Précisez le taux de réussite aux examens ou concours\n🎯 Listez les débouchés professionnels après la formation";
en.productManagerMobile.conseilFormation = "💡 Training Tips: The more you detail your program, learning objectives and expected results, the more you will attract motivated candidates!\n\n🎓 Mention recognized certifications (Cambridge, TOEFL, etc.)\n👨‍🏫 Indicate the trainer's experience and qualifications\n📊 Specify the pass rate for exams or competitions\n🎯 List career opportunities after the training";

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR: Valid'); } catch (e) { console.log('FR: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch (e) { console.log('EN: INVALID', e.message); }
console.log('Done - 3 hint keys added');
