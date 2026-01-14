// Composants de design natifs React Native
import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

// Carte native avec ombres
interface NativeCardProps {
    children: React.ReactNode;
    style?: any;
    onPress?: () => void;
    padding?: number;
}

export const NativeCard: React.FC<NativeCardProps> = ({
    children,
    style,
    onPress,
    padding = 16
}) => {
    const CardComponent = onPress ? TouchableOpacity : View;

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = (() => {
        // ✅ CRITIQUE: Gérer le cas où children est null/undefined
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Gérer les chaînes vides explicitement
        if (typeof children === 'string' && children === '') {
            return null;
        }

        // ✅ CRITIQUE: Si children est une primitive, la wrapper directement
        // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
        if (typeof children === 'boolean') {
            return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
        }
        if (typeof children === 'string' || typeof children === 'number') {
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
        if (Array.isArray(children)) {
            const safeArray = children
                .map((child, idx) => {
                    // ✅ CRITIQUE: Gérer les chaînes vides
                    if (typeof child === 'string' && child === '') {
                        return null;
                    }
                    // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
                    if (typeof child === 'boolean') {
                        return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
                    }
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={idx}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    if (React.isValidElement(child)) {
                        return child;
                    }
                    return <Text key={idx}>{String(child)}</Text>;
                })
                .filter(child => child != null); // Filtrer les null/undefined

            return safeArray.length > 0 ? safeArray : null;
        }

        // ✅ CRITIQUE: Fonction récursive pour traiter les enfants de manière sécurisée
        const processChild = (child: any, idx: number | string): React.ReactNode => {
            // Si c'est une chaîne vide, retourner null
            if (typeof child === 'string' && child === '') {
                return null;
            }
            // Si c'est une valeur primitive (string, number, boolean), l'envelopper dans un Text
            // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
            if (typeof child === 'boolean') {
                return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
            }
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={idx}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                const processed = child.map((item, itemIndex) => processChild(item, `${idx}-${itemIndex}`)).filter(item => item != null);
                return processed.length > 0 ? processed : null;
            }
            // ✅ CRITIQUE: Si c'est un Fragment React, traiter ses enfants
            if (React.isValidElement(child) && child.type === React.Fragment) {
                const fragmentChildren = React.Children.toArray(child.props.children);
                const processed = fragmentChildren
                    .map((item, itemIndex) => processChild(item, `${idx}-fragment-${itemIndex}`))
                    .filter(item => item != null);
                return processed.length > 0 ? processed : null;
            }
            
            // ✅ CRITIQUE: Si c'est un élément React valide, vérifier qu'il n'a pas de chaînes comme enfants directs
            if (React.isValidElement(child)) {
                // Si l'élément a des enfants, les traiter récursivement
                if (child.props && child.props.children != null) {
                    const processedChildren = processChild(child.props.children, `${idx}-children`);
                    // Cloner l'élément avec les enfants traités
                    return React.cloneElement(child, { key: idx }, processedChildren);
                }
                // Sinon, retourner l'élément tel quel
                return React.cloneElement(child, { key: idx });
            }
            // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
            return <Text key={idx}>{String(child)}</Text>;
        };

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        const mapped = React.Children.map(children, (child, idx) => processChild(child, idx));

        // ✅ CRITIQUE: Filtrer les null/undefined du résultat
        if (mapped == null) {
            return null;
        }

        const filtered = Array.isArray(mapped) ? mapped.filter(child => child != null) : (mapped != null ? [mapped] : []);
        return filtered.length > 0 ? filtered : null;
    })();

    return (
        <CardComponent
            style={[
                styles.card,
                { padding },
                style
            ]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
        >
            {safeChildren}
        </CardComponent>
    );
};

// Bouton natif moderne
interface NativeButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    style?: any;
    testID?: string;
}

export const NativeButton: React.FC<NativeButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    style,
    testID,
}) => {
    // ✅ SÉCURITÉ: S'assurer que title est toujours une string valide
    const safeTitle = typeof title === 'string' ? title : (title != null ? String(title) : '');

    const buttonStyle = [
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        disabled && styles.button_disabled,
        style
    ];

    const textStyle = [
        styles.buttonText,
        styles[`buttonText_${variant}`],
        styles[`buttonText_${size}`],
        disabled && styles.buttonText_disabled
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            testID={testID}
        >
            <Text style={textStyle}>{safeTitle}</Text>
        </TouchableOpacity>
    );
};

// Gradient natif (simulation avec des couleurs)
interface NativeGradientProps {
    colors: string[];
    children: React.ReactNode;
    style?: any;
}

export const NativeGradient: React.FC<NativeGradientProps> = ({
    colors,
    children,
    style
}) => {
    const backgroundColor = colors[0] || modernColors.primary;

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = (() => {
        // ✅ CRITIQUE: Gérer le cas où children est null/undefined
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Gérer les chaînes vides explicitement
        if (typeof children === 'string' && children === '') {
            return null;
        }

        // ✅ CRITIQUE: Si children est une primitive, la wrapper directement
        // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
        if (typeof children === 'boolean') {
            return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
        }
        if (typeof children === 'string' || typeof children === 'number') {
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
        if (Array.isArray(children)) {
            const safeArray = children
                .map((child, idx) => {
                    // ✅ CRITIQUE: Gérer les chaînes vides
                    if (typeof child === 'string' && child === '') {
                        return null;
                    }
                    // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
                    if (typeof child === 'boolean') {
                        return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
                    }
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={idx}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    if (React.isValidElement(child)) {
                        return child;
                    }
                    return <Text key={idx}>{String(child)}</Text>;
                })
                .filter(child => child != null); // Filtrer les null/undefined

            return safeArray.length > 0 ? safeArray : null;
        }

        // ✅ CRITIQUE: Fonction récursive pour traiter les enfants de manière sécurisée
        const processChild = (child: any, idx: number | string): React.ReactNode => {
            // Si c'est une chaîne vide, retourner null
            if (typeof child === 'string' && child === '') {
                return null;
            }
            // Si c'est une valeur primitive (string, number, boolean), l'envelopper dans un Text
            // ✅ CORRIGÉ: Ignorer les booléens false (ne pas les convertir en texte "false")
            if (typeof child === 'boolean') {
                return null; // ✅ Ignorer les booléens (false et true ne doivent pas être affichés)
            }
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={idx}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                const processed = child.map((item, itemIndex) => processChild(item, `${idx}-${itemIndex}`)).filter(item => item != null);
                return processed.length > 0 ? processed : null;
            }
            // ✅ CRITIQUE: Si c'est un Fragment React, traiter ses enfants
            if (React.isValidElement(child) && child.type === React.Fragment) {
                const fragmentChildren = React.Children.toArray(child.props.children);
                const processed = fragmentChildren
                    .map((item, itemIndex) => processChild(item, `${idx}-fragment-${itemIndex}`))
                    .filter(item => item != null);
                return processed.length > 0 ? processed : null;
            }
            
            // ✅ CRITIQUE: Si c'est un élément React valide, vérifier qu'il n'a pas de chaînes comme enfants directs
            if (React.isValidElement(child)) {
                // Si l'élément a des enfants, les traiter récursivement
                if (child.props && child.props.children != null) {
                    const processedChildren = processChild(child.props.children, `${idx}-children`);
                    // Cloner l'élément avec les enfants traités
                    return React.cloneElement(child, { key: idx }, processedChildren);
                }
                // Sinon, retourner l'élément tel quel
                return React.cloneElement(child, { key: idx });
            }
            // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
            return <Text key={idx}>{String(child)}</Text>;
        };

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        const mapped = React.Children.map(children, (child, idx) => processChild(child, idx));

        // ✅ CRITIQUE: Filtrer les null/undefined du résultat
        if (mapped == null) {
            return null;
        }

        const filtered = Array.isArray(mapped) ? mapped.filter(child => child != null) : (mapped != null ? [mapped] : []);
        return filtered.length > 0 ? filtered : null;
    })();

    return (
        <View style={[styles.gradient, { backgroundColor }, style]}>
            {safeChildren}
        </View>
    );
};

// Input natif
export interface NativeInputProps {
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    style?: any;
    inputStyle?: any;
    multiline?: boolean;
    keyboardType?: any; // ✅ Ajout pour supporter différents types de clavier
    autoCapitalize?: any; // ✅ Ajout pour contrôler la capitalisation
    autoCorrect?: boolean; // ✅ Ajout pour contrôler l'auto-correction
    autoFocus?: boolean; // ✅ NOUVEAU 2026-01-14: Support autoFocus
    editable?: boolean; // ✅ NOUVEAU 2026-01-14: Support editable
    minLines?: number;
    onContentSizeChange?: (width: number, height: number) => void;
    testID?: string;
}

export const NativeInput = React.forwardRef<any, NativeInputProps>(({
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    style,
    inputStyle,
    multiline,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    autoFocus = false, // ✅ NOUVEAU 2026-01-14: Support autoFocus
    editable = true, // ✅ NOUVEAU 2026-01-14: Support editable (par défaut true)
    minLines = 1,
    onContentSizeChange,
    testID
}, ref) => {
    const [inputHeight, setInputHeight] = React.useState<number | undefined>(undefined);

    React.useEffect(() => {
        if (!multiline) {
            return;
        }

        const textValue = typeof value === 'string' ? value : '';
        const baseLineHeight = 24;
        const linesFromBreaks = textValue.split(/\r?\n/).length;
        const approxLines = textValue.length > 0 ? Math.ceil(textValue.length / 60) : 0;
        // ✅ CORRECTION: Calculer plus de lignes pour permettre l'affichage complet du texte
        const estimatedLines = Math.max(minLines, linesFromBreaks, approxLines, 1);
        // ✅ CORRECTION: Ajouter plus de padding pour une meilleure visibilité
        const estimatedHeight = estimatedLines * baseLineHeight + 32;

        setInputHeight((prev) => {
            // ✅ CORRECTION: Mettre à jour la hauteur plus fréquemment pour s'adapter au contenu
            if (!prev || Math.abs(prev - estimatedHeight) > 4) {
                return estimatedHeight;
            }
            return prev;
        });
    }, [multiline, value, minLines]);

    const containerStyles = [
        styles.inputContainer,
        multiline && styles.inputContainerMultiline,
        multiline && inputHeight ? { minHeight: inputHeight } : null,
        style
    ];
    const inputStyles = [
        styles.input,
        multiline && styles.inputMultiline,
        multiline && inputHeight ? { height: inputHeight - 24 } : null,
        inputStyle
    ];

    return (
        <View style={containerStyles}>
            <TextInput
                ref={ref} // ✅ NOUVEAU 2026-01-14: Support ref pour forcer le focus
                testID={testID}
                style={inputStyles}
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                autoFocus={autoFocus} // ✅ NOUVEAU 2026-01-14: Support autoFocus
                editable={editable} // ✅ NOUVEAU 2026-01-14: Support editable
                placeholderTextColor={modernColors.textSecondary}
                scrollEnabled={multiline ? true : undefined} // ✅ CORRECTION: Activer le scroll pour multiline pour permettre de voir tout le texte
                blurOnSubmit={multiline ? false : undefined}
                returnKeyType={multiline ? 'default' : undefined}
                textBreakStrategy={multiline ? 'highQuality' : undefined}
                onContentSizeChange={(event) => {
                    if (multiline) {
                        const { width, height } = event.nativeEvent.contentSize;
                        const lineHeight = 24;
                        // ✅ CORRECTION: Calculer une hauteur minimale plus grande pour permettre l'affichage complet
                        const minHeight = Math.max(minLines * lineHeight + 32, height + 32);
                        setInputHeight(minHeight);
                        onContentSizeChange?.(width, height);
                    }
                }}
            />
        </View>
    );
});

// ✅ NOUVEAU 2026-01-14: Ajouter displayName pour le forwardRef
NativeInput.displayName = 'NativeInput';

// Badge natif
interface NativeBadgeProps {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    size?: 'small' | 'medium';
}

export const NativeBadge: React.FC<NativeBadgeProps> = ({
    text,
    variant = 'neutral',
    size = 'medium'
}) => {
    return (
        <View style={[
            styles.badge,
            styles[`badge_${variant}`],
            styles[`badge_${size}`]
        ]}>
            <Text style={[
                styles.badgeText,
                styles[`badgeText_${variant}`],
                styles[`badgeText_${size}`]
            ]}>
                {text}
            </Text>
        </View>
    );
};

// Divider natif
export const NativeDivider: React.FC<{ style?: any }> = ({ style }) => {
    return <View style={[styles.divider, style]} />;
};

const styles = StyleSheet.create({
    // Card
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: modernStyles.borderRadius.lg,
        ...modernStyles.shadowMedium,
        marginVertical: 4,
        marginHorizontal: 2,
    },

    // Button
    button: {
        borderRadius: modernStyles.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    button_primary: {
        backgroundColor: modernColors.primary,
    },
    button_secondary: {
        backgroundColor: modernColors.secondary,
    },
    button_outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    button_ghost: {
        backgroundColor: 'transparent',
    },
    button_small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 32,
    },
    button_medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
    },
    button_large: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        minHeight: 52,
    },
    button_disabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    buttonText_primary: {
        color: '#FFFFFF',
    },
    buttonText_secondary: {
        color: '#FFFFFF',
    },
    buttonText_outline: {
        color: modernColors.primary,
    },
    buttonText_ghost: {
        color: modernColors.primary,
    },
    buttonText_small: {
        fontSize: 14,
    },
    buttonText_medium: {
        fontSize: 16,
    },
    buttonText_large: {
        fontSize: 18,
    },
    buttonText_disabled: {
        opacity: 0.7,
    },

    // Gradient
    gradient: {
        borderRadius: modernStyles.borderRadius.lg,
    },

    // Input
    inputContainer: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        backgroundColor: modernColors.surface,
        paddingHorizontal: 12,
        paddingVertical: 12,
        width: '100%',
    },
    input: {
        fontSize: 16,
        color: modernColors.text,
        minHeight: 20,
        flex: 1,
        width: '100%',
    },
    inputContainerMultiline: {
        minHeight: 160,
        paddingVertical: 16,
    },
    inputMultiline: {
        minHeight: 120,
        textAlignVertical: 'top',
        includeFontPadding: false, // ✅ CORRECTION: Éviter le padding supplémentaire qui peut masquer le texte
    },

    // Badge
    badge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    badge_success: {
        backgroundColor: modernColors.success + '20',
    },
    badge_warning: {
        backgroundColor: modernColors.warning + '20',
    },
    badge_error: {
        backgroundColor: modernColors.error + '20',
    },
    badge_info: {
        backgroundColor: modernColors.info + '20',
    },
    badge_neutral: {
        backgroundColor: modernColors.textSecondary + '20',
    },
    badge_small: {
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badge_medium: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    badgeText_success: {
        color: modernColors.success,
    },
    badgeText_warning: {
        color: modernColors.warning,
    },
    badgeText_error: {
        color: modernColors.error,
    },
    badgeText_info: {
        color: modernColors.info,
    },
    badgeText_neutral: {
        color: modernColors.textSecondary,
    },
    badgeText_small: {
        fontSize: 12,
    },
    badgeText_medium: {
        fontSize: 14,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 8,
    },
});

export default {
    NativeCard,
    NativeButton,
    NativeGradient,
    NativeInput,
    NativeBadge,
    NativeDivider,
};
