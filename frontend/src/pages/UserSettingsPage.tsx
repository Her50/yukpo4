// ⚙️ Page de paramètres utilisateur complète et professionnelle
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { useUser } from '@/hooks/useUser';
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
import React, { useEffect, useState } from 'react';

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
    const { user } = useUser();
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

    // Charger les paramètres depuis l'API
    useEffect(() => {
        loadUserSettings();
    }, [user]);

    const loadUserSettings = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(`/api/users/${user.id}/settings`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Erreur chargement paramètres:', error);
        }
    };

    const saveSettings = async () => {
        setLoading(true);

        try {
            const response = await fetch(`/api/users/${user?.id}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
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
            const response = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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
            const response = await fetch('/api/users/export-data', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `yukpo-data-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);

                toast({
                    title: "Données exportées",
                    description: "Vos données ont été téléchargées",
                    type: "success"
                });
            }
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible d'exporter les données",
                type: "error"
            });
        }
    };

    const deleteAccount = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
            return;
        }

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
                // Rediriger vers la page d'accueil
                window.location.href = '/';
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
            <div className="py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Paramètres du compte
                    </h1>
                    <p className="text-gray-600">
                        Gérez vos préférences et paramètres personnels
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <Card>
                            <CardContent className="p-4">
                                <nav className="space-y-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === tab.id
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </nav>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {/* Profil */}
                        {activeTab === 'profile' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Informations du profil
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Avatar */}
                                    <div className="flex items-center gap-4">
                                        <Avatar className="w-20 h-20">
                                            <AvatarImage src={settings.avatar} />
                                            <AvatarFallback className="text-2xl">
                                                {settings.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <Button variant="outline" size="sm">
                                                <Upload className="w-4 h-4 mr-2" />
                                                Changer la photo
                                            </Button>
                                            <p className="text-sm text-gray-500 mt-1">
                                                JPG, PNG ou GIF. Max 2MB.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Informations personnelles */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nom complet
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.name}
                                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={settings.email}
                                                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Téléphone
                                            </label>
                                            <input
                                                type="tel"
                                                value={settings.phone}
                                                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Visibilité du profil
                                            </label>
                                            <select
                                                value={settings.profileVisibility}
                                                onChange={(e) => setSettings(prev => ({ ...prev, profileVisibility: e.target.value as any }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="public">Public</option>
                                                <option value="friends">Amis uniquement</option>
                                                <option value="private">Privé</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Biographie
                                        </label>
                                        <textarea
                                            value={settings.bio}
                                            onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Parlez-nous de vous..."
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Langue */}
                        {activeTab === 'language' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Languages className="w-5 h-5" />
                                            Préférences de langue
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Sélection de langue */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Langue de l'interface
                                            </label>
                                            <select
                                                value={settings.language}
                                                onChange={(e) => handleLanguageChange(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="fr">🇫🇷 Français</option>
                                                <option value="en">🇬🇧 English</option>
                                                <option value="pt">🇵🇹 Português</option>
                                                <option value="ar">🇸🇦 العربية</option>
                                                <option value="ff">🌍 Fula</option>
                                            </select>
                                        </div>

                                        {/* Détection automatique */}
                                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                            <div>
                                                <h3 className="font-medium text-blue-900">Détection automatique GPS</h3>
                                                <p className="text-sm text-blue-700">
                                                    Détecter la langue basée sur votre position
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={detectAndSetLanguage}
                                                disabled={isDetecting}
                                            >
                                                {isDetecting ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <MapPin className="w-4 h-4" />
                                                )}
                                                Détecter
                                            </Button>
                                        </div>

                                        {/* Résultat de détection */}
                                        {detectionResult && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                    <span className="font-medium text-green-900">Langue détectée</span>
                                                </div>
                                                <p className="text-sm text-green-700">
                                                    {detectionResult.language} - {detectionResult.reasoning}
                                                </p>
                                                <Badge className="mt-2 bg-green-100 text-green-800">
                                                    Confiance: {Math.round(detectionResult.confidence * 100)}%
                                                </Badge>
                                            </div>
                                        )}

                                        {/* Traduction automatique */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-gray-900">Traduction automatique</h3>
                                                <p className="text-sm text-gray-600">
                                                    Traduire automatiquement le contenu dans votre langue
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.autoTranslation}
                                                    onChange={(e) => {
                                                        setSettings(prev => ({ ...prev, autoTranslation: e.target.checked }));
                                                        enableAutoTranslation(e.target.checked);
                                                    }}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        {/* Statistiques d'usage */}
                                        {languageUsageStats.length > 0 && (
                                            <div>
                                                <h3 className="font-medium text-gray-900 mb-3">Statistiques d'usage des langues</h3>
                                                <div className="space-y-2">
                                                    {languageUsageStats.map((stat) => (
                                                        <div key={stat.language} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                            <div>
                                                                <span className="font-medium">{stat.language}</span>
                                                                <p className="text-sm text-gray-600">
                                                                    {stat.contexts.join(', ')}
                                                                </p>
                                                            </div>
                                                            <Badge variant="outline">
                                                                {stat.usageCount} utilisations
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cache de traduction */}
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h3 className="font-medium text-gray-900 mb-2">Cache de traduction</h3>
                                            <div className="flex items-center justify-between text-sm text-gray-600">
                                                <span>Entrées en cache: {translationCacheStats.size}</span>
                                                <span>Taux de réussite: {Math.round(translationCacheStats.hitRate * 100)}%</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={clearLanguageData}
                                                className="mt-3"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Effacer les données
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Notifications */}
                        {activeTab === 'notifications' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Bell className="w-5 h-5" />
                                        Préférences de notifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {[
                                        { key: 'emailNotifications', label: 'Notifications par email', description: 'Recevoir des notifications importantes par email' },
                                        { key: 'pushNotifications', label: 'Notifications push', description: 'Recevoir des notifications sur votre appareil' },
                                        { key: 'smsNotifications', label: 'Notifications SMS', description: 'Recevoir des notifications par SMS' },
                                        { key: 'marketingEmails', label: 'Emails marketing', description: 'Recevoir des offres et actualités' }
                                    ].map((notification) => (
                                        <div key={notification.key} className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{notification.label}</h3>
                                                <p className="text-sm text-gray-600">{notification.description}</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings[notification.key as keyof UserSettings] as boolean}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [notification.key]: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Confidentialité */}
                        {activeTab === 'privacy' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="w-5 h-5" />
                                        Confidentialité et sécurité
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {[
                                        { key: 'showLocation', label: 'Afficher ma localisation', description: 'Permettre aux autres de voir votre position' },
                                        { key: 'showOnlineStatus', label: 'Statut en ligne', description: 'Afficher quand vous êtes connecté' },
                                        { key: 'allowDataCollection', label: 'Collecte de données', description: 'Autoriser la collecte de données pour améliorer le service' }
                                    ].map((privacy) => (
                                        <div key={privacy.key} className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{privacy.label}</h3>
                                                <p className="text-sm text-gray-600">{privacy.description}</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings[privacy.key as keyof UserSettings] as boolean}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, [privacy.key]: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Apparence */}
                        {activeTab === 'appearance' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Palette className="w-5 h-5" />
                                        Apparence et thème
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Thème
                                        </label>
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value as any }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="light">Clair</option>
                                            <option value="dark">Sombre</option>
                                            <option value="auto">Automatique</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Taille de police
                                        </label>
                                        <select
                                            value={settings.fontSize}
                                            onChange={(e) => setSettings(prev => ({ ...prev, fontSize: e.target.value as any }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="small">Petite</option>
                                            <option value="medium">Moyenne</option>
                                            <option value="large">Grande</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-gray-900">Mode compact</h3>
                                            <p className="text-sm text-gray-600">
                                                Interface plus dense avec moins d'espacement
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.compactMode}
                                                onChange={(e) => setSettings(prev => ({ ...prev, compactMode: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sécurité */}
                        {activeTab === 'security' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Lock className="w-5 h-5" />
                                        Sécurité du compte
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Mot de passe */}
                                    <div>
                                        <h3 className="font-medium text-gray-900 mb-3">Mot de passe</h3>
                                        {!showPasswordForm ? (
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowPasswordForm(true)}
                                            >
                                                <Key className="w-4 h-4 mr-2" />
                                                Changer le mot de passe
                                            </Button>
                                        ) : (
                                            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Mot de passe actuel
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={passwordData.currentPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Nouveau mot de passe
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={passwordData.newPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Confirmer le mot de passe
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={passwordData.confirmPassword}
                                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={handlePasswordChange}>
                                                        <Save className="w-4 h-4 mr-2" />
                                                        Sauvegarder
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setShowPasswordForm(false)}
                                                    >
                                                        Annuler
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Authentification à deux facteurs */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-gray-900">Authentification à deux facteurs</h3>
                                            <p className="text-sm text-gray-600">
                                                Ajouter une couche de sécurité supplémentaire
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.twoFactorAuth}
                                                onChange={(e) => setSettings(prev => ({ ...prev, twoFactorAuth: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    {/* Timeout de session */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Timeout de session (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="480"
                                            value={settings.sessionTimeout}
                                            onChange={(e) => setSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Alertes de connexion */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-gray-900">Alertes de connexion</h3>
                                            <p className="text-sm text-gray-600">
                                                Recevoir des notifications pour les nouvelles connexions
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.loginAlerts}
                                                onChange={(e) => setSettings(prev => ({ ...prev, loginAlerts: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Données */}
                        {activeTab === 'data' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Database className="w-5 h-5" />
                                            Gestion des données
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Export des données */}
                                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                            <div>
                                                <h3 className="font-medium text-blue-900">Exporter mes données</h3>
                                                <p className="text-sm text-blue-700">
                                                    Télécharger une copie de toutes vos données
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={exportUserData}
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                Exporter
                                            </Button>
                                        </div>

                                        {/* Statistiques d'usage */}
                                        <div>
                                            <h3 className="font-medium text-gray-900 mb-3">Statistiques d'usage</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                                                    <p className="text-2xl font-bold text-gray-900">0</p>
                                                    <p className="text-sm text-gray-600">Services créés</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                    <Activity className="w-8 h-8 mx-auto mb-2 text-green-600" />
                                                    <p className="text-2xl font-bold text-gray-900">0</p>
                                                    <p className="text-sm text-gray-600">Interactions</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                    <Globe className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                                                    <p className="text-2xl font-bold text-gray-900">0</p>
                                                    <p className="text-sm text-gray-600">Recherches</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Suppression du compte */}
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertCircle className="w-5 h-5 text-red-600" />
                                                <h3 className="font-medium text-red-900">Zone dangereuse</h3>
                                            </div>
                                            <p className="text-sm text-red-700 mb-4">
                                                La suppression de votre compte est irréversible. Toutes vos données seront définitivement supprimées.
                                            </p>
                                            <Button
                                                variant="outline"
                                                onClick={deleteAccount}
                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer mon compte
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Actions globales */}
                        <div className="flex justify-end gap-4 pt-6">
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={saveSettings}
                                disabled={loading}
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Sauvegarder les modifications
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </ResponsiveContainer>
    );
};

export default UserSettingsPage;
