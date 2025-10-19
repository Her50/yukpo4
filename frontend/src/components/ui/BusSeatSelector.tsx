import { Button } from '@/components/ui/buttons';
import { Check, Minus, Plus, Settings, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Seat {
    id: string;
    row: number;
    col: number;
    status: 'available' | 'occupied' | 'selected';
    label: string;
}

interface BusConfig {
    rows: number;
    cols: number;
    layout: number[];
    customRowLayouts?: { [row: number]: number[] };
}

interface BusSeatSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSeat: (seatLabel: string) => void;
    occupiedSeats?: string[];
}

const BusSeatSelector: React.FC<BusSeatSelectorProps> = ({
    isOpen,
    onClose,
    onSelectSeat,
    occupiedSeats = []
}) => {
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [config, setConfig] = useState<BusConfig>({
        rows: 18,
        cols: 4,
        layout: [2, 2],
        customRowLayouts: {}
    });
    const [tempConfig, setTempConfig] = useState<BusConfig>(config);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

    // Générer les sièges
    const generateSeats = (): Seat[] => {
        const newSeats: Seat[] = [];
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

        for (let row = 1; row <= config.rows; row++) {
            const rowLayout = config.customRowLayouts?.[row] || config.layout;
            const rowCols = rowLayout.reduce((sum, val) => sum + val, 0);

            for (let col = 0; col < rowCols; col++) {
                const label = `${letters[col]}${row.toString().padStart(2, '0')}`;
                const isOccupied = occupiedSeats.includes(label);

                newSeats.push({
                    id: `${row}-${col}`,
                    row,
                    col,
                    status: isOccupied ? 'occupied' : 'available',
                    label
                });
            }
        }

        return newSeats;
    };

    useEffect(() => {
        setSeats(generateSeats());
        setSelectedSeat(null);
    }, [config]);

    const handleSeatPress = (seat: Seat) => {
        if (seat.status === 'occupied') return;

        const updatedSeats = seats.map(s => ({
            ...s,
            status: s.id === seat.id ? 'selected' : (s.status === 'selected' ? 'available' : s.status)
        })) as Seat[];

        setSeats(updatedSeats);
        setSelectedSeat(seat.label);
    };

    const handleConfirm = () => {
        if (selectedSeat) {
            onSelectSeat(selectedSeat);
            onClose();
        }
    };

    // Organiser par rangée
    const seatsByRow: { [key: number]: Seat[] } = {};
    seats.forEach(seat => {
        if (!seatsByRow[seat.row]) {
            seatsByRow[seat.row] = [];
        }
        seatsByRow[seat.row].push(seat);
    });

    if (!isOpen) return null;

    return (
        <>
            {/* Modal principal */}
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 flex items-center justify-between">
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-bold">Sélection de place</h2>
                        <button onClick={() => {
                            setTempConfig(config);
                            setShowConfigModal(true);
                        }} className="p-2 hover:bg-white/20 rounded-lg">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Légende */}
                    <div className="flex items-center justify-around p-4 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-200 border-2 border-green-600 rounded"></div>
                            <span className="text-sm">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-600 border-2 border-blue-600 rounded"></div>
                            <span className="text-sm">Sélectionnée</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-red-200 border-2 border-red-600 rounded opacity-50"></div>
                            <span className="text-sm">Occupée</span>
                        </div>
                    </div>

                    {/* Plan du bus */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-3">
                            {/* Cabine conducteur */}
                            <div className="bg-gray-800 text-white rounded-lg p-4 flex items-center justify-center gap-2">
                                <span>👤 Conducteur</span>
                            </div>

                            {/* Sièges */}
                            {Object.keys(seatsByRow).map((rowKey) => {
                                const row = parseInt(rowKey);
                                const rowSeats = seatsByRow[row];
                                const rowLayout = config.customRowLayouts?.[row] || config.layout;

                                return (
                                    <div key={row} className="flex items-center gap-3">
                                        <span className="w-8 text-center text-sm font-semibold text-gray-600">{row}</span>
                                        <div className="flex items-center gap-2">
                                            {rowSeats.slice(0, rowLayout[0]).map(seat => (
                                                <button
                                                    key={seat.id}
                                                    onClick={() => handleSeatPress(seat)}
                                                    disabled={seat.status === 'occupied'}
                                                    className={`w-14 h-14 rounded-lg border-2 text-xs font-semibold transition-all ${seat.status === 'available' ? 'bg-green-200 border-green-600 hover:bg-green-300' :
                                                            seat.status === 'selected' ? 'bg-blue-600 border-blue-600 text-white' :
                                                                'bg-red-200 border-red-600 opacity-50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {seat.label}
                                                </button>
                                            ))}
                                            <div className="w-6"></div>
                                            {rowSeats.slice(rowLayout[0]).map(seat => (
                                                <button
                                                    key={seat.id}
                                                    onClick={() => handleSeatPress(seat)}
                                                    disabled={seat.status === 'occupied'}
                                                    className={`w-14 h-14 rounded-lg border-2 text-xs font-semibold transition-all ${seat.status === 'available' ? 'bg-green-200 border-green-600 hover:bg-green-300' :
                                                            seat.status === 'selected' ? 'bg-blue-600 border-blue-600 text-white' :
                                                                'bg-red-200 border-red-600 opacity-50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {seat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Arrière du bus */}
                            <div className="bg-yellow-400 rounded-lg p-3 text-center text-sm font-semibold text-yellow-900">
                                Sortie de secours
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 bg-white">
                        {selectedSeat ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Check className="w-6 h-6 text-green-600" />
                                    <div>
                                        <p className="text-xs text-gray-500">Place sélectionnée</p>
                                        <p className="text-lg font-bold text-green-600">{selectedSeat}</p>
                                    </div>
                                </div>
                                <Button onClick={handleConfirm}>
                                    Confirmer
                                </Button>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500">Sélectionnez une place pour continuer</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de configuration */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-bold">⚙️ Configuration du bus</h3>
                            <button onClick={() => setShowConfigModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Nombre de rangées */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Nombre de rangées</label>
                                <div className="flex items-center justify-center gap-6 bg-gray-50 p-4 rounded-lg">
                                    <button
                                        onClick={() => setTempConfig({ ...tempConfig, rows: Math.max(1, tempConfig.rows - 1) })}
                                        className="w-12 h-12 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center hover:bg-blue-50"
                                    >
                                        <Minus className="w-5 h-5 text-blue-600" />
                                    </button>
                                    <span className="text-3xl font-bold text-blue-600 min-w-[60px] text-center">{tempConfig.rows}</span>
                                    <button
                                        onClick={() => setTempConfig({ ...tempConfig, rows: Math.min(30, tempConfig.rows + 1) })}
                                        className="w-12 h-12 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center hover:bg-blue-50"
                                    >
                                        <Plus className="w-5 h-5 text-blue-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Configuration générale */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Configuration générale</label>
                                <div className="space-y-2">
                                    {[
                                        { layout: [1, 1], cols: 2, label: '1-1' },
                                        { layout: [2, 1], cols: 3, label: '2-1 (VIP)' },
                                        { layout: [2, 2], cols: 4, label: '2-2 (Standard)' },
                                        { layout: [2, 3], cols: 5, label: '2-3' },
                                    ].map((option) => (
                                        <button
                                            key={option.label}
                                            onClick={() => setTempConfig({ ...tempConfig, layout: option.layout, cols: option.cols })}
                                            className={`w-full p-3 rounded-lg border-2 text-center font-semibold transition-all ${tempConfig.layout[0] === option.layout[0] && tempConfig.layout[1] === option.layout[1]
                                                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                    : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Configuration avancée */}
                            <div>
                                <button
                                    onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                                    className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 font-semibold text-blue-900"
                                >
                                    <span className="transform transition-transform">{showAdvancedConfig ? '▼' : '▶'}</span>
                                    Configuration avancée (par rangée)
                                </button>

                                {showAdvancedConfig && (
                                    <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
                                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs">
                                            💡 Configurez rangée 1 = 1-1 (chauffeur), dernière = 2-3 (siège sup.)
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const newLayouts = { ...tempConfig.customRowLayouts };
                                                    newLayouts[1] = [1, 1];
                                                    setTempConfig({ ...tempConfig, customRowLayouts: newLayouts });
                                                }}
                                            >
                                                Rangée 1 → 1-1
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const newLayouts = { ...tempConfig.customRowLayouts };
                                                    newLayouts[tempConfig.rows] = [2, 3];
                                                    setTempConfig({ ...tempConfig, customRowLayouts: newLayouts });
                                                }}
                                            >
                                                Dernière → 2-3
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Aperçu */}
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                <p className="font-semibold text-sm mb-2">Aperçu :</p>
                                <p className="text-sm text-gray-700">• {tempConfig.rows} rangées</p>
                                <p className="text-sm text-gray-700">• Config générale : {tempConfig.layout[0]}-{tempConfig.layout[1]}</p>
                                {Object.keys(tempConfig.customRowLayouts || {}).length > 0 && (
                                    <p className="text-sm text-gray-700">
                                        • {Object.keys(tempConfig.customRowLayouts || {}).length} rangée(s) personnalisée(s)
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="border-t p-4 flex gap-3">
                            <Button variant="outline" onClick={() => setShowConfigModal(false)} className="flex-1">
                                Annuler
                            </Button>
                            <Button onClick={() => {
                                setConfig(tempConfig);
                                setShowConfigModal(false);
                            }} className="flex-1">
                                Appliquer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BusSeatSelector;

