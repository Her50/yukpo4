// ✅ REFONTE 2026-03-16: Hook de paiement à la consommation pour NavigationScreen
// Gère: estimation coût, vérification solde, débit, redirection recharge,
// compteur d'échecs, dette cumulée progressive, recouvrement automatique,
// alerte de suspension avec montant dette, blocage après N échecs
// ✅ Tarification dynamique (backend) + multi-devises (GPS/profil)
// ✅ NOUVEAU: Abonnement coaching mensuel + suspension alertes communautaires

import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useToaster } from '../components/ToasterProvider';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiPost } from '../services/api';
import { coachingNotificationService } from '../services/coachingNotificationService';
import {
    estimatePoiCost, fetchDynamicPricing, formatPrice,
    formatPriceInCurrency, getMicroFeaturePrice,
    MICRO_PAYMENT_POLICY
} from '../services/navigationPricing';
import SafeStorage from '../utils/safeStorage';
import { useCurrencyDetection } from './useCurrencyDetection';

interface DebitResult {
    success: boolean;
    newBalance?: number;
    error?: string;
}

const { MAX_UNPAID_USES, SUSPENSION_ALERT_THRESHOLD, SUSPENSION_STORAGE_KEY, DEBT_STORAGE_KEY, DEBT_AUTO_RECOVER } = MICRO_PAYMENT_POLICY;
const NAVIGATION_FREE_UNTIL = new Date('2026-04-30T23:59:59.999Z').getTime();
const NAVIGATION_FREE_UNTIL_LABEL = '30/04/2026';
const INDEPENDENT_NAV_FEATURES = new Set(['ai_coach']);

export function useNavigationPayment() {
    const { user, refreshUser } = useAuth();
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const toaster = useToaster();
    const userCurrency = useCurrencyDetection();

    const currentBalance = user?.credits ?? 0;
    const isNavigationFreePeriod = Date.now() <= NAVIGATION_FREE_UNTIL;

    // ── Charger les tarifs dynamiques au montage ──
    useEffect(() => {
        fetchDynamicPricing().then((state) => {
            console.log(`[NavigationPayment] Tarifs chargés (source: ${state.source}, devise: ${userCurrency})`);
        }).catch(() => { });
    }, []);

    // ── Compteur d'échecs + dette cumulée micro-paiements (persistés) ──
    const [unpaidCount, setUnpaidCount] = useState(0);
    const [unpaidDebt, setUnpaidDebt] = useState(0); // montant total dû en XAF
    const [isSuspended, setIsSuspended] = useState(false);
    const alertShownRef = useRef(false);
    const debtRecoveryInProgressRef = useRef(false);

    // ── État abonnement coaching mensuel ──
    const COACHING_STORAGE_KEY = 'nav_coaching_subscription';
    const COACHING_REMINDER_KEY = 'nav_coaching_reminder_shown';
    const COACHING_TRIAL_KEY = 'nav_coaching_trial_used'; // Track si l'essai gratuit a été utilisé
    const COACHING_TRIAL_DAYS = 7; // 7 jours d'essai gratuit au premier lancement
    const [isCoachingActive, setIsCoachingActive] = useState(false);
    const [coachingExpiresAt, setCoachingExpiresAt] = useState<number>(0);
    const [isCoachingTrial, setIsCoachingTrial] = useState(false);

    // ── État suspension alertes communautaires ──
    const ALERTS_SUSPENSION_KEY = 'nav_alerts_suspended';
    const [isAlertsSuspended, setIsAlertsSuspended] = useState(false);

    // Charger le compteur ET la dette au montage + état coaching + alertes
    // ✅ NOUVEAU: Activation automatique du trial 7 jours à la première connexion
    useEffect(() => {
        (async () => {
            try {
                const [storedCount, storedDebt, storedCoaching, storedAlertsSusp, storedTrialUsed] = await Promise.all([
                    SafeStorage.getItem(SUSPENSION_STORAGE_KEY),
                    SafeStorage.getItem(DEBT_STORAGE_KEY),
                    SafeStorage.getItem(COACHING_STORAGE_KEY),
                    SafeStorage.getItem(ALERTS_SUSPENSION_KEY),
                    SafeStorage.getItem(COACHING_TRIAL_KEY),
                ]);
                const count = storedCount ? parseInt(storedCount, 10) : 0;
                const debt = storedDebt ? parseFloat(storedDebt) : 0;
                setUnpaidCount(isNaN(count) ? 0 : count);
                setUnpaidDebt(isNaN(debt) ? 0 : debt);
                setIsSuspended(count >= MAX_UNPAID_USES);

                // Coaching subscription
                if (storedCoaching) {
                    const parsed = JSON.parse(storedCoaching);
                    const expiresAt = parsed.expiresAt || 0;
                    const isTrial = parsed.isTrial || false;
                    setCoachingExpiresAt(expiresAt);
                    setIsCoachingActive(expiresAt > Date.now());
                    setIsCoachingTrial(isTrial && expiresAt > Date.now());
                } else if (!storedTrialUsed) {
                    // ═══ PREMIER LANCEMENT: Activer automatiquement 7 jours d'essai gratuit ═══
                    // L'utilisateur a probablement un solde nul → on offre le trial
                    const trialExpiresAt = Date.now() + COACHING_TRIAL_DAYS * 24 * 60 * 60 * 1000;
                    setIsCoachingActive(true);
                    setCoachingExpiresAt(trialExpiresAt);
                    setIsCoachingTrial(true);
                    await Promise.all([
                        SafeStorage.setItem(COACHING_STORAGE_KEY, JSON.stringify({ expiresAt: trialExpiresAt, isTrial: true })),
                        SafeStorage.setItem(COACHING_TRIAL_KEY, 'true'),
                    ]);
                    console.log(`[NavigationPayment] \uD83C\uDF81 Trial coaching 7 jours activé automatiquement (expire: ${new Date(trialExpiresAt).toLocaleDateString()})`);
                }

                // Alerts suspension
                setIsAlertsSuspended(storedAlertsSusp === 'true');
            } catch {
                setUnpaidCount(0);
                setUnpaidDebt(0);
            }
        })();
    }, []);

    // ── Recouvrement automatique de la dette quand le solde redevient positif ──
    useEffect(() => {
        if (currentBalance <= 0 || unpaidDebt <= 0 || debtRecoveryInProgressRef.current) return;
        if (!DEBT_AUTO_RECOVER) {
            // Si recouvrement désactivé: juste réinitialiser compteurs
            if (unpaidCount > 0) {
                setUnpaidCount(0);
                setIsSuspended(false);
                SafeStorage.setItem(SUSPENSION_STORAGE_KEY, '0').catch(() => { });
                alertShownRef.current = false;
            }
            return;
        }

        // Recouvrement automatique
        debtRecoveryInProgressRef.current = true;
        (async () => {
            try {
                const debtToRecover = unpaidDebt;

                if (currentBalance >= debtToRecover) {
                    // Solde suffisant pour couvrir toute la dette
                    console.log(`[NavigationPayment] \uD83D\uDCB0 Recouvrement dette: ${debtToRecover} XAF sur solde ${currentBalance} XAF`);
                    const result = await apiPost('/api/users/deduct-balance', {
                        amount: debtToRecover,
                        reason: `Recouvrement dette navigation: ${unpaidCount} utilisations impayées`,
                        feature: 'navigation_debt_recovery',
                    }) as any;

                    if (result?.success || result?.data?.success) {
                        console.log(`[NavigationPayment] ✅ Dette de ${debtToRecover} XAF recouvrée avec succès`);
                        setUnpaidDebt(0);
                        setUnpaidCount(0);
                        setIsSuspended(false);
                        setIsAlertsSuspended(false);
                        await Promise.all([
                            SafeStorage.setItem(SUSPENSION_STORAGE_KEY, '0'),
                            SafeStorage.setItem(DEBT_STORAGE_KEY, '0'),
                            SafeStorage.setItem(ALERTS_SUSPENSION_KEY, 'false'),
                        ]);
                        alertShownRef.current = false;
                        if (refreshUser) await refreshUser();

                        // Notifier l'utilisateur du recouvrement (multi-devise)
                        const debtFormatted = formatPriceInCurrency(debtToRecover, userCurrency);
                        Alert.alert(
                            t('navPayment.debtRecovered') || '✅ Dette recouvrée',
                            (t('navPayment.debtRecoveredMsg') || 'Votre dette de {{debt}} pour {{count}} utilisations impayées a été automatiquement prélevée.\n\nVotre accès aux fonctionnalités payantes est rétabli.')
                                .replace('{{debt}}', debtFormatted)
                                .replace('{{count}}', String(unpaidCount))
                        );
                    } else {
                        console.warn('[NavigationPayment] ⚠️ Échec recouvrement dette:', result?.error);
                    }
                } else {
                    // Solde insuffisant pour couvrir toute la dette → recouvrement partiel
                    const partialAmount = currentBalance;
                    console.log(`[NavigationPayment] \uD83D\uDCB0 Recouvrement partiel: ${partialAmount} XAF sur dette de ${debtToRecover} XAF`);
                    const result = await apiPost('/api/users/deduct-balance', {
                        amount: partialAmount,
                        reason: `Recouvrement partiel dette navigation (${partialAmount}/${debtToRecover} XAF)`,
                        feature: 'navigation_debt_recovery',
                    }) as any;

                    if (result?.success || result?.data?.success) {
                        const remainingDebt = debtToRecover - partialAmount;
                        console.log(`[NavigationPayment] ⚠️ Recouvrement partiel: ${partialAmount} XAF prélevé, dette restante: ${remainingDebt} XAF`);
                        setUnpaidDebt(remainingDebt);
                        await SafeStorage.setItem(DEBT_STORAGE_KEY, String(remainingDebt));
                        if (refreshUser) await refreshUser();

                        // Suspension maintenue — dette pas entièrement soldée (multi-devise)
                        const recoveredFmt = formatPriceInCurrency(partialAmount, userCurrency);
                        const totalFmt = formatPriceInCurrency(debtToRecover, userCurrency);
                        const remainingFmt = formatPriceInCurrency(remainingDebt, userCurrency);
                        Alert.alert(
                            t('navPayment.debtPartialRecovery') || '⚠️ Recouvrement partiel',
                            (t('navPayment.debtPartialRecoveryMsg') || '{{recovered}} ont été prélevés sur votre dette de {{total}}.\n\nDette restante: {{remaining}}\n\nRechargez à nouveau pour solder votre dette et restaurer l\'accès complet.')
                                .replace('{{recovered}}', recoveredFmt)
                                .replace('{{total}}', totalFmt)
                                .replace('{{remaining}}', remainingFmt)
                        );
                    }
                }
            } catch (e) {
                console.error('[NavigationPayment] ❌ Erreur recouvrement dette:', e);
            } finally {
                debtRecoveryInProgressRef.current = false;
            }
        })();
    }, [currentBalance, unpaidDebt]);

    // ── Persister le compteur d'échecs + dette ──
    const incrementUnpaidCount = useCallback(async (featureCost: number): Promise<{ newCount: number; newDebt: number }> => {
        const newCount = unpaidCount + 1;
        const newDebt = unpaidDebt + featureCost;
        setUnpaidCount(newCount);
        setUnpaidDebt(newDebt);
        if (newCount >= MAX_UNPAID_USES) setIsSuspended(true);
        try {
            await Promise.all([
                SafeStorage.setItem(SUSPENSION_STORAGE_KEY, String(newCount)),
                SafeStorage.setItem(DEBT_STORAGE_KEY, String(newDebt)),
            ]);
        } catch { }
        return { newCount, newDebt };
    }, [unpaidCount, unpaidDebt]);

    // ── Vérifier si le solde est suffisant ──
    const hasEnoughBalance = useCallback((amount: number): boolean => {
        return currentBalance >= amount;
    }, [currentBalance]);

    // ── Débiter le compte utilisateur ──
    const debitAccount = useCallback(async (amount: number, reason: string): Promise<DebitResult> => {
        if (amount <= 0) {
            const message = t('navPayment.freeAccess').replace('{{reason}}', reason);
            toaster.info(message);
            return { success: true, newBalance: currentBalance };
        }

        // Gratuité exceptionnelle Navigation jusqu'au 31/03/2026
        if (isNavigationFreePeriod) {
            const freeMsg = (t('navPayment.freeUntilDate') || 'Services navigation gratuits jusqu’au {{date}}.')
                .replace('{{date}}', NAVIGATION_FREE_UNTIL_LABEL);
            toaster.info(freeMsg);
            return { success: true, newBalance: currentBalance };
        }

        if (!hasEnoughBalance(amount)) {
            return { success: false, error: 'insufficient_balance' };
        }

        try {
            const response = await apiPost('/api/users/deduct-balance', {
                amount,
                reason,
                feature: 'navigation',
            }) as any;

            if (response?.success || response?.data?.success) {
                if (refreshUser) await refreshUser();

                // \uD83C\uDF5E Toast de transparence - afficher le débit (i18n + multi-devises)
                const costFormatted = formatPriceInCurrency(amount, userCurrency);
                const message = t('navPayment.debitSuccess')
                    .replace('{{amount}}', costFormatted)
                    .replace('{{reason}}', reason);
                toaster.success(message);

                return {
                    success: true,
                    newBalance: response?.data?.new_balance ?? (currentBalance - amount),
                };
            }
            return { success: false, error: response?.error || 'debit_failed' };
        } catch (e: any) {
            console.error('[NavigationPayment] Erreur débit:', e);
            return { success: false, error: e?.message || 'debit_error' };
        }
    }, [currentBalance, hasEnoughBalance, refreshUser, isNavigationFreePeriod, t]);

    // ── Rediriger vers la recharge avec retour automatique + dette si applicable ──
    const redirectToRecharge = useCallback((returnScreen: string = 'Navigation', returnParams?: any) => {
        navigation.navigate('RechargeTokens', {
            returnTo: returnScreen,
            returnParams: returnParams || {},
            debtAmount: unpaidDebt > 0 ? unpaidDebt : undefined,
            debtCount: unpaidCount > 0 ? unpaidCount : undefined,
        });
    }, [navigation, unpaidDebt, unpaidCount]);

    // ── Afficher alerte de suspension avec dette cumulée + lien recharge (multi-devise) ──
    const showSuspensionAlert = useCallback((feature: string, cost: number, failCount: number, totalDebt: number) => {
        if (alertShownRef.current) return;
        alertShownRef.current = true;

        const remaining = MAX_UNPAID_USES - failCount;
        const suspended = failCount >= MAX_UNPAID_USES;

        // Formater les montants dans la devise utilisateur
        const debtFmt = formatPriceInCurrency(totalDebt, userCurrency);
        const balanceFmt = formatPriceInCurrency(currentBalance, userCurrency);
        const costFmt = formatPriceInCurrency(cost, userCurrency);

        const title = suspended
            ? (t('navPayment.serviceSuspended') || '⛔ Service suspendu')
            : (t('navPayment.lowBalanceWarning') || '⚠️ Solde insuffisant');

        const suggestedRecharge = Math.max(totalDebt * 2, 2000);
        const suggestedFmt = formatPriceInCurrency(suggestedRecharge, userCurrency);

        const message = suspended
            ? (t('navPayment.serviceSuspendedMsg') || 'Votre accès aux fonctionnalités payantes est suspendu.\n\n\uD83D\uDCB3 Dette cumulée: {{debt}} ({{count}} utilisations impayées)\nSolde actuel: {{balance}}\nCoût par utilisation: {{cost}}\n\nLa dette sera automatiquement prélevée à la recharge.\nRechargez au minimum {{debt}} pour restaurer l\'accès.\n\n\uD83D\uDCA1 Nous recommandons {{suggested}} pour un confort d\'utilisation.')
                .replace(/\{\{count\}\}/g, String(failCount))
                .replace(/\{\{balance\}\}/g, balanceFmt)
                .replace(/\{\{cost\}\}/g, costFmt)
                .replace(/\{\{debt\}\}/g, debtFmt)
                .replace(/\{\{suggested\}\}/g, suggestedFmt)
            : (t('navPayment.lowBalanceWarningMsg') || 'Solde insuffisant pour {{feature}} ({{cost}}).\n\n\uD83D\uDCB3 Dette cumulée: {{debt}} ({{count}} utilisation(s) impayée(s))\nSolde actuel: {{balance}}\nUtilisations restantes avant suspension: {{remaining}}\n\nRechargez pour éviter la coupure du service.')
                .replace(/\{\{feature\}\}/g, feature)
                .replace(/\{\{cost\}\}/g, costFmt)
                .replace(/\{\{balance\}\}/g, balanceFmt)
                .replace(/\{\{remaining\}\}/g, String(Math.max(0, remaining)))
                .replace(/\{\{debt\}\}/g, debtFmt)
                .replace(/\{\{count\}\}/g, String(failCount));

        Alert.alert(
            title,
            message,
            [
                {
                    text: t('common.cancel') || 'Plus tard',
                    style: 'cancel',
                    onPress: () => { alertShownRef.current = false; },
                },
                {
                    text: `\uD83D\uDD0B ${t('navPayment.rechargeNow') || 'Recharger maintenant'}`,
                    style: 'default',
                    onPress: () => {
                        alertShownRef.current = false;
                        redirectToRecharge('Navigation', {});
                    },
                },
            ]
        );
    }, [currentBalance, redirectToRecharge, t, userCurrency]);

    // ── Paiement POI: estimation + confirmation + débit (multi-devise) ──
    /** `supplemental` = catégories ajoutées après un premier paiement sur le même trajet (facturation au prorata des nouvelles lignes). */
    const payForPoi = useCallback(async (
        selectedCategories: string[],
        categoryLabels: Record<string, string>,
        onSuccess: () => void,
        onCancel?: () => void,
        options?: { supplemental?: boolean },
    ): Promise<void> => {
        const totalCost = estimatePoiCost(selectedCategories);
        const supplemental = options?.supplemental === true;

        // Période offerte : confirmation comme après le lancement, mais aucun prélèvement (message dans la boîte)
        if (isNavigationFreePeriod) {
            if (totalCost <= 0) {
                onSuccess();
                return;
            }
            const categoryLines = selectedCategories
                .map((cat) => `  • ${categoryLabels[cat] || cat}: ${formatPriceInCurrency(estimatePoiCost([cat]), userCurrency)}`)
                .join('\n');
            const freeBody = (t('navPayment.poiConfirmFreeMsg') ||
                'Catégories :\n{{categories}}\n\nTarif indicatif après le {{date}} (TTC) : {{total}}\n\nAucun prélèvement pendant la période offerte (jusqu’au {{date}}).')
                .replace('{{categories}}', categoryLines)
                .replace('{{total}}', formatPriceInCurrency(totalCost, userCurrency))
                .replace(/\{\{date\}\}/g, NAVIGATION_FREE_UNTIL_LABEL);

            Alert.alert(
                t('navPayment.poiConfirmFreeTitle') || 'Recherche de points d’intérêt',
                freeBody,
                [
                    { text: t('common.cancel') || 'Annuler', style: 'cancel', onPress: onCancel },
                    {
                        text: t('navPayment.poiConfirmFreeAction') || 'Lancer la recherche',
                        style: 'default',
                        onPress: () => {
                            onSuccess();
                        },
                    },
                ],
            );
            return;
        }

        // Gratuit → exécuter directement
        if (totalCost <= 0) {
            onSuccess();
            return;
        }

        // Solde insuffisant : ouvrir directement l’écran recharge (pas seulement une alerte)
        if (!hasEnoughBalance(totalCost)) {
            toaster.warning(
                (t('navPayment.insufficientBalanceRedirect') ||
                    'Solde insuffisant pour cette recherche POI ({{cost}}). Ouverture de la recharge…')
                    .replace('{{cost}}', formatPriceInCurrency(totalCost, userCurrency)),
            );
            redirectToRecharge('Navigation', { pendingPoiCategories: selectedCategories });
            onCancel?.();
            return;
        }

        // Estimation détaillée + confirmation explicite (prix TTC / commission Yukpo incluse dans le tarif)
        const categoryLines = selectedCategories
            .map(cat => `  • ${categoryLabels[cat] || cat}: ${formatPriceInCurrency(estimatePoiCost([cat]), userCurrency)}`)
            .join('\n');

        Alert.alert(
            t('navPayment.poiCostTitle') || 'Coût de la recherche POI',
            (t('navPayment.poiCostMsg') ||
                'Catégories sélectionnées:\n{{categories}}\n\nTotal (tarif TTC, marge Yukpo incluse) : {{total}}\nSolde actuel : {{balance}}\n\nConfirmer le prélèvement sur votre solde ?')
                .replace('{{categories}}', categoryLines)
                .replace('{{total}}', formatPriceInCurrency(totalCost, userCurrency))
                .replace('{{balance}}', formatPriceInCurrency(currentBalance, userCurrency)),
            [
                { text: t('common.cancel') || 'Annuler', style: 'cancel', onPress: onCancel },
                {
                    text: t('navPayment.confirmPay') || `Payer ${formatPriceInCurrency(totalCost, userCurrency)}`,
                    style: 'default',
                    onPress: async () => {
                        const result = await debitAccount(
                            totalCost,
                            supplemental ? `POI (supplément): ${selectedCategories.join(', ')}` : `POI: ${selectedCategories.join(', ')}`,
                        );
                        if (result.success) {
                            onSuccess();
                        } else if (result.error === 'insufficient_balance') {
                            toaster.warning(t('navPayment.insufficientBalanceRedirect') || 'Solde insuffisant. Ouverture de la recharge…');
                            redirectToRecharge('Navigation', { pendingPoiCategories: selectedCategories });
                        } else {
                            Alert.alert(
                                t('message.error') || 'Erreur',
                                t('navPayment.paymentFailed') || 'Le paiement a échoué. Veuillez réessayer.'
                            );
                        }
                    },
                },
            ]
        );
    }, [currentBalance, hasEnoughBalance, debitAccount, redirectToRecharge, t, toaster, userCurrency, isNavigationFreePeriod]);

    // ── Micro-paiement avec alerte progressive et dette cumulée ──
    const payMicroFeature = useCallback(async (
        feature: string,
        onSuccess: () => void,
        onInsufficientBalance?: () => void,
    ): Promise<boolean> => {
        if (isNavigationFreePeriod) {
            onSuccess();
            return true;
        }

        const cost = getMicroFeaturePrice(feature);
        const isIndependentFeature = INDEPENDENT_NAV_FEATURES.has(feature);

        // Gratuit → exécuter directement
        if (cost <= 0) {
            onSuccess();
            return true;
        }

        // ⛔ Si déjà suspendu → bloquer l'accès
        if (isSuspended && !isIndependentFeature) {
            console.log(`[NavigationPayment] ⛔ Feature ${feature} bloquée — suspension active (${unpaidCount} échecs, dette: ${unpaidDebt} XAF)`);
            showSuspensionAlert(feature, cost, unpaidCount, unpaidDebt);
            return false;
        }

        // Vérifier solde
        if (!hasEnoughBalance(cost)) {
            if (isIndependentFeature) {
                if (onInsufficientBalance) onInsufficientBalance();
                return false;
            }
            console.log(`[NavigationPayment] ⚠️ Solde insuffisant pour ${feature} (${cost} XAF, solde: ${currentBalance} XAF, dette actuelle: ${unpaidDebt} XAF)`);
            const { newCount, newDebt } = await incrementUnpaidCount(cost);

            if (onInsufficientBalance) onInsufficientBalance();

            // Afficher alerte progressive avec dette cumulée dès le seuil
            if (newCount >= SUSPENSION_ALERT_THRESHOLD) {
                showSuspensionAlert(feature, cost, newCount, newDebt);
            }

            // Période de grâce: exécuter quand même pendant les N premières fois
            if (newCount < MAX_UNPAID_USES) {
                console.log(`[NavigationPayment] ⏳ Période de grâce: ${newCount}/${MAX_UNPAID_USES} — dette: ${newDebt} XAF — feature exécutée`);
                onSuccess();
                return true;
            }

            // ⛔ MAX atteint → bloquer
            console.log(`[NavigationPayment] ⛔ MAX_UNPAID_USES atteint (${newCount}) — dette: ${newDebt} XAF — feature ${feature} bloquée`);
            return false;
        }

        // Débiter silencieusement
        const result = await debitAccount(cost, `Navigation: ${feature}`);
        if (result.success) {
            console.log(`[NavigationPayment] ✅ Micro-paiement ${feature}: ${cost} XAF débité`);
            onSuccess();
            return true;
        }
        // Échec du débit (erreur API, race condition) → traiter comme impayé
        console.warn(`[NavigationPayment] ⚠️ Échec débit ${feature}: ${result.error}`);
        if (isIndependentFeature) {
            if (onInsufficientBalance) onInsufficientBalance();
            return false;
        }
        const { newCount, newDebt } = await incrementUnpaidCount(cost);
        if (newCount >= SUSPENSION_ALERT_THRESHOLD) {
            showSuspensionAlert(feature, cost, newCount, newDebt);
        }
        onSuccess(); // Période de grâce
        return true;
    }, [hasEnoughBalance, debitAccount, currentBalance, isSuspended, unpaidCount, unpaidDebt, incrementUnpaidCount, showSuspensionAlert, isNavigationFreePeriod]);

    // ── Abonnement coaching mensuel: activer/vérifier/rappeler ──
    // ✅ REFONTE: Gère le trial gratuit (7j) + passage trial→payant + renouvellement
    const activateCoachingSubscription = useCallback(async (): Promise<boolean> => {
        const cost = getMicroFeaturePrice('coaching_monthly');

        // Si coaching déjà actif (trial ou payant), ne pas redébiter
        if (isCoachingActive && coachingExpiresAt > Date.now()) {
            console.log(`[NavigationPayment] ℹ️ Coaching déjà actif (expire: ${new Date(coachingExpiresAt).toLocaleDateString()}, trial: ${isCoachingTrial})`);
            return true;
        }

        if (cost <= 0) {
            // Coaching gratuit (config backend = 0)
            const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
            setIsCoachingActive(true);
            setCoachingExpiresAt(expiresAt);
            setIsCoachingTrial(false);
            await SafeStorage.setItem(COACHING_STORAGE_KEY, JSON.stringify({ expiresAt, isTrial: false })).catch(() => { });
            return true;
        }

        if (!hasEnoughBalance(cost)) {
            const costFmt = formatPriceInCurrency(cost, userCurrency);
            const balanceFmt = formatPriceInCurrency(currentBalance, userCurrency);
            const trialExpired = isCoachingTrial || (!isCoachingActive && coachingExpiresAt > 0);
            const msgKey = trialExpired ? 'navPayment.coachingTrialEndedMsg' : 'navPayment.coachingInsufficientMsg';
            const titleKey = trialExpired ? 'navPayment.coachingTrialEnded' : 'navPayment.coachingSubscription';
            Alert.alert(
                t(titleKey) || (trialExpired ? '\uD83C\uDF81 Essai terminé' : '\uD83E\uDD16 Coaching IA mensuel'),
                (t(msgKey) || (trialExpired
                    ? 'Votre essai gratuit de 7 jours est terminé.\n\nPour continuer à recevoir les notifications de coaching personnalisées, abonnez-vous pour seulement {{cost}}/mois.\n\nSolde actuel: {{balance}}'
                    : 'Le coaching push mensuel coûte {{cost}}/mois.\n\nSolde actuel: {{balance}}\n\nRechargez pour activer les notifications automatiques de coaching.'))
                    .replace(/\{\{cost\}\}/g, costFmt)
                    .replace(/\{\{balance\}\}/g, balanceFmt),
                [
                    { text: t('common.cancel') || 'Plus tard', style: 'cancel' },
                    { text: `\uD83D\uDD0B ${t('navPayment.recharge') || 'Recharger'}`, onPress: () => redirectToRecharge('Navigation') },
                ]
            );
            return false;
        }

        const result = await debitAccount(cost, 'Coaching IA mensuel');
        if (result.success) {
            const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // +30 jours
            setIsCoachingActive(true);
            setCoachingExpiresAt(expiresAt);
            setIsCoachingTrial(false);
            await SafeStorage.setItem(COACHING_STORAGE_KEY, JSON.stringify({ expiresAt, isTrial: false })).catch(() => { });
            await SafeStorage.removeItem(COACHING_REMINDER_KEY).catch(() => { });
            console.log(`[NavigationPayment] ✅ Coaching mensuel PAYANT activé jusqu'au ${new Date(expiresAt).toLocaleDateString()}`);
            return true;
        }
        return false;
    }, [isCoachingActive, coachingExpiresAt, isCoachingTrial, hasEnoughBalance, debitAccount, currentBalance, redirectToRecharge, t, userCurrency]);

    // Vérifier expiration coaching et afficher rappel
    const checkCoachingExpiry = useCallback(async () => {
        if (!isCoachingActive || coachingExpiresAt === 0) return;
        const now = Date.now();
        const daysLeft = (coachingExpiresAt - now) / (24 * 60 * 60 * 1000);

        if (daysLeft <= 0) {
            // Expiré → désactiver
            setIsCoachingActive(false);
            const costFmt = formatPriceInCurrency(getMicroFeaturePrice('coaching_monthly'), userCurrency);
            Alert.alert(
                t('navPayment.coachingExpired') || '⚠️ Coaching expiré',
                (t('navPayment.coachingExpiredMsg') || 'Votre abonnement coaching IA a expiré.\n\nVous ne recevrez plus de notifications automatiques de coaching.\n\nRenouvelez pour {{cost}}/mois.')
                    .replace('{{cost}}', costFmt),
                [
                    { text: t('common.cancel') || 'Plus tard', style: 'cancel' },
                    { text: '\uD83D\uDD04 Renouveler', onPress: () => activateCoachingSubscription() },
                ]
            );
        } else if (daysLeft <= 3) {
            // Rappel 3 jours avant expiration (1 seul rappel)
            const reminderShown = await SafeStorage.getItem(COACHING_REMINDER_KEY).catch(() => null);
            if (!reminderShown) {
                const costFmt = formatPriceInCurrency(getMicroFeaturePrice('coaching_monthly'), userCurrency);
                Alert.alert(
                    t('navPayment.coachingExpiringSoon') || '⏰ Coaching expire bientôt',
                    (t('navPayment.coachingExpiringSoonMsg') || 'Votre coaching IA expire dans {{days}} jours.\n\nRenouvelez pour {{cost}}/mois pour continuer à recevoir les notifications.')
                        .replace('{{days}}', String(Math.ceil(daysLeft)))
                        .replace('{{cost}}', costFmt),
                    [
                        { text: 'OK', style: 'cancel' },
                        { text: '\uD83D\uDD04 Renouveler', onPress: () => activateCoachingSubscription() },
                    ]
                );
                await SafeStorage.setItem(COACHING_REMINDER_KEY, 'true').catch(() => { });
            }
        }
    }, [isCoachingActive, coachingExpiresAt, activateCoachingSubscription, t, userCurrency]);

    // Vérifier coaching au montage
    useEffect(() => {
        if (isCoachingActive) checkCoachingExpiry();
    }, [isCoachingActive]);

    // ── Activer/désactiver les notifications Coach IA (sonores + push)
    // Règle: actif si abonnement/trial actif OU période de gratuité globale navigation.
    useEffect(() => {
        const shouldEnableCoachPush = isCoachingActive || isNavigationFreePeriod;
        if (shouldEnableCoachPush) {
            coachingNotificationService.activate().catch(() => { });
        } else {
            coachingNotificationService.deactivate().catch(() => { });
        }
    }, [isCoachingActive, isNavigationFreePeriod]);

    // ── Suspension alertes communautaires ──
    const suspendAlerts = useCallback(async () => {
        setIsAlertsSuspended(true);
        await SafeStorage.setItem(ALERTS_SUSPENSION_KEY, 'true').catch(() => { });
        console.log('[NavigationPayment] ⛔ Alertes communautaires suspendues');
    }, []);

    const restoreAlerts = useCallback(async () => {
        setIsAlertsSuspended(false);
        await SafeStorage.setItem(ALERTS_SUSPENSION_KEY, 'false').catch(() => { });
        console.log('[NavigationPayment] ✅ Alertes communautaires restaurées');
    }, []);

    // Payer pour la consultation de l'écran alertes communautaires
    // ✅ FIX 2026-03-18: La facturation pendant le tracking est par checkpoint unique (dans NavigationScreen)
    const payForAlerts = useCallback(async (
        onSuccess: () => void,
        onSuspended?: () => void,
    ): Promise<boolean> => {
        if (isNavigationFreePeriod) {
            if (isAlertsSuspended) {
                await restoreAlerts();
            }
            onSuccess();
            return true;
        }

        // Si suspendu globalement, bloquer
        if (isSuspended) {
            showSuspensionAlert('community_alerts', getMicroFeaturePrice('community_alerts'), unpaidCount, unpaidDebt);
            if (onSuspended) onSuspended();
            return false;
        }

        // Si alertes spécifiquement suspendues
        if (isAlertsSuspended) {
            const costFmt = formatPriceInCurrency(getMicroFeaturePrice('community_alerts'), userCurrency);
            Alert.alert(
                t('navPayment.alertsSuspended') || '⛔ Alertes suspendues',
                (t('navPayment.alertsSuspendedMsg') || 'Vos alertes communautaires sont suspendues pour non-paiement.\n\nRechargez {{cost}} pour restaurer les notifications sonores et visuelles.')
                    .replace('{{cost}}', costFmt),
                [
                    { text: t('common.cancel') || 'Plus tard', style: 'cancel' },
                    { text: `\uD83D\uDD0B ${t('navPayment.recharge') || 'Recharger'}`, onPress: () => redirectToRecharge('Navigation') },
                ]
            );
            if (onSuspended) onSuspended();
            return false;
        }

        // Paiement normal via micro-feature
        return payMicroFeature('community_alerts', onSuccess, async () => {
            // Si solde insuffisant après MAX_UNPAID_USES, suspendre les alertes
            if (unpaidCount + 1 >= MAX_UNPAID_USES) {
                await suspendAlerts();
            }
        });
    }, [isSuspended, isAlertsSuspended, unpaidCount, unpaidDebt, payMicroFeature, showSuspensionAlert, suspendAlerts, redirectToRecharge, t, userCurrency, isNavigationFreePeriod, restoreAlerts]);

    return {
        currentBalance,
        hasEnoughBalance,
        debitAccount,
        redirectToRecharge,
        payForPoi,
        payMicroFeature,
        formatPrice,
        formatPriceInCurrency,
        // ── État de suspension + dette (exposé pour l'UI) ──
        isSuspended,
        unpaidCount,
        unpaidDebt,
        maxUnpaidUses: MAX_UNPAID_USES,
        // ── Coaching mensuel ──
        isCoachingActive,
        isCoachingTrial,
        coachingExpiresAt,
        activateCoachingSubscription,
        checkCoachingExpiry,
        // ── Alertes communautaires ──
        isAlertsSuspended,
        payForAlerts,
        suspendAlerts,
        restoreAlerts,
        // ── Devise détectée ──
        userCurrency,
        // ── Gratuité exceptionnelle ──
        isNavigationFreePeriod,
        navigationFreeUntilLabel: NAVIGATION_FREE_UNTIL_LABEL,
    };
}

export default useNavigationPayment;
