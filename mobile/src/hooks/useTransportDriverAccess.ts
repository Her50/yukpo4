/**
 * Accès publication trajets taxi / covoiturage : candidature coursier approuvée
 * (types taxi ou carpooling), ou rôles / partenaires chauffeur déjà reconnus.
 * Aligné sur TaxiHomeScreen + GET /api/courier/me.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../services/api';

export function localTransportDriverSignals(user: Record<string, unknown> | null | undefined): boolean {
    if (!user?.id) return false;
    const localCheck =
        user.role === 'driver' ||
        user.is_driver === true ||
        user.driver_status === 'validated' ||
        user.driver_status === 'approved';
    const pt = String(user.partner_type || '')
        .toLowerCase()
        .trim();
    const isPartnerDriver =
        user.role === 'partenaire' && ['chauffeur', 'taxi', 'covoiturage'].includes(pt);
    return Boolean(localCheck || isPartnerDriver);
}

function courierMeAllowsTaxiOrCarpooling(body: Record<string, unknown> | null | undefined): boolean {
    if (!body) return false;
    const app = body.application as Record<string, unknown> | undefined;
    if (!app) return false;
    const st = String(app.status || '')
        .toLowerCase()
        .replace(/"/g, '');
    const approved = st === 'approved';
    const ct = String(
        app.courier_type ||
            (app.profile_data as Record<string, unknown> | undefined)?.courier_type ||
            (app.profile_data as Record<string, unknown> | undefined)?.courierType ||
            ''
    ).toLowerCase();
    return approved && (ct === 'taxi' || ct === 'carpooling');
}

export type TransportDriverAccess = {
    validated: boolean;
    checking: boolean;
    refresh: () => Promise<void>;
};

export function useTransportDriverAccess(
    user: Record<string, unknown> | null | undefined
): TransportDriverAccess {
    const [validated, setValidated] = useState(false);
    const [checking, setChecking] = useState(true);

    const refresh = useCallback(async () => {
        if (!user?.id) {
            setValidated(false);
            setChecking(false);
            return;
        }
        if (localTransportDriverSignals(user)) {
            setValidated(true);
            setChecking(false);
            return;
        }

        setChecking(true);
        try {
            const response = await apiGet<Record<string, unknown>>('/api/courier/me');
            const raw = response as Record<string, unknown>;
            const body = (raw.data as Record<string, unknown>) || raw;

            if (courierMeAllowsTaxiOrCarpooling(body)) {
                setValidated(true);
                setChecking(false);
                return;
            }

            setValidated(false);
        } catch {
            setValidated(localTransportDriverSignals(user));
        } finally {
            setChecking(false);
        }
    }, [user]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { validated, checking, refresh };
}
