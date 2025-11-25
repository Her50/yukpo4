// Page de gestion des horaires de départ pour les agences de voyage
// Permet de créer, modifier et gérer les horaires de départ par trajet

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Clock, Edit, MapPin, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' },
    { value: 7, label: 'Dimanche' },
];

interface Schedule {
    id: string;
    departure_city: string;
    arrival_city: string;
    departure_time: string;
    day_of_week: number[];
    is_active: boolean;
    created_at: string;
}

const ManageAgencySchedulesPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

    // Formulaire
    const [departureCity, setDepartureCity] = useState('');
    const [arrivalCity, setArrivalCity] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/bus-tickets/agencies/schedules', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.success && data.data) {
                setSchedules(data.data);
            } else {
                toast.error('Impossible de charger les horaires');
            }
        } catch (error: any) {
            console.error('[ManageAgencySchedulesPage] Erreur chargement:', error);
            toast.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSchedule = () => {
        setEditingSchedule(null);
        setDepartureCity('');
        setArrivalCity('');
        setDepartureTime('');
        setSelectedDays([]);
        setIsActive(true);
        setShowModal(true);
    };

    const handleEditSchedule = (schedule: Schedule) => {
        setEditingSchedule(schedule);
        setDepartureCity(schedule.departure_city);
        setArrivalCity(schedule.arrival_city);
        setDepartureTime(schedule.departure_time);
        setSelectedDays(schedule.day_of_week || []);
        setIsActive(schedule.is_active);
        setShowModal(true);
    };

    const handleSaveSchedule = async () => {
        if (!departureCity.trim() || !arrivalCity.trim() || !departureTime.trim()) {
            toast.error('Veuillez remplir tous les champs obligatoires');
            return;
        }

        if (selectedDays.length === 0) {
            toast.error('Veuillez sélectionner au moins un jour de la semaine');
            return;
        }

        // Valider le format de l'heure (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(departureTime)) {
            toast.error('Format d\'heure invalide. Utilisez HH:MM (ex: 08:00, 14:30)');
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            let response;

            if (editingSchedule) {
                // Mise à jour
                response = await fetch(`/api/bus-tickets/agencies/schedules/${editingSchedule.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        departure_times: [departureTime],
                        day_of_week: selectedDays,
                        is_active: isActive,
                    }),
                });
            } else {
                // Création
                response = await fetch('/api/bus-tickets/agencies/schedules', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        departure_city: departureCity.trim(),
                        arrival_city: arrivalCity.trim(),
                        departure_times: [departureTime],
                        day_of_week: selectedDays.length === 7 ? null : selectedDays[0],
                        notes: null,
                    }),
                });
            }

            const data = await response.json();
            if (data.success) {
                toast.success(editingSchedule ? 'Horaire mis à jour avec succès' : 'Horaire créé avec succès');
                setShowModal(false);
                loadSchedules();
            } else {
                toast.error(data.error || 'Erreur lors de la sauvegarde');
            }
        } catch (error: any) {
            console.error('[ManageAgencySchedulesPage] Erreur sauvegarde:', error);
            toast.error('Une erreur est survenue');
        }
    };

    const handleDeleteSchedule = async (schedule: Schedule) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'horaire ${schedule.departure_city} → ${schedule.arrival_city} à ${schedule.departure_time} ?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/bus-tickets/agencies/schedules/${schedule.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Horaire supprimé');
                loadSchedules();
            } else {
                toast.error(data.error || 'Impossible de supprimer');
            }
        } catch (error: any) {
            console.error('[ManageAgencySchedulesPage] Erreur suppression:', error);
            toast.error('Une erreur est survenue');
        }
    };

    const handleToggleActive = async (schedule: Schedule) => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/bus-tickets/agencies/schedules/${schedule.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_active: !schedule.is_active,
                }),
            });

            const data = await response.json();
            if (data.success) {
                loadSchedules();
            } else {
                toast.error('Impossible de mettre à jour');
            }
        } catch (error) {
            toast.error('Erreur lors de la mise à jour');
        }
    };

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Horaires de départ</h1>
                    <p className="text-gray-600 mt-2">
                        Gérez les horaires de départ pour permettre aux clients de sélectionner l'heure de retour souhaitée
                    </p>
                </div>
                <Button onClick={handleAddSchedule} className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Créer un horaire
                </Button>
            </div>

            {/* Liste des horaires */}
            {schedules.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Clock className="w-16 h-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun horaire configuré</h3>
                        <p className="text-gray-600 text-center mb-6 max-w-md">
                            Créez votre premier horaire de départ pour permettre aux clients de sélectionner l'heure de retour souhaitée
                        </p>
                        <Button onClick={handleAddSchedule} className="flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Créer un horaire
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Horaires configurés</CardTitle>
                        <CardDescription>
                            {schedules.length} horaire{schedules.length > 1 ? 's' : ''} configuré{schedules.length > 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Route</TableHead>
                                    <TableHead>Heure</TableHead>
                                    <TableHead>Jours</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedules.map((schedule) => (
                                    <TableRow key={schedule.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium">
                                                    {schedule.departure_city} → {schedule.arrival_city}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-indigo-600" />
                                                <span className="font-semibold text-indigo-600">
                                                    {schedule.departure_time}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {schedule.day_of_week && schedule.day_of_week.length > 0 ? (
                                                    schedule.day_of_week.map(day => (
                                                        <Badge key={day} variant="secondary" className="text-xs">
                                                            {DAYS_OF_WEEK.find(d => d.value === day)?.label.substring(0, 3) || `J${day}`}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">Tous les jours</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={schedule.is_active}
                                                onCheckedChange={() => handleToggleActive(schedule)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditSchedule(schedule)}
                                                    className="flex items-center gap-1"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Modifier
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteSchedule(schedule)}
                                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Supprimer
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Modal d'ajout/modification */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSchedule ? 'Modifier l\'horaire' : 'Nouvel horaire'}
                        </DialogTitle>
                        <DialogDescription>
                            Configurez les horaires de départ pour un trajet spécifique
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="departureCity">Ville de départ *</Label>
                                <Input
                                    id="departureCity"
                                    value={departureCity}
                                    onChange={(e) => setDepartureCity(e.target.value)}
                                    placeholder="Ex: Douala"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="arrivalCity">Ville d'arrivée *</Label>
                                <Input
                                    id="arrivalCity"
                                    value={arrivalCity}
                                    onChange={(e) => setArrivalCity(e.target.value)}
                                    placeholder="Ex: Yaoundé"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="departureTime">Heure de départ *</Label>
                            <Input
                                id="departureTime"
                                value={departureTime}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                placeholder="HH:MM (ex: 08:00)"
                                maxLength={5}
                            />
                            <p className="text-xs text-gray-500">Format: HH:MM (ex: 08:00, 14:30, 20:00)</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Jours de la semaine *</Label>
                            <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((day) => (
                                    <Button
                                        key={day.value}
                                        type="button"
                                        variant={selectedDays.includes(day.value) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => toggleDay(day.value)}
                                        className={
                                            selectedDays.includes(day.value)
                                                ? "bg-indigo-600 text-white"
                                                : ""
                                        }
                                    >
                                        {day.label.substring(0, 3)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="isActive">Actif</Label>
                            <Switch
                                id="isActive"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleSaveSchedule}>
                            {editingSchedule ? 'Modifier' : 'Créer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ManageAgencySchedulesPage;

