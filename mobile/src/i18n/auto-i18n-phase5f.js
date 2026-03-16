#!/usr/bin/env node
/**
 * Phase 5f: Final surgical fixes for remaining 30 user-visible French strings
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

function addKey(ns, key, frVal, enVal) {
    if (!fr[ns]) fr[ns] = {};
    if (!en[ns]) en[ns] = {};
    if (!fr[ns][key]) { fr[ns][key] = frVal; en[ns][key] = enVal; }
}

function getNamespace(filePath) {
    const match = filePath.replace(/\\/g, '/').match(/\/([^/]+)\.(tsx?|jsx?)$/);
    if (!match) return 'common';
    let name = match[1].replace(/[-_](.)/g, (_, c) => c.toUpperCase());
    return name.charAt(0).toLowerCase() + name.slice(1);
}

let totalReplacements = 0;
let totalKeys = 0;

// Each fix: [file, oldString, newString, namespace, key, frVal, enVal]
const fixes = [
    // VideoProgressModal: title="Annuler"
    ['mobile/src/components/VideoProgressModal.tsx', 'title="Annuler"', null, 'videoProgressModal', 'cancel', 'Annuler', 'Cancel'],

    // HomeScreen.minimal: Étape {step}/5
    ['mobile/src/screens/HomeScreen.minimal.tsx', '>Étape {step}/5<', '>{t(\'homeScreenMinimal.step\')} {step}/5<', 'homeScreenMinimal', 'step', 'Étape', 'Step'],

    // ManageBusSeatsScreen: Places bloquées ({blockedSeats.length})
    ['mobile/src/screens/ManageBusSeatsScreen.tsx', '>Places bloquées ({blockedSeats.length})<', '>{t(\'manageBusSeatsScreen.blockedSeats\')} ({blockedSeats.length})<', 'manageBusSeatsScreen', 'blockedSeats', 'Places bloquées', 'Blocked seats'],

    // MesEquipesScreen: Services que je co-gère
    ['mobile/src/screens/MesEquipesScreen.tsx', '>Services que je co-gère ({memberships.length})<', '>{t(\'mesEquipesScreen.servicesICoManage\')} ({memberships.length})<', 'mesEquipesScreen', 'servicesICoManage', 'Services que je co-gère', 'Services I co-manage'],

    // PubliciteDashboardScreen: Mes publicités
    ['mobile/src/screens/PubliciteDashboardScreen.tsx', '>Mes publicités ({publicites.length})<', '>{t(\'publiciteDashboardScreen.myAds\')} ({publicites.length})<', 'publiciteDashboardScreen', 'myAds', 'Mes publicités', 'My ads'],

    // NavigationScreen: Éviter
    ['mobile/src/screens/NavigationScreen.tsx', '>Éviter {p.l.toLowerCase()}<', '>{t(\'navigationScreen.avoid\')} {p.l.toLowerCase()}<', 'navigationScreen', 'avoid', 'Éviter', 'Avoid'],

    // NavigationScreen: Étapes
    ['mobile/src/screens/NavigationScreen.tsx', '>Étapes ({waypoints.length})<', '>{t(\'navigationScreen.steps\')} ({waypoints.length})<', 'navigationScreen', 'steps', 'Étapes', 'Steps'],

    // CreateServiceScreen: Étape {currentStep} sur {totalSteps}
    ['mobile/src/screens/service/CreateServiceScreen.tsx', '>Étape {currentStep} sur {totalSteps}<', '>{t(\'createServiceScreen.stepOf\', { current: currentStep, total: totalSteps })}<', 'createServiceScreen', 'stepOf', 'Étape {{current}} sur {{total}}', 'Step {{current}} of {{total}}'],

    // CreateServiceScreen_New: same
    ['mobile/src/screens/service/CreateServiceScreen_New.tsx', '>Étape {currentStep} sur {totalSteps}<', '>{t(\'createServiceScreenNew.stepOf\', { current: currentStep, total: totalSteps })}<', 'createServiceScreenNew', 'stepOf', 'Étape {{current}} sur {{total}}', 'Step {{current}} of {{total}}'],

    // AutoServicesSearchScreen: État
    ['mobile/src/screens/specialized/AutoServicesSearchScreen.tsx', '/> État', '/> {t(\'autoServicesSearchScreen.condition\')}', 'autoServicesSearchScreen', 'condition', 'État', 'Condition'],

    // CovoiturageSearchScreen: Départ
    ['mobile/src/screens/specialized/CovoiturageSearchScreen.tsx', '/> Départ', '/> {t(\'covoiturageSearchScreen.departure\')}', 'covoiturageSearchScreen', 'departure', 'Départ', 'Departure'],

    // DeclarationSinistreScreen: Dommages estimés
    ['mobile/src/screens/specialized/DeclarationSinistreScreen.tsx', '>Dommages estimés ({devise})<', '>{t(\'declarationSinistreScreen.estimatedDamages\')} ({devise})<', 'declarationSinistreScreen', 'estimatedDamages', 'Dommages estimés', 'Estimated damages'],

    // DeclarationSinistreScreen: Montant réclamé
    ['mobile/src/screens/specialized/DeclarationSinistreScreen.tsx', '>Montant réclamé ({devise})<', '>{t(\'declarationSinistreScreen.claimedAmount\')} ({devise})<', 'declarationSinistreScreen', 'claimedAmount', 'Montant réclamé', 'Claimed amount'],

    // HealthServicesHubScreen: Analyse médicale
    ['mobile/src/screens/specialized/HealthServicesHubScreen.tsx', ">Analyse{'\\n'}médicale<", ">{t('healthServicesHubScreen.medicalAnalysis')}<", 'healthServicesHubScreen', 'medicalAnalysis', 'Analyse\nmédicale', 'Medical\nanalysis'],

    // LivreScolaireSearchScreen: État du livre
    ['mobile/src/screens/specialized/LivreScolaireSearchScreen.tsx', '/> État du livre', '/> {t(\'livreScolaireSearchScreen.bookCondition\')}', 'livreScolaireSearchScreen', 'bookCondition', 'État du livre', 'Book condition'],

    // MenuWeekCalendarScreen: Coût estimé
    ['mobile/src/screens/specialized/MenuWeekCalendarScreen.tsx', '>Coût estimé ({currency', '>{t(\'menuWeekCalendarScreen.estimatedCost\')} ({currency', 'menuWeekCalendarScreen', 'estimatedCost', 'Coût estimé', 'Estimated cost'],

    // AutoDetectAndTranslate: already handled by phase5e? check
    ['mobile/src/components/AutoDetectAndTranslate.tsx', '>Langue détectée : {String(detectedLang)}<', '>{t(\'autoDetectAndTranslate.detectedLanguage\')}: {String(detectedLang)}<', 'autoDetectAndTranslate', 'detectedLanguage', 'Langue détectée', 'Detected language'],

    // ChatInputMobile: Audio enregistré
    ['mobile/src/components/ChatInputMobile.tsx', '>Audio enregistré ({formatDuration(lastRecordedDuration)})<', '>{t(\'chatInputMobile.audioRecorded\')} ({formatDuration(lastRecordedDuration)})<', 'chatInputMobile', 'audioRecorded', 'Audio enregistré', 'Audio recorded'],

    // CrashRecoveryScreen: Logs récents
    ['mobile/src/components/CrashRecoveryScreen.tsx', '>Logs récents ({logs.length}):<', '>{t(\'crashRecoveryScreen.recentLogs\')} ({logs.length}):<', 'crashRecoveryScreen', 'recentLogs', 'Logs récents', 'Recent logs'],

    // MediaManager: Aucun {activeTab} ajouté
    ['mobile/src/components/MediaManager.tsx', '>Aucun {activeTab} ajouté<', '>{t(\'mediaManager.noItemAdded\', { tab: activeTab })}<', 'mediaManager', 'noItemAdded', 'Aucun {{tab}} ajouté', 'No {{tab}} added'],

    // MediaUploadManager: Vidéos
    ['mobile/src/components/MediaUploadManager.tsx', '>Vidéos ({videos.length}/{maxVideos})<', '>{t(\'mediaUploadManager.videos\')} ({videos.length}/{maxVideos})<', 'mediaUploadManager', 'videos', 'Vidéos', 'Videos'],
];

for (const [file, oldStr, newStr, ns, key, frVal, enVal] of fixes) {
    if (!fs.existsSync(file)) { console.log('SKIP (not found):', file); continue; }
    let content = fs.readFileSync(file, 'utf8');
    
    // Special case for title="X" → title={t('ns.key')}
    let actualNew = newStr;
    if (oldStr.startsWith('title="') && !newStr) {
        actualNew = `title={t('${ns}.${key}')}`;
    }

    if (content.includes(oldStr)) {
        content = content.replace(oldStr, actualNew);
        addKey(ns, key, frVal, enVal);
        fs.writeFileSync(file, content, 'utf8');
        totalReplacements++;
        totalKeys++;
        console.log('✓', path.basename(file), ':', key);
    } else {
        console.log('✗ NOT FOUND in', path.basename(file), ':', oldStr.substring(0, 60));
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Phase 5f Results ===`);
console.log(`Replacements: ${totalReplacements}`);
console.log(`New keys: ${totalKeys}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
