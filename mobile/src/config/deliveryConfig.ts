// Configuration partagée pour les livraisons
export type VehicleType = 'bike' | 'motorcycle' | 'tricycle' | 'car' | 'pickup' | 'van' | 'truck' | 'walking';

// ✅ FIX 2026-03-05: Mapping formel entre VehicleType mobile et DeliveryEngineType backend (snake_case)
// Backend enum: moto, scooter, tricycle, voiture, camionnette, velo_cargo, pieton, camion_leger, autre
export const VEHICLE_TYPE_TO_BACKEND: Record<VehicleType, string> = {
    bike: 'velo_cargo',
    motorcycle: 'moto',
    tricycle: 'tricycle',
    car: 'voiture',
    pickup: 'camionnette',
    van: 'camionnette',
    truck: 'camion_leger',
    walking: 'pieton',
};

export const BACKEND_TO_VEHICLE_TYPE: Record<string, VehicleType> = {
    velo_cargo: 'bike',
    moto: 'motorcycle',
    scooter: 'motorcycle',
    tricycle: 'tricycle',
    voiture: 'car',
    camionnette: 'van',
    camion_leger: 'truck',
    pieton: 'walking',
    autre: 'car',
};

export interface VehicleOption {
    value: VehicleType;
    label: string;
    icon: string;
    requiresLicense?: boolean;
}

// ✅ CONSTANTE PARTAGÉE : Options de transport disponibles pour les coursiers et les commandes
export const VEHICLE_TRANSPORT_OPTIONS: VehicleOption[] = [
    { value: 'bike', label: 'Vélo cargo', icon: '\uD83D\uDEB2', requiresLicense: false },
    { value: 'motorcycle', label: 'Moto', icon: '\uD83C\uDFCD️', requiresLicense: true },
    { value: 'tricycle', label: 'Tricycle', icon: '\uD83D\uDEFA', requiresLicense: true },
    { value: 'car', label: 'Voiture', icon: '\uD83D\uDE97', requiresLicense: true },
    { value: 'pickup', label: 'Pick-up', icon: '\uD83D\uDEFB', requiresLicense: true },
    { value: 'van', label: 'Fourgonnette', icon: '\uD83D\uDE90', requiresLicense: true },
    { value: 'truck', label: 'Camion', icon: '\uD83D\uDE9A', requiresLicense: true },
    { value: 'walking', label: 'À pied', icon: '\uD83D\uDEB6', requiresLicense: false },
];

// Format pour les Alert.alert (avec emoji dans le label)
export const VEHICLE_TRANSPORT_OPTIONS_FOR_ALERT: Array<{ value: VehicleType; label: string }> = [
    { value: 'bike', label: '\uD83D\uDEB2 Vélo cargo' },
    { value: 'motorcycle', label: '\uD83C\uDFCD️ Moto' },
    { value: 'tricycle', label: '\uD83D\uDEFA Tricycle' },
    { value: 'car', label: '\uD83D\uDE97 Voiture' },
    { value: 'pickup', label: '\uD83D\uDEFB Pick-up' },
    { value: 'van', label: '\uD83D\uDE90 Fourgonnette' },
    { value: 'truck', label: '\uD83D\uDE9A Camion' },
    { value: 'walking', label: '\uD83D\uDEB6 Piéton' },
];

