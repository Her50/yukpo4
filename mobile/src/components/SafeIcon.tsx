// Composant d'icônes sécurisé avec fallbacks
import * as React from 'react';
import { StyleSheet, Text } from 'react-native';

// Import statique de Lucide
import * as LucideIconsImport from 'lucide-react-native';

// Import sécurisé d'Ionicons avec gestion d'erreur
import { safeRequire } from '../utils/errorHandler';

const IoniconModule = safeRequire(
    () => require('@expo/vector-icons/Ionicons'),
    null,
    { component: 'SafeIcon', action: 'import_ionicons' }
);

// Utiliser les imports statiques
const LucideIcons: any = LucideIconsImport || {};
const Ionicons: any = IoniconModule || {};

interface SafeIconProps {
    name: string;
    size?: number;
    color?: string;
    type?: 'lucide' | 'ionicons' | 'emoji';
}

// Mapping des icônes vers des emojis comme fallback
const iconToEmoji: { [key: string]: string } = {
    // Navigation
    'home': '🏠',
    'user': '👤',
    'settings': '⚙️',
    'menu': '☰',
    'search': '🔍',
    'plus': '➕',
    'minus': '➖',
    'close': '✕',
    'check': '✅',
    'x': '❌',
    'edit': '✏️',
    'edit-2': '✏️',
    'delete': '🗑️',
    'trash': '🗑️',
    'trash-2': '🗑️',
    'save': '💾',
    'download': '⬇️',
    'upload': '⬆️',
    'share': '📤',
    'share-2': '🔗',
    'Share2': '📤',
    'copy': '📋',
    'refresh': '🔄',
    'back': '←',
    'forward': '→',
    'up': '↑',
    'down': '↓',

    // Actions
    'play': '▶️',
    'pause': '⏸️',
    'stop': '⏹️',
    'heart': '❤️',
    'star': '⭐',
    'like': '👍',
    'dislike': '👎',
    'eye': '👁️',
    'eye-off': '🙈',
    'power': '⚡',
    'power-off': '🔌',
    'slash': '🚫',
    'lock': '🔒',
    'unlock': '🔓',
    'key': '🗝️',
    'bell': '🔔',
    'mail': '📧',
    'phone': '📞',
    'message': '💬',
    'camera': '📷',
    'image': '🖼️',
    'file': '📄',
    'folder': '📁',
    'link': '🔗',

    // Statuts
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
    'loading': '⏳',
    'pending': '⏳',
    'done': '✅',

    // Services
    'briefcase': '💼',
    'service': '🛠️',
    'chat': '💬',
    'history': '📊',
    'dashboard': '📈',
    'profile': '👤',
    'wallet': '💳',
    'credit': '💰',
    'tokens': '🪙',
    'location': '📍',
    'map': '🗺️',
    'weather': '🌤️',
    'time': '🕐',
    'calendar': '📅',

    // Services Yukpo
    'Heart': '❤️',
    'Activity': '💊',
    'activity': '💊',
    'BookOpen': '📚',
    'book-open': '📚',
    'ShoppingCart': '🛒',
    'shopping-cart': '🛒',
    'ShoppingBag': '🛍️',
    'shopping-bag': '🛍️',
    'Package': '📦',
    'package': '📦',
    'Plane': '✈️',
    'plane': '✈️',
    'Car': '🚗',
    'car': '🚗',
    'ChevronRight': '›',
    'chevron-right': '›',
    'arrow-left': '←',
    'arrow-right': '→',
    'clock': '⏰',
    'mic': '🎤',
    'mic-off': '🔇',
    'stop-circle': '⏹️',
    'play-circle': '▶️',
    'smile': '😊',
    'video': '📹',
    'video-off': '🚫',
    'volume-2': '🔊',
    'phone-off': '📵',

    // ✅ AJOUTS: Icônes manquantes courantes
    'filter': '🔽',
    'send': '📤',
    'chevron-down': '▼',
    'chevron-up': '▲',
    'chevron-left': '◀',
    'more-vertical': '⋮',
    'more-horizontal': '⋯',
    'arrow-up': '↑',
    'arrow-down': '↓',
    'external-link': '🔗',
    'globe': '🌐',
    'users': '👥',
    'user-plus': '👤➕',
    'dollar-sign': '💲',
    'credit-card': '💳',
    'gift': '🎁',
    'tag': '🏷️',
    'bookmark': '🔖',
    'flag': '🚩',
    'percent': '%',
    'trending-up': '📈',
    'trending-down': '📉',
    'pie-chart': '🥧',
    'bar-chart': '📊',
    'layers': '📚',
    'grid': '▦',
    'list': '☰',
    'maximize': '⛶',
    'minimize': '⊟',
    'zoom-in': '🔍➕',
    'zoom-out': '🔍➖',
    'rotate-cw': '↻',
    'rotate-ccw': '↺',
    'paperclip': '📎',
    'reply': '↩️', // ✅ CORRIGÉ : Icône de réponse
    'corner-down-right': '↪️',
    'corner-up-right': '↗️',
    'video-call': '📞', // ✅ CORRIGÉ : Icône d'appel vidéo classique
    'videocall': '📞',
    'videoCall': '📞',
    'printer': '🖨️',
    'wifi': '📶',
    'wifi-off': '📵',
    'bluetooth': '🔵',
    'battery': '🔋',
    'cpu': '💻',
    'hard-drive': '💾',
    'database': '🗄️',
    'server': '🖥️',
    'terminal': '⌨️',
    'code': '💻',
    'command': '⌘',

    // ✅ AJOUTS: Icônes pour ResultatBesoinScreen et ProductCard
    'map-pin': '📍',
    'mappin': '📍',
    'MapPin': '📍',
    'file-text': '📄',
    'filetext': '📄',
    'FileText': '📄',
    'message-circle': '💬',
    'messagecircle': '💬',
    'MessageCircle': '💬',
    'truck': '🚚',
    'Truck': '🚚',
    'utensils': '🍴',
    'utensils-crossed': '🍴',
    'UtensilsCrossed': '🍴',
    'chef-hat': '👨‍🍳',
    'chef-hat-icon': '👨‍🍳',
    'bike': '🚴', // ✅ Livreur à vélo
    'Bike': '🚴',
    'bicycle': '🚴',
    'Bicycle': '🚴',
    'user-check': '👤✅', // ✅ Livreur (utilisateur vérifié)
    'userCheck': '👤✅',
    'UserCheck': '👤✅',
    'navigation': '🧭',
    'Navigation': '🧭',
    'sliders': '🎚️',
    'Sliders': '🎚️',
    'sparkles': '✨',
    'Sparkles': '✨',
    'flame': '🔥',
    'Flame': '🔥',
    'check-circle': '✅',
    'checkcircle': '✅',
    'CheckCircle': '✅',
    'cake': '🎂',
    'Cake': '🎂',
    'birthday': '🎂',
    'package-x': '📦❌',
    'packagex': '📦❌',
    'PackageX': '📦❌',
    'corner-up-right': '↗️',
    'cornerupright': '↗️',
    'CornerUpRight': '↗️',
    'zap': '⚡',
    'Zap': '⚡',
    'store': '🏪',
    'Store': '🏪',
    'info': 'ℹ️',
    'Info': 'ℹ️',
    'gallery': '🖼️',
    'Gallery': '🖼️',
    'images': '🖼️',
    'Images': '🖼️',

    // ✅ Appareils
    'tablet': '📱',
    'Tablet': '📱',
    'tablet-portrait': '📱',
    'TabletPortrait': '📱',
    'smartphone': '📱',
    'Smartphone': '📱',
    'phone': '📱',
    'Phone': '📱',
    'music': '🎵',
    'Music': '🎵',
    'headphones': '🎧',
    'Headphones': '🎧',

    // ✅ Services spécialisés - Santé
    'pill': '💊',
    'Pill': '💊',
    'pharmacy': '💊',
    'Pharmacy': '💊',
    'medicine': '💊',
    'Medicine': '💊',
    'hospital': '🏥',
    'Hospital': '🏥',
    'hospital-building': '🏥',
    'HospitalBuilding': '🏥',
    'stethoscope': '🩺',
    'Stethoscope': '🩺',
    'microscope': '🔬',
    'Microscope': '🔬',
    'flask': '🧪',
    'Flask': '🧪',
    'flask-conical': '🧪',
    'FlaskConical': '🧪',
    'droplet': '🩸',
    'Droplet': '🩸',
    'heart': '❤️',
    'Heart': '❤️',
    'blood': '🩸',
    'Blood': '🩸',
    'heart-pulse': '❤️',
    'HeartPulse': '❤️',

    // ✅ Services spécialisés - Transport
    'bus': '🚌',
    'Bus': '🚌',
    'plane': '✈️',
    'Plane': '✈️',
    'users': '👥',
    'Users': '👥',
    'user-group': '👥',
    'UserGroup': '👥',
    'car': '🚗',
    'Car': '🚗',
    'taxi': '🚕',
    'Taxi': '🚕',
    'map': '🗺️',
    'Map': '🗺️',
    'map-pin': '📍',
    'MapPin': '📍',

    // Défaut
    'default': '📱'
};

// Fonction pour convertir kebab-case en PascalCase (ex: message-circle -> MessageCircle)
const toPascalCase = (str: string): string => {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
};

export const SafeIcon: React.FC<SafeIconProps> = ({
    name,
    size = 24,
    color = '#000',
    type = 'lucide'
}) => {
    // ✅ CORRIGÉ : Essayer Lucide avec plusieurs variantes de noms
    if (type === 'lucide' && LucideIcons && typeof LucideIcons === 'object') {
        // Essayer le nom tel quel (PascalCase)
        if (name && LucideIcons[name] && typeof LucideIcons[name] === 'function') {
            try {
                const IconComponent = LucideIcons[name];
                return <IconComponent size={size} color={color} accessibilityLabel="" accessibilityRole="none" />;
            } catch (error) {
                console.warn(`[SafeIcon] Erreur avec l'icône Lucide ${name}:`, error);
            }
        }

        // Essayer en PascalCase si c'est du kebab-case (message-circle -> MessageCircle)
        const pascalName = toPascalCase(name);
        if (pascalName && pascalName !== name && LucideIcons[pascalName] && typeof LucideIcons[pascalName] === 'function') {
            try {
                const IconComponent = LucideIcons[pascalName];
                return <IconComponent size={size} color={color} accessibilityLabel="" accessibilityRole="none" />;
            } catch (error) {
                console.warn(`[SafeIcon] Erreur avec l'icône Lucide ${pascalName}:`, error);
            }
        }
    }

    // Essayer Ionicons en fallback
    if (Ionicons.default && Ionicons.default.getRawGlyphMap) {
        try {
            const glyphMap = Ionicons.default.getRawGlyphMap();
            if (glyphMap[name]) {
                return <Ionicons.default name={name} size={size} color={color} accessibilityLabel="" accessibilityRole="none" />;
            }
        } catch (error) {
            console.warn(`[SafeIcon] Erreur avec l'icône Ionicons ${name}:`, error);
        }
    }

    // ✅ CORRIGÉ : Fallback vers emoji avec recherche améliorée
    const normalizedName = name.toLowerCase();
    const emoji = iconToEmoji[normalizedName] || iconToEmoji[name] || iconToEmoji['default'];
    return (
        <Text style={[styles.emoji, { fontSize: size }]}>
            {emoji}
        </Text>
    );
};

// Composant pour les icônes de navigation (optimisé pour les tabs)
export const TabIcon: React.FC<{ name: string; focused: boolean; size?: number }> = ({
    name,
    focused,
    size = 24
}) => {
    const color = focused ? '#6366F1' : '#9CA3AF';

    // Mapping spécifique pour les tabs
    const tabIconMap: { [key: string]: string } = {
        'Home': 'home',
        'MesServices': 'briefcase',
        'Dashboard': 'dashboard',
        'Historique': 'time',
        'RechargeTokens': 'plus',
        'MonCompte': 'user',
        'Settings': 'settings',
        'Logs': 'file-text'
    };

    const iconName = tabIconMap[name] || name;

    return <SafeIcon name={iconName} size={size} color={color} type="lucide" />;
};

// Composant pour les icônes d'action rapide
export const ActionIcon: React.FC<{ name: string; onPress?: () => void; size?: number; color?: string }> = ({
    name,
    onPress,
    size = 20,
    color = '#666'
}) => {
    return <SafeIcon name={name} size={size} color={color} type="lucide" />;
};

const styles = StyleSheet.create({
    emoji: {
        textAlign: 'center',
        includeFontPadding: false,
    },
});

export default SafeIcon;
