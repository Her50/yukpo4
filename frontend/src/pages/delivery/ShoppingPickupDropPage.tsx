import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShopping } from '@/context/ShoppingContext';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface StoreForm {
    name: string;
    address: string;
    latitude: string;
    longitude: string;
}

interface DropoffForm {
    address: string;
    latitude: string;
    longitude: string;
}

const STORAGE_KEY = 'delivery.shopping.store';
const DROPOFF_KEY = 'delivery.shopping.dropoff';

const parseStored = <T,>(value: string | null, fallback: T): T => {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const ShoppingPickupDropPage: React.FC = () => {
    const navigate = useNavigate();
    const { recipient, setRecipient } = useShopping();

    const initialStore = useMemo<StoreForm>(
        () =>
            parseStored(STORAGE_KEY, {
                name: '',
                address: '',
                latitude: '',
                longitude: '',
            }),
        [],
    );

    const initialDropoff = useMemo<DropoffForm>(() => {
        const stored = parseStored<DropoffForm>(DROPOFF_KEY, {
            address: recipient?.dropoffAddress ?? '',
            latitude: recipient?.dropoffOverride?.latitude?.toString() ?? '',
            longitude: recipient?.dropoffOverride?.longitude?.toString() ?? '',
        });
        return stored;
    }, [recipient]);

    const [store, setStore] = useState<StoreForm>(initialStore);
    const [dropoff, setDropoff] = useState<DropoffForm>(initialDropoff);
    const [error, setError] = useState<string | null>(null);

    const handleContinue = () => {
        if (!store.latitude || !store.longitude || !dropoff.latitude || !dropoff.longitude) {
            setError('Latitude et longitude sont requises pour le point de retrait et de livraison.');
            return;
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        sessionStorage.setItem(DROPOFF_KEY, JSON.stringify(dropoff));

        setRecipient({
            ...recipient,
            contactName: recipient?.contactName,
            contactPhone: recipient?.contactPhone,
            dropoffAddress: dropoff.address || undefined,
            dropoffOverride: {
                latitude: Number(dropoff.latitude),
                longitude: Number(dropoff.longitude),
                address: dropoff.address || undefined,
            },
        });

        navigate('/delivery/shopping/summary', {
            state: {
                store: {
                    name: store.name,
                    address: store.address,
                    latitude: Number(store.latitude),
                    longitude: Number(store.longitude),
                },
                dropoff: {
                    address: dropoff.address,
                    latitude: Number(dropoff.latitude),
                    longitude: Number(dropoff.longitude),
                },
            },
        });
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Points de retrait & livraison</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Indiquez le supermarché et la destination pour permettre la navigation du coursier.
                    </p>
                </div>

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Retrait supermarché</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="storeName">Nom ou description</Label>
                            <Input
                                id="storeName"
                                placeholder="Ex : Carrefour Market Bonamoussadi"
                                value={store.name}
                                onChange={event => setStore(prev => ({ ...prev, name: event.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storeAddress">Adresse (optionnel)</Label>
                            <Input
                                id="storeAddress"
                                placeholder="Adresse complète"
                                value={store.address}
                                onChange={event => setStore(prev => ({ ...prev, address: event.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="storeLat">Latitude</Label>
                            <Input
                                id="storeLat"
                                type="number"
                                placeholder="4.0569"
                                value={store.latitude}
                                onChange={event => setStore(prev => ({ ...prev, latitude: event.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storeLng">Longitude</Label>
                            <Input
                                id="storeLng"
                                type="number"
                                placeholder="9.7064"
                                value={store.longitude}
                                onChange={event => setStore(prev => ({ ...prev, longitude: event.target.value }))}
                            />
                        </div>
                    </div>
                </section>

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Livraison destinataire</h2>
                    <div className="grid gap-2">
                        <Label htmlFor="dropoffAddress">Adresse (optionnel)</Label>
                        <Input
                            id="dropoffAddress"
                            placeholder="Adresse complète du destinataire ou repère"
                            value={dropoff.address}
                            onChange={event => setDropoff(prev => ({ ...prev, address: event.target.value }))}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="dropoffLat">Latitude</Label>
                            <Input
                                id="dropoffLat"
                                type="number"
                                placeholder="4.0512"
                                value={dropoff.latitude}
                                onChange={event => setDropoff(prev => ({ ...prev, latitude: event.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dropoffLng">Longitude</Label>
                            <Input
                                id="dropoffLng"
                                type="number"
                                placeholder="9.7675"
                                value={dropoff.longitude}
                                onChange={event => setDropoff(prev => ({ ...prev, longitude: event.target.value }))}
                            />
                        </div>
                    </div>
                </section>

                {error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {error}
                    </div>
                ) : null}

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery/shopping/budget')}>
                        Retour
                    </Button>
                    <Button onClick={handleContinue}>
                        Continuer
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShoppingPickupDropPage;


