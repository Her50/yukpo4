// ⚙️ Page de paramètres utilisateur complète et professionnelle
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { userApi } from '@/services/api';
import {
    Activity,
    AlertCircle,
    BarChart3,
    Bell,
    CheckCircle,
    Database,
    Download,
    Globe,
    Key,
    Languages,
    Lock,
    MapPin,
    Palette,
    RefreshCw,
    Save,
    Shield,
    Trash2,
    Upload,
    User
} from 'lucide-react';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface UserSettings {
    // Profil
    name: string;
    email: string;
    phone: string;
    bio: string;
    avatar: string;

    // Préférences de langue
    language: string;
    autoTranslation: boolean;
    gpsLanguageDetection: boolean;

    // Notifications
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;

    // Confidentialité
    profileVisibility: 'public' | 'private' | 'friends';
    showLocation: boolean;
    showOnlineStatus: boolean;
    allowDataCollection: boolean;

    // Apparence
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;

    // Sécurité
    twoFactorAuth: boolean;
    sessionTimeout: number; // minutes
    loginAlerts: boolean;
}

const UserSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const {
        currentLanguage,
        isDetecting,
        detectionResult,
        changeLanguage,
        detectAndSetLanguage,
        languageUsageStats,
        translationCacheStats,
        enableAutoTranslation,
        clearLanguageData
    } = useIntelligentLanguage();

    const [settings, setSettings] = useState<UserSettings>({
        // Profil
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        bio: user?.bio || '',
        avatar: user?.photo || '',

        // Préférences de langue
        language: currentLanguage,
        autoTranslation: true,
        gpsLanguageDetection: true,

        // Notifications
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,

        // Confidentialité
        profileVisibility: 'public',
        showLocation: true,
        showOnlineStatus: true,
        allowDataCollection: true,

        // Apparence
        theme: 'auto',
        fontSize: 'medium',
        compactMode: false,

        // Sécurité
        twoFactorAuth: false,
        sessionTimeout: 60,
        loginAlerts: true
    });

    const [activeTab, setActiveTab] = useState<'profile' | 'language' | 'notifications' | 'privacy' | 'appearance' | 'security' | 'data'>('profile');
    const [loading, setLoading] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Mettre à jour les paramètres quand l'utilisateur change
    useEffect(() => {
        if (user) {
            // Construire le nom complet à partir des champs disponibles
            const fullName = user.nom_complet ||
                (user.nom && user.prenom ? `${user.prenom} ${user.nom}` : '') ||
                user.name ||
                '';

            setSettings(prev => ({
                ...prev,
                name: fullName,
                email: user.email || '',
                phone: user.phone || '',
                bio: user.bio || '',
                avatar: user.photo_profil || user.avatar_url || user.photo || ''
            }));
        }
    }, [user]);

    // Charger les paramètres depuis l'API
    useEffect(() => {
        if (user?.id) {
            loadUserSettings();
        }
    }, [user?.id]);

    const loadUserSettings = async () => {
        if (!user?.id) return;

        try {
            const response = await userApi.getUserProfile();

            if (response.success) {
                const data = response.data;
                // Construire le nom complet à partir des champs disponibles
                const fullName = data.nom_complet ||
                    (data.nom && data.prenom ? `${data.prenom} ${data.nom}` : '') ||
                    data.name ||
                    '';

                setSettings(prev => ({
                    ...prev,
                    name: fullName,
                    email: data.email || '',
                    phone: '', // Champ non disponible dans la base
                    bio: '', // Champ non disponible dans la base
                    avatar: data.photo_profil || data.avatar_url || data.photo || ''
                }));
            }
        } catch (error) {
            console.error('Erreur chargement paramètres:', error);
        }
    };

    const saveSettings = async () => {
        setLoading(true);

        try {
            const response = await userApi.updateUserProfile(settings);

            if (response.success) {
                toast({
                    title: "Paramètres sauvegardés",
                    description: "Vos préférences ont été mises à jour avec succès",
                    type: "success"
                });
            } else {
                throw new Error('Erreur sauvegarde');
            }
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de sauvegarder les paramètres",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLanguageChange = async (language: string) => {
        await changeLanguage(language);
        setSettings(prev => ({ ...prev, language }));
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: "Erreur",
                description: "Les mots de passe ne correspondent pas",
                type: "error"
            });
            return;
        }

        try {
            // Note: userApi n'a pas de méthode change-password spécifique
            // On utilise l'API générique pour l'instant
            const response = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(passwordData)
            });

            if (response.ok) {
                toast({
                    title: "Mot de passe modifié",
                    description: "Votre mot de passe a été mis à jour avec succès",
                    type: "success"
                });
                setShowPasswordForm(false);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                throw new Error('Erreur changement mot de passe');
            }
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de modifier le mot de passe",
                type: "error"
            });
        }
    };

    const exportUserData = async () => {
        try {
            // Note: Fonctionnalité d'export désactivée pour React Native
            // Dans une vraie app mobile, on utiliserait react-native-fs ou expo-file-system
            toast({
                title: "Export de données",
                description: "Cette fonctionnalité n'est pas disponible sur mobile",
                type: "info"
            });
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible d'exporter les données",
                type: "error"
            });
        }
    };

    const deleteAccount = async () => {
        // Note: Dans React Native, on utiliserait Alert.alert au lieu de confirm
        // Pour l'instant, on désactive cette fonctionnalité
        toast({
            title: "Suppression de compte",
            description: "Cette fonctionnalité n'est pas disponible sur mobile",
            type: "info"
        });
        return;

        try {
            const response = await fetch('/api/users/delete-account', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                toast({
                    title: "Compte supprimé",
                    description: "Votre compte a été supprimé avec succès",
                    type: "success"
                });
                // Note: Dans React Native, on utiliserait navigation.navigate
                // navigation.navigate('Home');
            }
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de supprimer le compte",
                type: "error"
            });
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'language', label: 'Langue', icon: Languages },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'privacy', label: 'Confidentialité', icon: Shield },
        { id: 'appearance', label: 'Apparence', icon: Palette },
        { id: 'security', label: 'Sécurité', icon: Lock },
        { id: 'data', label: 'Données', icon: Database }
    ];

    return (
        <ResponsiveContainer>
            <View style="py-8">
                {/* Header */}
                <View style="mb-8">
                    <Text style="text-3xl font-bold text-gray-900 mb-2">
                        Paramètres du compte
                    </Text>
                    <Text style="text-gray-600">
                        Gérez vos préférences et paramètres personnels
                    </Text>
                </View>

                <View style="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <View style="lg:col-span-1">
                        <Card>
                            <CardContent style="p-4">
                                <nav style="space-y-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <TouchableOpacity
                                                key={tab.id}
                                                onPress={() => setActiveTab(tab.id as any)}
                                                style={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === tab.id
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <Icon style="w-5 h-5" />
                                                {tab.label}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </nav>
                            </CardContent>
                        </Card>
                    </View>

                    {/* Main Content */}
                    <View style="lg:col-span-3">
                        {/* Profil */}
                        {activeTab === 'profile' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle style="flex items-center gap-2">
                                        <User style="w-5 h-5" />
                                        Informations du profil
                                    </CardTitle>
                                </CardHeader>
                                <CardContent style="space-y-6">
                                    {/* Avatar */}
                                    <View style="flex items-center gap-4">
                                        <Avatar style="w-20 h-20">
                                            <AvatarImage src={settings.avatar} />
                                            <AvatarFallback style="text-2xl">
                                                {settings.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <View>
                                            <TouchableOpacity variant="outline" size="sm">
                                                <Upload style="w-4 h-4 mr-2" />
                                                Changer la photo
                                            </TouchableOpacity>
                                            <Text style="text-sm text-gray-500 mt-1">
                                                JPG, PNG ou GIF. Max 2MB.
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Informations personnelles */}
                                    <View style="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <View>
                                            <label style="block text-sm font-medium text-gray-700 mb-2">
                                                Nom complet
                                            </label>
                                            <TextInput
                                                type="text"
                                                value={settings.name}
                                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                                style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </View>

                                        <View>
                                            <label style="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <TextInput
                                                type="email"
                                                value={settings.email}
                                                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                                                style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </View>

                                        <View>
                                            <label style="block text-sm font-medium text-gray-700 mb-2">
                                                Téléphone
                                            </label>
                                            <TextInput
                                                type="tel"
                                                value={settings.phone}
                                                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                                                style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </View>

                                        <View>
                                            <label style="block text-sm font-medium text-gray-700 mb-2">
                                                Visibilité du profil
                                            </label>
                                            <select
                                                value={settings.profileVisibility}
                                                onChange={(e) => setSettings(prev => ({ ...prev, profileVisibility: e.target.value as any }))}
                                                style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="public">Public</option>
                                                <option value="friends">Amis uniquement</option>
                                                <option value="private">Privé</option>
                                            </select>
                                        </View>
                                    </View>

                                    <View>
                                        <label style="block text-sm font-medium text-gray-700 mb-2">
                                            Biographie
                                        </label>
                                        <textarea
                                            value={settings.bio}
                                            onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                                            rows={4}
                                            style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Parlez-nous de vous..."
                                        />
                                    </View>
                                </CardContent>
                            </Card>
                        )}

                        {/* Langue */}
                        {activeTab === 'language' && (
                            <View style="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle style="flex items-center gap-2">
                                            <Languages style="w-5 h-5" />
                                            Préférences de langue
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent style="space-y-6">
                                        {/* Sélection de langue */}
                                        <View>
                                            <label style="block text-sm font-medium text-gray-700 mb-2">
                                                Langue de l'interface
                                            </label>
                                            <select
                                                value={settings.language}
                                                onChange={(e) => handleLanguageChange(e.target.value)}
                                                style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="fr">🇫🇷 Français</option>
                                                <option value="en">🇬🇧 English</option>
                                                <option value="pt">🇵🇹 Português</option>
                                                <option value="ar">🇸🇦 العربية</option>
                                                <option value="ff">🌍 Fula</option>
                                            </select>
                                        </View>

                                        {/* Détection automatique */}
                                        <View style="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                            <View>
                                                <Text style="font-medium text-blue-900">Détection automatique GPS</Text>
                                                <Text style="text-sm text-blue-700">
                                                    Détecter la langue basée sur votre position
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                variant="outline"
                                                size="sm"
                                                onPress={detectAndSetLanguage}
                                                disabled={isDetecting}
                                            >
                                                {isDetecting ? (
                                                    <RefreshCw style="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <MapPin style="w-4 h-4" />
                                                )}
                                                Détecter
                                            </TouchableOpacity>
                                        </View>

                                        {/* Résultat de détection */}
                                        {detectionResult && (
                                            <View style="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <View style="flex items-center gap-2 mb-2">
                                                    <CheckCircle style="w-5 h-5 text-green-600" />
                                                    <Text style="font-medium text-green-900">Langue détectée</Text>
                                                </View>
                                                <Text style="text-sm text-green-700">
                                                    {detectionResult.language} - {detectionResult.reasoning}
                                                </Text>
                                                <Badge style="mt-2 bg-green-100 text-green-800">
                                                    Confiance: {Math.round(detectionResult.confidence * 100)}%
                                                </Badge>
                                            </View>
                                        )}

                                        {/* Traduction automatique */}
                                        <View style="flex items-center justify-between">
                                            <View>
                                                <Text style="font-medium text-gray-900">Traduction automatique</Text>
                                                <Text style="text-sm text-gray-600">
                                                    Traduire automatiquement le contenu dans votre langue
                                                </Text>
                                            </View>
                                            <label style="relative inline-flex items-center cursor-pointer">
                                                <TextInput
                                                    type="checkbox"
                                                    checked={settings.autoTranslation}
                                                    onChange={(e) => {
                                                        setSettings(prev => ({ ...prev, autoTranslation: e.target.checked }));
                                                        enableAutoTranslation(e.target.checked);
                                                    }}
                                                    style="sr-only peer"
                                                />
                                                <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                            </label>
                                        </View>

                                        {/* Statistiques d'usage */}
                                        {languageUsageStats.length > 0 && (
                                            <View>
                                                <Text style="font-medium text-gray-900 mb-3">Statistiques d'usage des langues</Text>
                                                <View style="space-y-2">
                                                    {languageUsageStats.map((stat) => (
                                                        <View key={stat.language} style="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                            <View>
                                                                <Text style="font-medium">{stat.language}</Text>
                                                                <Text style="text-sm text-gray-600">
                                                                    {stat.contexts.join(', ')}
                                                                </Text>
                                                            </View>
                                                            <Badge variant="outline">
                                                                {stat.usageCount} utilisations
                                                            </Badge>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {/* Cache de traduction */}
                                        <View style="p-4 bg-gray-50 rounded-lg">
                                            <Text style="font-medium text-gray-900 mb-2">Cache de traduction</Text>
                                            <View style="flex items-center justify-between text-sm text-gray-600">
                                                <Text>Entrées en cache: {translationCacheStats.size}</Text>
                                                <Text>Taux de réussite: {Math.round(translationCacheStats.hitRate * 100)}%</Text>
                                            </View>
                                            <TouchableOpacity
                                                variant="outline"
                                                size="sm"
                                                onPress={clearLanguageData}
                                                style="mt-3"
                                            >
                                                <Trash2 style="w-4 h-4 mr-2" />
                                                Effacer les données
                                            </TouchableOpacity>
                                        </View>
                                    </CardContent>
                                </Card>
                            </View>
                        )}

                        {/* Notifications */}
                        {activeTab === 'notifications' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle style="flex items-center gap-2">
                                        <Bell style="w-5 h-5" />
                                        Préférences de notifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent style="space-y-6">
                                    {[
                                        { key: 'emailNotifications', label: 'Notifications par email', description: 'Recevoir des notifications importantes par email' },
                                        { key: 'pushNotifications', label: 'Notifications push', description: 'Recevoir des notifications sur votre appareil' },
                                        { key: 'smsNotifications', label: 'Notifications SMS', description: 'Recevoir des notifications par SMS' },
                                        { key: 'marketingEmails', label: 'Emails marketing', description: 'Recevoir des offres et actualités' }
                                    ].map((notification) => (
                                        <View key={notification.key} style="flex items-center justify-between">
                                            <View>
                                                <Text style="font-medium text-gray-900">{notification.label}</Text>
                                                <Text style="text-sm text-gray-600">{notification.description}</Text>
                                            </View>
                                            <label style="relative inline-flex items-center cursor-pointer">
                                                <TextInput
                                                    type="checkbox"
                                                    checked={settings[notification.key as keyof UserSettings] as boolean}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [notification.key]: e.target.checked }))}
                                                    style="sr-only peer"
                                                />
                                                <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                            </label>
                                        </View>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Confidentialité */}
                        {activeTab === 'privacy' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle style="flex items-center gap-2">
                                        <Shield style="w-5 h-5" />
                                        Confidentialité et sécurité
                                    </CardTitle>
                                </CardHeader>
                                <CardContent style="space-y-6">
                                    {[
                                        { key: 'showLocation', label: 'Afficher ma localisation', description: 'Permettre aux autres de voir votre position' },
                                        { key: 'showOnlineStatus', label: 'Statut en ligne', description: 'Afficher quand vous êtes connecté' },
                                        { key: 'allowDataCollection', label: 'Collecte de données', description: 'Autoriser la collecte de données pour améliorer le service' }
                                    ].map((privacy) => (
                                        <View key={privacy.key} style="flex items-center justify-between">
                                            <View>
                                                <Text style="font-medium text-gray-900">{privacy.label}</Text>
                                                <Text style="text-sm text-gray-600">{privacy.description}</Text>
                                            </View>
                                            <label style="relative inline-flex items-center cursor-pointer">
                                                <TextInput
                                                    type="checkbox"
                                                    checked={settings[privacy.key as keyof UserSettings] as boolean}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [privacy.key]: e.target.checked }))}
                                                    style="sr-only peer"
                                                />
                                                <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                            </label>
                                        </View>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Apparence */}
                        {activeTab === 'appearance' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle style="flex items-center gap-2">
                                        <Textalette style="w-5 h-5" />
                                        Apparence et thème
                                    </CardTitle>
                                </CardHeader>
                                <CardContent style="space-y-6">
                                    <View>
                                        <label style="block text-sm font-medium text-gray-700 mb-2">
                                            Thème
                                        </label>
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value as any }))}
                                            style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="light">Clair</option>
                                            <option value="dark">Sombre</option>
                                            <option value="auto">Automatique</option>
                                        </select>
                                    </View>

                                    <View>
                                        <label style="block text-sm font-medium text-gray-700 mb-2">
                                            Taille de police
                                        </label>
                                        <select
                                            value={settings.fontSize}
                                            onChange={(e) => setSettings(prev => ({ ...prev, fontSize: e.target.value as any }))}
                                            style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="small">Petite</option>
                                            <option value="medium">Moyenne</option>
                                            <option value="large">Grande</option>
                                        </select>
                                    </View>

                                    <View style="flex items-center justify-between">
                                        <View>
                                            <Text style="font-medium text-gray-900">Mode compact</Text>
                                            <Text style="text-sm text-gray-600">
                                                Interface plus dense avec moins d'espacement
                                            </Text>
                                        </View>
                                        <label style="relative inline-flex items-center cursor-pointer">
                                            <TextInput
                                                type="checkbox"
                                                checked={settings.compactMode}
                                                onChange={(e) => setSettings(prev => ({ ...prev, compactMode: e.target.checked }))}
                                                style="sr-only peer"
                                            />
                                            <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                        </label>
                                    </View>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sécurité */}
                        {activeTab === 'security' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle style="flex items-center gap-2">
                                        <Lock style="w-5 h-5" />
                                        Sécurité du compte
                                    </CardTitle>
                                </CardHeader>
                                <CardContent style="space-y-6">
                                    {/* Mot de passe */}
                                    <View>
                                        <Text style="font-medium text-gray-900 mb-3">Mot de passe</Text>
                                        {!showPasswordForm ? (
                                            <TouchableOpacity
                                                variant="outline"
                                                onPress={() => setShowPasswordForm(true)}
                                            >
                                                <Key style="w-4 h-4 mr-2" />
                                                Changer le mot de passe
                                            </TouchableOpacity>
                                        ) : (
                                            <View style="space-y-4 p-4 bg-gray-50 rounded-lg">
                                                <View>
                                                    <label style="block text-sm font-medium text-gray-700 mb-2">
                                                        Mot de passe actuel
                                                    </label>
                                                    <TextInput
                                                        type="password"
                                                        value={passwordData.currentPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                        style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </View>
                                                <View>
                                                    <label style="block text-sm font-medium text-gray-700 mb-2">
                                                        Nouveau mot de passe
                                                    </label>
                                                    <TextInput
                                                        type="password"
                                                        value={passwordData.newPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                                        style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </View>
                                                <View>
                                                    <label style="block text-sm font-medium text-gray-700 mb-2">
                                                        Confirmer le mot de passe
                                                    </label>
                                                    <TextInput
                                                        type="password"
                                                        value={passwordData.confirmPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </View>
                                                <View style="flex gap-2">
                                                    <TouchableOpacity onPress={handlePasswordChange}>
                                                        <Save style="w-4 h-4 mr-2" />
                                                        Sauvegarder
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        variant="outline"
                                                        onPress={() => setShowPasswordForm(false)}
                                                    >
                                                        Annuler
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Authentification à deux facteurs */}
                                    <View style="flex items-center justify-between">
                                        <View>
                                            <Text style="font-medium text-gray-900">Authentification à deux facteurs</Text>
                                            <Text style="text-sm text-gray-600">
                                                Ajouter une couche de sécurité supplémentaire
                                            </Text>
                                        </View>
                                        <label style="relative inline-flex items-center cursor-pointer">
                                            <TextInput
                                                type="checkbox"
                                                checked={settings.twoFactorAuth}
                                                onChange={(e) => setSettings(prev => ({ ...prev, twoFactorAuth: e.target.checked }))}
                                                style="sr-only peer"
                                            />
                                            <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                        </label>
                                    </View>

                                    {/* Timeout de session */}
                                    <View>
                                        <label style="block text-sm font-medium text-gray-700 mb-2">
                                            Timeout de session (minutes)
                                        </label>
                                        <TextInput
                                            type="number"
                                            min="5"
                                            max="480"
                                            value={settings.sessionTimeout}
                                            onChange={(e) => setSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                                            style="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </View>

                                    {/* Alertes de connexion */}
                                    <View style="flex items-center justify-between">
                                        <View>
                                            <Text style="font-medium text-gray-900">Alertes de connexion</Text>
                                            <Text style="text-sm text-gray-600">
                                                Recevoir des notifications pour les nouvelles connexions
                                            </Text>
                                        </View>
                                        <label style="relative inline-flex items-center cursor-pointer">
                                            <TextInput
                                                type="checkbox"
                                                checked={settings.loginAlerts}
                                                onChange={(e) => setSettings(prev => ({ ...prev, loginAlerts: e.target.checked }))}
                                                style="sr-only peer"
                                            />
                                            <View style="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></View>
                                        </label>
                                    </View>
                                </CardContent>
                            </Card>
                        )}

                        {/* Données */}
                        {activeTab === 'data' && (
                            <View style="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle style="flex items-center gap-2">
                                            <Database style="w-5 h-5" />
                                            Gestion des données
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent style="space-y-6">
                                        {/* Export des données */}
                                        <View style="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                            <View>
                                                <Text style="font-medium text-blue-900">Exporter mes données</Text>
                                                <Text style="text-sm text-blue-700">
                                                    Télécharger une copie de toutes vos données
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                variant="outline"
                                                onPress={exportUserData}
                                            >
                                                <Download style="w-4 h-4 mr-2" />
                                                Exporter
                                            </TouchableOpacity>
                                        </View>

                                        {/* Statistiques d'usage */}
                                        <View>
                                            <Text style="font-medium text-gray-900 mb-3">Statistiques d'usage</Text>
                                            <View style="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <View style="p-4 bg-gray-50 rounded-lg text-center">
                                                    <BarChart3 style="w-8 h-8 mx-auto mb-2 text-blue-600" />
                                                    <Text style="text-2xl font-bold text-gray-900">0</Text>
                                                    <Text style="text-sm text-gray-600">Services créés</Text>
                                                </View>
                                                <View style="p-4 bg-gray-50 rounded-lg text-center">
                                                    <Activity style="w-8 h-8 mx-auto mb-2 text-green-600" />
                                                    <Text style="text-2xl font-bold text-gray-900">0</Text>
                                                    <Text style="text-sm text-gray-600">Interactions</Text>
                                                </View>
                                                <View style="p-4 bg-gray-50 rounded-lg text-center">
                                                    <Globe style="w-8 h-8 mx-auto mb-2 text-purple-600" />
                                                    <Text style="text-2xl font-bold text-gray-900">0</Text>
                                                    <Text style="text-sm text-gray-600">Recherches</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Suppression du compte */}
                                        <View style="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <View style="flex items-center gap-2 mb-2">
                                                <AlertCircle style="w-5 h-5 text-red-600" />
                                                <Text style="font-medium text-red-900">Zone dangereuse</Text>
                                            </View>
                                            <Text style="text-sm text-red-700 mb-4">
                                                La suppression de votre compte est irréversible. Toutes vos données seront définitivement supprimées.
                                            </Text>
                                            <TouchableOpacity
                                                variant="outline"
                                                onPress={deleteAccount}
                                                style="border-red-300 text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 style="w-4 h-4 mr-2" />
                                                Supprimer mon compte
                                            </TouchableOpacity>
                                        </View>
                                    </CardContent>
                                </Card>
                            </View>
                        )}

                        {/* Actions globales */}
                        <View style="flex justify-end gap-4 pt-6">
                            <TouchableOpacity
                                variant="outline"
                                onPress={() => {/* Note: window.location.reload() n'existe pas en React Native */}}
                            >
                                Annuler
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveSettings}
                                disabled={loading}
                            >
                                {loading ? (
                                    <RefreshCw style="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save style="w-4 h-4 mr-2" />
                                )}
                                Sauvegarder les modifications
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </ResponsiveContainer>
    );
};

export default UserSettingsPage;






