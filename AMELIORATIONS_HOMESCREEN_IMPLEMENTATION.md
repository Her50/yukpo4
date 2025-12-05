# Implémentation des Améliorations HomeScreen
## Guide pratique avec exemples de code

---

## 🎯 PHASE 1: DESIGN VISUEL MODERNE

### 1.1 Header Animé Premium

#### Problème actuel:
- Header collapse basique
- Pas d'animations fluides
- Manque de micro-interactions

#### Solution: Header avec animations Reanimated 3

```typescript
// mobile/src/components/HomeHeaderPremium.tsx
import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { modernColors } from '../theme/modernTheme';

interface HomeHeaderPremiumProps {
    scrollY: Animated.Value;
    user?: any;
    unreadNotificationsCount: number;
    unreadChatCount?: number;
    selectedLocation: { lat: number; lng: number } | null;
    onDeliveryPress: () => void;
    onChatPress: () => void;
    onNotificationPress: () => void;
    navigation: any;
    language: string;
    onLanguageChange: (lang: string) => void;
}

export const HomeHeaderPremium: React.FC<HomeHeaderPremiumProps> = ({
    scrollY,
    user,
    unreadNotificationsCount,
    unreadChatCount = 0,
    selectedLocation,
    onDeliveryPress,
    onChatPress,
    onNotificationPress,
    navigation,
    language,
    onLanguageChange,
}) => {
    // ✅ NOUVEAU: Animations avec Reanimated 3
    const headerHeight = useSharedValue(80);
    const headerOpacity = useSharedValue(1);
    const badgeScale = useSharedValue(1);
    const gradientOffset = useSharedValue(0);

    // ✅ Animation de collapse au scroll
    useEffect(() => {
        const listener = scrollY.addListener(({ value }) => {
            const scrollThreshold = 100;
            const scrollProgress = Math.min(value / scrollThreshold, 1);
            
            // Animation spring pour hauteur
            headerHeight.value = withSpring(
                80 - (scrollProgress * 30),
                { damping: 15, stiffness: 150 }
            );
            
            // Animation opacity
            headerOpacity.value = withTiming(
                Math.max(0.7, 1 - scrollProgress * 0.3),
                { duration: 200 }
            );
        });

        return () => scrollY.removeListener(listener);
    }, [scrollY]);

    // ✅ Animation gradient en continu
    useEffect(() => {
        const interval = setInterval(() => {
            gradientOffset.value = withTiming(
                gradientOffset.value + 0.1,
                { duration: 3000 }
            );
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // ✅ Styles animés
    const animatedHeaderStyle = useAnimatedStyle(() => ({
        height: headerHeight.value,
        opacity: headerOpacity.value,
    }));

    const animatedGradientStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: gradientOffset.value * 100 }],
    }));

    // ✅ Animation badge au changement
    useEffect(() => {
        if (unreadNotificationsCount > 0 || unreadChatCount > 0) {
            badgeScale.value = withSpring(1.2, { damping: 8 }, () => {
                badgeScale.value = withSpring(1, { damping: 8 });
            });
        }
    }, [unreadNotificationsCount, unreadChatCount]);

    const animatedBadgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    return (
        <Animated.View style={[styles.header, animatedHeaderStyle]}>
            {/* ✅ Gradient animé en arrière-plan */}
            <LinearGradient
                colors={['#667eea', '#764ba2', '#f093fb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            
            {/* ✅ Blur effect (glassmorphism) */}
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            
            <View style={styles.headerContent}>
                <View style={styles.headerRow}>
                    {/* Colonne gauche */}
                    <View style={styles.headerLeft}>
                        <UserAvatarMenu
                            onNavigate={(route) => navigation.navigate(route)}
                            balance={user?.credits || 0}
                            weatherLocation={selectedLocation}
                        />
                        <LanguageSelector
                            selectedLanguage={language}
                            onLanguageChange={onLanguageChange}
                            compact={true}
                        />
                    </View>

                    {/* Titre centré avec animation */}
                    <Animated.View style={styles.brandTitleContainer}>
                        <Text style={styles.brandTitleCompact}>
                            <Text style={styles.brandYuk}>Yuk</Text>
                            <Text style={styles.brandPo}>po</Text>
                        </Text>
                    </Animated.View>

                    {/* Actions avec badges animés */}
                    <View style={styles.headerActionsCompact}>
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={onDeliveryPress}
                        >
                            <SafeIcon name="package" size={18} color="#fff" type="lucide" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={onChatPress}
                        >
                            <Text style={styles.headerButtonIconCompact}>💬</Text>
                            {unreadChatCount > 0 && (
                                <Animated.View style={[styles.chatBadgeCompact, animatedBadgeStyle]}>
                                    <Text style={styles.chatBadgeText}>
                                        {unreadChatCount < 10 ? unreadChatCount : '9+'}
                                    </Text>
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.headerButtonCompact}
                            onPress={onNotificationPress}
                        >
                            <Text style={styles.headerButtonIconCompact}>🔔</Text>
                            {unreadNotificationsCount > 0 && (
                                <Animated.View style={[styles.notificationBadgeCompact, animatedBadgeStyle]}>
                                    {unreadNotificationsCount < 10 && (
                                        <Text style={styles.notificationBadgeText}>
                                            {unreadNotificationsCount}
                                        </Text>
                                    )}
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    header: {
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
        overflow: 'hidden',
    },
    headerContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: '35%',
        flexShrink: 1,
        gap: 6,
    },
    brandTitleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    brandTitleCompact: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    brandYuk: {
        color: '#EAB308',
    },
    brandPo: {
        color: '#DC2626',
    },
    headerActionsCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        maxWidth: '35%',
        flexShrink: 1,
    },
    headerButtonCompact: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    headerButtonIconCompact: {
        fontSize: 18,
    },
    notificationBadgeCompact: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    chatBadgeCompact: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    chatBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
```

---

### 1.2 Cards Produits Premium avec Glassmorphism

#### Problème actuel:
- Cards basiques
- Pas de profondeur visuelle
- Animations limitées

#### Solution: ProductCard Premium

```typescript
// mobile/src/components/ProductCardPremium.tsx
import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

interface ProductCardPremiumProps {
    product: any;
    service: any;
    onPress?: () => void;
    index?: number;
}

export const ProductCardPremium: React.FC<ProductCardPremiumProps> = ({
    product,
    service,
    onPress,
    index = 0,
}) => {
    // ✅ Animations d'entrée
    const scale = useSharedValue(0.9);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    React.useEffect(() => {
        // Animation d'entrée avec délai selon index
        const delay = index * 100;
        setTimeout(() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            opacity.value = withTiming(1, { duration: 300 });
            translateY.value = withSpring(0, { damping: 12 });
        }, delay);
    }, []);

    // ✅ Animation au press
    const pressScale = useSharedValue(1);
    const pressGesture = Gesture.Tap()
        .onBegin(() => {
            pressScale.value = withSpring(0.95, { damping: 15 });
        })
        .onFinalize(() => {
            pressScale.value = withSpring(1, { damping: 15 });
            onPress?.();
        });

    // ✅ Styles animés
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value * pressScale.value },
            { translateY: translateY.value },
        ],
        opacity: opacity.value,
    }));

    const shadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(
            pressScale.value,
            [0.95, 1],
            [0.3, 0.15]
        ),
        shadowRadius: interpolate(
            pressScale.value,
            [0.95, 1],
            [12, 8]
        ),
    }));

    return (
        <GestureDetector gesture={pressGesture}>
            <Animated.View style={[styles.card, animatedStyle, shadowStyle]}>
                {/* ✅ Glassmorphism container */}
                <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </BlurView>

                {/* ✅ Contenu */}
                <View style={styles.content}>
                    {/* Badge "Nouveau" animé */}
                    {isNew && (
                        <Animated.View style={styles.newBadge}>
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.badgeGradient}
                            >
                                <Text style={styles.newBadgeText}>✨ Nouveau</Text>
                            </LinearGradient>
                        </Animated.View>
                    )}

                    {/* Image produit avec lazy loading */}
                    <OptimizedImage
                        source={{ uri: product.images?.[0] }}
                        style={styles.image}
                        resizeMode="cover"
                    />

                    {/* Info produit */}
                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={2}>
                            {product.nom}
                        </Text>
                        <Text style={styles.price}>
                            {formatPrice(product.prix)} {product.devise}
                        </Text>
                        <Text style={styles.description} numberOfLines={2}>
                            {product.description}
                        </Text>
                    </View>

                    {/* Actions rapides */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionButton}>
                            <SafeIcon name="heart" size={20} color="#EF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                            <SafeIcon name="share-2" size={20} color="#6366F1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                            <SafeIcon name="message-circle" size={20} color="#10B981" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    card: {
        width: '100%',
        height: 400,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    newBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        borderRadius: 16,
        overflow: 'hidden',
    },
    badgeGradient: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    newBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        marginBottom: 12,
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
    },
    price: {
        fontSize: 20,
        fontWeight: '800',
        color: '#6366F1',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
    },
    actionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
```

---

### 1.3 Skeleton Loaders Premium

```typescript
// mobile/src/components/SkeletonLoaderPremium.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonLoaderPremiumProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    variant?: 'card' | 'text' | 'image' | 'avatar';
}

export const SkeletonLoaderPremium: React.FC<SkeletonLoaderPremiumProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    variant = 'text',
}) => {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            shimmer.value,
            [0, 1],
            [-200, 200]
        );
        return {
            transform: [{ translateX }],
        };
    });

    const getDimensions = () => {
        switch (variant) {
            case 'card':
                return { width: '100%', height: 400, borderRadius: 24 };
            case 'image':
                return { width: '100%', height: 200, borderRadius: 16 };
            case 'avatar':
                return { width: 50, height: 50, borderRadius: 25 };
            default:
                return { width, height, borderRadius };
        }
    };

    const dimensions = getDimensions();

    return (
        <View style={[styles.container, dimensions]}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
    },
});
```

---

## 🚀 PHASE 2: FLUIDITÉ & PERFORMANCE

### 2.1 FlatList Ultra-Optimisée

```typescript
// mobile/src/components/OptimizedFlatList.tsx
import React, { useCallback, useMemo } from 'react';
import { FlatList, FlatListProps } from 'react-native';
import { useWindowDimensions } from 'react-native';

interface OptimizedFlatListProps<T> extends Omit<FlatListProps<T>, 'getItemLayout'> {
    itemHeight?: number;
}

export function OptimizedFlatList<T>({
    itemHeight = 400,
    ...props
}: OptimizedFlatListProps<T>) {
    const { height: screenHeight } = useWindowDimensions();

    // ✅ Calculer getItemLayout pour performance optimale
    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
        }),
        [itemHeight]
    );

    // ✅ Optimisations de performance
    const optimizedProps = useMemo(
        () => ({
            ...props,
            getItemLayout,
            removeClippedSubviews: true,
            maxToRenderPerBatch: 5,
            windowSize: 3,
            initialNumToRender: 3,
            updateCellsBatchingPeriod: 50,
            scrollEventThrottle: 16,
            decelerationRate: 'fast',
        }),
        [props, getItemLayout]
    );

    return <FlatList {...optimizedProps} />;
}
```

---

### 2.2 Image Optimization avec Lazy Loading

```typescript
// mobile/src/components/OptimizedImage.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Image, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface OptimizedImageProps {
    source: { uri: string };
    style?: any;
    resizeMode?: 'cover' | 'contain' | 'stretch';
    placeholder?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    source,
    style,
    resizeMode = 'cover',
    placeholder,
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const opacity = useSharedValue(0);

    const handleLoad = () => {
        setLoading(false);
        opacity.value = withTiming(1, { duration: 300 });
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={[styles.container, style]}>
            {/* Placeholder avec blur */}
            {loading && (
                <BlurView intensity={20} style={StyleSheet.absoluteFill}>
                    <View style={styles.placeholder}>
                        <ActivityIndicator size="large" color="#6366F1" />
                    </View>
                </BlurView>
            )}

            {/* Image avec fade-in */}
            <Animated.Image
                source={source}
                style={[style, animatedStyle]}
                resizeMode={resizeMode}
                onLoad={handleLoad}
                onError={handleError}
            />

            {/* Error state */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Image non disponible</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
    },
    errorText: {
        color: '#64748B',
        fontSize: 14,
    },
});
```

---

## 📱 PHASE 3: MICRO-INTERACTIONS

### 3.1 RippleButton Premium

```typescript
// mobile/src/components/RippleButtonPremium.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { triggerHaptic } from '../utils/hapticFeedback';

interface RippleButtonPremiumProps {
    title: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    onPress: () => void;
    disabled?: boolean;
}

export const RippleButtonPremium: React.FC<RippleButtonPremiumProps> = ({
    title,
    icon,
    variant = 'primary',
    onPress,
    disabled = false,
}) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const pressGesture = Gesture.Tap()
        .enabled(!disabled)
        .onBegin(() => {
            triggerHaptic('light');
            scale.value = withSpring(0.95, { damping: 15 });
            opacity.value = withTiming(0.8, { duration: 100 });
        })
        .onFinalize(() => {
            scale.value = withSpring(1, { damping: 15 });
            opacity.value = withTiming(1, { duration: 100 });
            if (!disabled) {
                onPress();
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    background: (
                        <LinearGradient
                            colors={['#667eea', '#764ba2']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    ),
                    textColor: '#FFFFFF',
                };
            case 'secondary':
                return {
                    background: (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F3F4F6' }]} />
                    ),
                    textColor: '#1E293B',
                };
            default:
                return {
                    background: (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#667eea' }]} />
                    ),
                    textColor: '#667eea',
                };
        }
    };

    const variantStyles = getVariantStyles();

    return (
        <GestureDetector gesture={pressGesture}>
            <Animated.View style={[styles.button, animatedStyle, disabled && styles.disabled]}>
                {variantStyles.background}
                <View style={styles.content}>
                    {icon && <Text style={styles.icon}>{icon}</Text>}
                    <Text style={[styles.title, { color: variantStyles.textColor }]}>
                        {title}
                    </Text>
                </View>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    icon: {
        fontSize: 18,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    disabled: {
        opacity: 0.5,
    },
});
```

---

## 🎨 PHASE 4: TRANSITIONS ÉCRAN

### 4.1 Shared Element Transitions

```typescript
// mobile/src/components/SharedElementTransition.tsx
import React from 'react';
import { createSharedElementStackNavigator } from 'react-navigation-shared-element';
import { Easing } from 'react-native-reanimated';

const Stack = createSharedElementStackNavigator();

export const SharedElementNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                transitionSpec: {
                    open: {
                        animation: 'timing',
                        config: {
                            duration: 300,
                            easing: Easing.inOut(Easing.ease),
                        },
                    },
                    close: {
                        animation: 'timing',
                        config: {
                            duration: 300,
                            easing: Easing.inOut(Easing.ease),
                        },
                    },
                },
                cardStyleInterpolator: ({ current, next, layouts }) => {
                    return {
                        cardStyle: {
                            transform: [
                                {
                                    translateX: current.progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [layouts.screen.width, 0],
                                    }),
                                },
                            ],
                        },
                    };
                },
            }}
        >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
                name="ProductDetail"
                component={ProductDetailScreen}
                sharedElements={(route) => {
                    const { productId } = route.params;
                    return [`product.${productId}.image`, `product.${productId}.title`];
                }}
            />
        </Stack.Navigator>
    );
};
```

---

## 📊 MÉTRIQUES & MONITORING

### Performance Monitoring

```typescript
// mobile/src/utils/performanceMonitor.ts
import { InteractionManager } from 'react-native';

export class PerformanceMonitor {
    private static frameCount = 0;
    private static lastTime = Date.now();
    private static fps = 60;

    static startMonitoring() {
        const monitor = () => {
            this.frameCount++;
            const now = Date.now();
            const delta = now - this.lastTime;

            if (delta >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / delta);
                this.frameCount = 0;
                this.lastTime = now;

                // Log si FPS < 55 (problème de performance)
                if (this.fps < 55) {
                    console.warn(`[Performance] FPS bas: ${this.fps}`);
                }
            }

            requestAnimationFrame(monitor);
        };

        monitor();
    }

    static getFPS(): number {
        return this.fps;
    }
}
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Quick Wins (Semaine 1)
- [ ] Header Premium avec animations
- [ ] Cards produits avec glassmorphism
- [ ] Skeleton loaders premium
- [ ] RippleButton premium
- [ ] Optimisations FlatList

### Phase 1 (Semaine 2-3)
- [ ] Design system complet
- [ ] Animations Reanimated 3 partout
- [ ] Micro-interactions sur tous les éléments
- [ ] Transitions écran fluides

### Phase 2 (Semaine 4-5)
- [ ] Image optimization
- [ ] Lazy loading avancé
- [ ] Performance monitoring
- [ ] Caching intelligent

### Phase 3 (Semaine 6+)
- [ ] Personnalisation IA
- [ ] Gamification
- [ ] Social features avancées
- [ ] Analytics & A/B testing

---

**Note**: Ces améliorations doivent être implémentées progressivement avec tests utilisateurs à chaque étape.

