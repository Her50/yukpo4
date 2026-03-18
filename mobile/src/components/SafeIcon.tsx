// Composant d'icônes sécurisé avec fallbacks
import * as React from 'react';
import { StyleSheet, Text } from 'react-native';

// Import statique de Lucide
import * as LucideIconsImport from 'lucide-react-native';

// Import sécurisé d'Ionicons avec gestion d'erreur
import { safeRequire } from '../utils/errorHandler';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    style?: any;
    onPress?: () => void;
}

// Mapping des icônes vers des emojis comme fallback
const iconToEmoji: { [key: string]: string } = {
    // Navigation
    'home': '\uD83C\uDFE0',
    'user': '\uD83D\uDC64',
    'settings': '⚙️',
    'menu': '☰',
    'search': '\uD83D\uDD0D',
    'plus': '➕',
    'minus': '➖',
    'close': '✕',
    'check': '✅',
    'x': '❌',
    'edit': '✏️',
    'edit-2': '✏️',
    'delete': '\uD83D\uDDD1️',
    'trash': '\uD83D\uDDD1️',
    'trash-2': '\uD83D\uDDD1️',
    'save': '\uD83D\uDCBE',
    'download': '⬇️',
    'upload': '⬆️',
    'share': '\uD83D\uDCE4',
    'share-2': '\uD83D\uDD17',
    'Share2': '\uD83D\uDCE4',
    'copy': '\uD83D\uDCCB',
    'refresh': '\uD83D\uDD04',
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
    'like': '\uD83D\uDC4D',
    'dislike': '\uD83D\uDC4E',
    'eye': '\uD83D\uDC41️',
    'eye-off': '\uD83D\uDE48',
    'power': '⚡',
    'power-off': '\uD83D\uDD0C',
    'slash': '\uD83D\uDEAB',
    'lock': '\uD83D\uDD12',
    'unlock': '\uD83D\uDD13',
    'key': '\uD83D\uDDDD️',
    'bell': '\uD83D\uDD14',
    'mail': '\uD83D\uDCE7',
    'phone': '\uD83D\uDCDE',
    'message': '\uD83D\uDCAC',
    'camera': '\uD83D\uDCF7',
    'image': '\uD83D\uDDBC️',
    'file': '\uD83D\uDCC4',
    'folder': '\uD83D\uDCC1',
    'folder-open': '\uD83D\uDCC2',
    'FolderOpen': '\uD83D\uDCC2',
    'link': '\uD83D\uDD17',

    // Statuts
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
    'loading': '⏳',
    'pending': '⏳',
    'done': '✅',

    // Services
    'briefcase': '\uD83D\uDCBC',
    'service': '\uD83D\uDEE0️',
    'chat': '\uD83D\uDCAC',
    'history': '\uD83D\uDCCA',
    'dashboard': '\uD83D\uDCC8',
    'profile': '\uD83D\uDC64',
    'wallet': '\uD83D\uDCB3',
    'credit': '\uD83D\uDCB0',
    'tokens': '\uD83E\uDE99',
    'location': '\uD83D\uDCCD',
    'map': '\uD83D\uDDFA️',
    'weather': '\uD83C\uDF24️',
    'time': '\uD83D\uDD50',
    'calendar': '\uD83D\uDCC5',

    // Services Yukpo
    'Heart': '❤️',
    'Activity': '\uD83C\uDFC3',
    'activity': '\uD83C\uDFC3',
    'BookOpen': '\uD83D\uDCDA',
    'book-open': '\uD83D\uDCDA',
    'ShoppingCart': '\uD83D\uDED2',
    'shopping-cart': '\uD83D\uDED2',
    'ShoppingBag': '\uD83D\uDECD️',
    'shopping-bag': '\uD83D\uDECD️',
    'Package': '\uD83D\uDCE6',
    'package': '\uD83D\uDCE6',
    'Plane': '✈️',
    'ChevronRight': '›',
    'chevron-right': '›',
    'arrow-left': '←',
    'arrow-right': '→',
    'clock': '⏰',
    'mic': '\uD83C\uDFA4',
    'mic-off': '\uD83D\uDD07',
    'stop-circle': '⏹️',
    'play-circle': '▶️',
    'smile': '\uD83D\uDE0A',
    'video': '\uD83D\uDCF9',
    'video-off': '\uD83D\uDEAB',
    'volume-2': '\uD83D\uDD0A',
    'phone-off': '\uD83D\uDCF5',

    // ✅ AJOUTS: Icônes manquantes courantes
    'filter': '\uD83D\uDD3D',
    'send': '\uD83D\uDCE4',
    'chevron-down': '▼',
    'chevron-up': '▲',
    'chevron-left': '◀',
    'more-vertical': '⋮',
    'more-horizontal': '⋯',
    'arrow-up': '↑',
    'arrow-down': '↓',
    'external-link': '\uD83D\uDD17',
    'globe': '\uD83C\uDF10',
    'dollar-sign': '\uD83D\uDCB2',
    'credit-card': '\uD83D\uDCB3',
    'gift': '\uD83C\uDF81',
    'tag': '\uD83C\uDFF7️',
    'bookmark': '\uD83D\uDD16',
    'flag': '\uD83D\uDEA9',
    'percent': '%',
    'trending-up': '\uD83D\uDCC8',
    'trending-down': '\uD83D\uDCC9',
    'pie-chart': '\uD83E\uDD67',
    'bar-chart': '\uD83D\uDCCA',
    'layers': '\uD83D\uDCDA',
    'grid': '▦',
    'list': '☰',
    'maximize': '⛶',
    'minimize': '⊟',
    'zoom-in': '\uD83D\uDD0D➕',
    'zoom-out': '\uD83D\uDD0D➖',
    'rotate-cw': '↻',
    'rotate-ccw': '↺',
    'paperclip': '\uD83D\uDCCE',
    'reply': '↩️', // ✅ CORRIGÉ : Icône de réponse
    'corner-down-right': '↪️',
    'corner-up-right': '↗️',
    'video-call': '\uD83D\uDCDE', // ✅ CORRIGÉ : Icône d'appel vidéo classique
    'videocall': '\uD83D\uDCDE',
    'videoCall': '\uD83D\uDCDE',
    'printer': '\uD83D\uDDA8️',
    'wifi': '\uD83D\uDCF6',
    'wifi-off': '\uD83D\uDCF5',
    'bluetooth': '\uD83D\uDD35',
    'battery': '\uD83D\uDD0B',
    'cpu': '\uD83D\uDCBB',
    'hard-drive': '\uD83D\uDCBE',
    'database': '\uD83D\uDDC4️',
    'server': '\uD83D\uDDA5️',
    'terminal': '⌨️',
    'code': '\uD83D\uDCBB',
    'command': '⌘',

    // ✅ AJOUTS: Icônes pour ResultatBesoinScreen et ProductCard
    'map-pin': '\uD83D\uDCCD',
    'mappin': '\uD83D\uDCCD',
    'MapPin': '\uD83D\uDCCD',
    'file-text': '\uD83D\uDCC4',
    'filetext': '\uD83D\uDCC4',
    'FileText': '\uD83D\uDCC4',
    'message-circle': '\uD83D\uDCAC',
    'messagecircle': '\uD83D\uDCAC',
    'MessageCircle': '\uD83D\uDCAC',
    'truck': '\uD83D\uDE9A',
    'Truck': '\uD83D\uDE9A',
    'utensils': '\uD83C\uDF74',
    'utensils-crossed': '\uD83C\uDF74',
    'UtensilsCrossed': '\uD83C\uDF74',
    'chef-hat': '\uD83D\uDC68‍\uD83C\uDF73',
    'chef-hat-icon': '\uD83D\uDC68‍\uD83C\uDF73',
    'bike': '\uD83D\uDEB4', // ✅ Livreur à vélo
    'Bike': '\uD83D\uDEB4',
    'bicycle': '\uD83D\uDEB4',
    'Bicycle': '\uD83D\uDEB4',
    'user-check': '\uD83D\uDC64✅', // ✅ Livreur (utilisateur vérifié)
    'userCheck': '\uD83D\uDC64✅',
    'UserCheck': '\uD83D\uDC64✅',
    'navigation': '\uD83E\uDDED',
    'Navigation': '\uD83E\uDDED',
    'sparkles': '✨',
    'Sparkles': '✨',
    'flame': '\uD83D\uDD25',
    'Flame': '\uD83D\uDD25',
    'check-circle': '✅',
    'checkcircle': '✅',
    'CheckCircle': '✅',
    'cake': '\uD83C\uDF82',
    'Cake': '\uD83C\uDF82',
    'birthday': '\uD83C\uDF82',
    'package-x': '\uD83D\uDCE6❌',
    'packagex': '\uD83D\uDCE6❌',
    'PackageX': '\uD83D\uDCE6❌',
    'cornerupright': '↗️',
    'CornerUpRight': '↗️',
    'zap': '⚡',
    'Zap': '⚡',
    'store': '\uD83C\uDFEA',
    'Store': '\uD83C\uDFEA',
    'images': '\uD83D\uDDBC️',
    'Images': '\uD83D\uDDBC️',

    // ✅ Appareils
    'tablet': '\uD83D\uDCF1',
    'tablet-portrait': '\uD83D\uDCF1',
    'TabletPortrait': '\uD83D\uDCF1',
    'smartphone': '\uD83D\uDCF1',
    'Smartphone': '\uD83D\uDCF1',
    // Note: 'phone' est déjà défini ligne 77 avec '\uD83D\uDCDE' (téléphone classique pour appels)
    'music': '\uD83C\uDFB5',
    'Music': '\uD83C\uDFB5',
    'headphones': '\uD83C\uDFA7',
    'Headphones': '\uD83C\uDFA7',

    // ✅ Services spécialisés - Santé
    'pill': '\uD83D\uDC8A',
    'Pill': '\uD83D\uDC8A',
    'pharmacy': '\uD83D\uDC8A',
    'Pharmacy': '\uD83D\uDC8A',
    'medicine': '\uD83D\uDC8A',
    'Medicine': '\uD83D\uDC8A',
    'hospital': '\uD83C\uDFE5',
    'Hospital': '\uD83C\uDFE5',
    'hospital-building': '\uD83C\uDFE5',
    'HospitalBuilding': '\uD83C\uDFE5',
    'stethoscope': '\uD83E\uDE7A',
    'Stethoscope': '\uD83E\uDE7A',
    'microscope': '\uD83D\uDD2C',
    'Microscope': '\uD83D\uDD2C',
    'flask': '\uD83E\uDDEA',
    'Flask': '\uD83E\uDDEA',
    'flask-conical': '\uD83E\uDDEA',
    'FlaskConical': '\uD83E\uDDEA',
    'droplet': '\uD83E\uDE78',
    'Droplet': '\uD83E\uDE78',
    'heart-pulse': '❤️',
    'HeartPulse': '❤️',

    // ✅ Services spécialisés - Transport
    'bus': '\uD83D\uDE8C',
    'Bus': '\uD83D\uDE8C',
    'user-group': '\uD83D\uDC65',
    'UserGroup': '\uD83D\uDC65',
    'taxi': '\uD83D\uDE95',
    'building': '\uD83C\uDFE2',
    'Building': '\uD83C\uDFE2',
    'building-2': '\uD83C\uDFE2',
    'Building2': '\uD83C\uDFE2',
    'sliders-h': '\uD83C\uDF9A️',
    'SlidersH': '\uD83C\uDF9A️',
    'sliders-horizontal': '\uD83C\uDF9A️',
    'arrow-up-down': '↕️',
    'ArrowUpDown': '↕️',
    'arrow-up-down-icon': '↕️',
    'calendar-days': '\uD83D\uDCC5',
    'CalendarDays': '\uD83D\uDCC5',
    'calendar-range': '\uD83D\uDCC6',
    'CalendarRange': '\uD83D\uDCC6',
    'calendar-check': '\uD83D\uDCC5✅',
    'CalendarCheck': '\uD83D\uDCC5✅',

    // ✅ Navigation Screen icons
    'Car': '\uD83D\uDE97',
    'car': '\uD83D\uDE97',
    'Footprints': '\uD83D\uDC63',
    'footprints': '\uD83D\uDC63',
    'Radio': '\uD83D\uDCE1',
    'radio': '\uD83D\uDCE1',
    'Square': '⏹️',
    'square': '⏹️',
    'AlertTriangle': '⚠️',
    'alert-triangle': '⚠️',
    'TriangleAlert': '⚠️',
    'Crosshair': '⊕',
    'crosshair': '⊕',
    'Minimize2': '⊟',
    'minimize-2': '⊟',
    'Maximize2': '⛶',
    'maximize-2': '⛶',
    'RefreshCw': '\uD83D\uDD04',
    'refresh-cw': '\uD83D\uDD04',
    'Sliders': '\uD83C\uDF9A️',
    'sliders': '\uD83C\uDF9A️',
    'ChevronUp': '▲',
    'ChevronDown': '▼',
    'ChevronLeft': '◀',
    'Clock': '⏰',
    'Flag': '\uD83D\uDEA9',
    'List': '☰',
    'Map': '\uD83D\uDDFA️',
    'Bookmark': '\uD83D\uDD16',
    'Plus': '➕',
    'Search': '\uD83D\uDD0D',
    'Star': '⭐',
    'Info': 'ℹ️',
    'ExternalLink': '\uD83D\uDD17',
    'Compass': '\uD83E\uDDED',
    'BarChart3': '\uD83D\uDCCA',
    'TrendingUp': '\uD83D\uDCC8',
    'Target': '\uD83C\uDFAF',
    'Shield': '\uD83D\uDEE1️',
    'Layers': '\uD83D\uDCDA',
    'Route': '\uD83D\uDEE3️',
    'Gauge': '⏱️',
    'Timer': '⏱️',
    'CircleStop': '⏹️',

    // ✅ Actions supplémentaires
    'alert-circle': '⚠️',
    'arrow-back': '←',
    'arrow-clockwise': '\uD83D\uDD04',
    'arrow-right-left': '↔️',
    'at-sign': '@',
    'award': '\uD83C\uDFC6',
    'bar-chart-2': '\uD83D\uDCCA',
    'BarChart2': '\uD83D\uDCCA',
    'bed': '\uD83D\uDECF️',
    'box': '\uD83D\uDCE6',
    'book': '\uD83D\uDCD6',
    'briefcase-medical': '\uD83E\uDE7A',
    'bug': '\uD83D\uDC1B',
    'calculator': '\uD83E\uDDEE',
    'camera-off': '\uD83D\uDCF7',
    'check-square': '☑️',
    'checkmark-circle': '✅',
    'clipboard': '\uD83D\uDCCB',
    'close-circle': '❌',
    'closed-captioning': '\uD83D\uDD24',
    'cloud': '☁️',
    'coffee': '☕',
    'compass': '\uD83E\uDDED',
    'corner-down-left': '↩️',
    'crown': '\uD83D\uDC51',
    'Crown': '\uD83D\uDC51',
    'document-text-outline': '\uD83D\uDCC4',
    'dumbbell': '\uD83C\uDFCB️',
    'edit-3': '✏️',
    'film': '\uD83C\uDFAC',
    'Film': '\uD83C\uDFAC',
    'flower': '\uD83C\uDF38',
    'git-compare': '\uD83D\uDD00',
    'git-merge': '\uD83D\uDD00',
    'hammer': '\uD83D\uDD28',
    'help-circle': 'ℹ️',
    'hexagon': '⬡',
    'image-off': '\uD83D\uDDBC️',
    'inbox': '\uD83D\uDCE5',
    'keyframe': '\uD83C\uDF9E️',
    'layout': '\uD83D\uDCD0',
    'leaf': '\uD83C\uDF43',
    'lightbulb': '\uD83D\uDCA1',
    'loader': '⏳',
    'magnet': '\uD83E\uDDF2',
    'megaphone': '\uD83D\uDCE2',
    'Megaphone': '\uD83D\uDCE2',
    'message-square': '\uD83D\uDCAC',
    'MessageSquare': '\uD83D\uDCAC',
    'monitor': '\uD83D\uDDA5️',
    'mouse-pointer': '\uD83D\uDDB1️',
    'MousePointer': '\uD83D\uDDB1️',
    'music-off': '\uD83D\uDD07',
    'package-plus': '\uD83D\uDCE6',
    'PackagePlus': '\uD83D\uDCE6',
    'plus-circle': '➕',
    'PlusCircle': '➕',
    'qr-code': '\uD83D\uDCF1',
    'QrCode': '\uD83D\uDCF1',
    'refresh-ccw': '\uD83D\uDD04',
    'repeat': '\uD83D\uDD01',
    'ruler': '\uD83D\uDCCF',
    'scan': '\uD83D\uDCF2',
    'scissors': '✂️',
    'search-x': '\uD83D\uDD0D',
    'shield': '\uD83D\uDEE1️',
    'shield-check': '\uD83D\uDEE1️',
    'ShieldCheck': '\uD83D\uDEE1️',
    'shirt': '\uD83D\uDC55',
    'skip-back': '⏮️',
    'skip-forward': '⏭️',
    'sort': '↕️',
    'Sort': '↕️',
    'sprout': '\uD83C\uDF31',
    'sun': '☀️',
    'Taxi': '\uD83D\uDE95',
    'ticket': '\uD83C\uDFAB',
    'Ticket': '\uD83C\uDFAB',
    'target': '\uD83C\uDFAF',
    'tool': '\uD83D\uDD27',
    'trophy': '\uD83C\uDFC6',
    'Trophy': '\uD83C\uDFC6',
    'tv': '\uD83D\uDCFA',
    'usb': '\uD83D\uDD0C',
    'user-minus': '\uD83D\uDC64',
    'UserMinus': '\uD83D\uDC64',
    'user-plus': '\uD83D\uDC64➕',
    'UserPlus': '\uD83D\uDC64➕',
    'users': '\uD83D\uDC65',
    'Users': '\uD83D\uDC65',
    'volume': '\uD83D\uDD0A',
    'Wallet': '\uD83D\uDCB3',
    'warehouse': '\uD83C\uDFED',
    'Warehouse': '\uD83C\uDFED',
    'wrench': '\uD83D\uDD27',
    'x-circle': '❌',
    'XCircle': '❌',

    // Défaut
    'default': '❓'
};

// Fonction pour convertir kebab-case en PascalCase (ex: message-circle -> MessageCircle)
const toPascalCase = (str: string): string => {
    const { t } = useLanguageSafe();
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



