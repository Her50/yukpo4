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
    { value: 'bike', label: 'Vélo cargo', icon: '🚲', requiresLicense: false },
    { value: 'motorcycle', label: 'Moto', icon: '🏍️', requiresLicense: true },
    { value: 'tricycle', label: 'Tricycle', icon: '🛺', requiresLicense: true },
    { value: 'car', label: 'Voiture', icon: '🚗', requiresLicense: true },
    { value: 'pickup', label: 'Pick-up', icon: '🛻', requiresLicense: true },
    { value: 'van', label: 'Fourgonnette', icon: '🚐', requiresLicense: true },
    { value: 'truck', label: 'Camion', icon: '🚚', requiresLicense: true },
    { value: 'walking', label: 'À pied', icon: '🚶', requiresLicense: false },
];

// Format pour les Alert.alert (avec emoji dans le label)
export const VEHICLE_TRANSPORT_OPTIONS_FOR_ALERT: Array<{ value: VehicleType; label: string }> = [
    { value: 'bike', label: '🚲 Vélo cargo' },
    { value: 'motorcycle', label: '🏍️ Moto' },
    { value: 'tricycle', label: '🛺 Tricycle' },
    { value: 'car', label: '🚗 Voiture' },
    { value: 'pickup', label: '🛻 Pick-up' },
    { value: 'van', label: '🚐 Fourgonnette' },
    { value: 'truck', label: '🚚 Camion' },
    { value: 'walking', label: '🚶 Piéton' },
];

