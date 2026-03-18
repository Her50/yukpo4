/**
 * Composant de preview de l'icône Yukpo avec motif Ndop
 * À utiliser pour visualiser l'icône avant génération finale
 */
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, {
    Circle,
    Defs,
    FeComponentTransfer,
    FeGaussianBlur,
    FeMerge,
    FeMergeNode,
    FeOffset,
    Filter,
    G,
    Line,
    Path,
    Pattern,
    Rect,
    Stop,
    LinearGradient as SvgLinearGradient
} from 'react-native-svg';

const { width } = Dimensions.get('window');

interface IconPreviewProps {
    size?: number;
    showLabel?: boolean;
}

const IconPreview: React.FC<IconPreviewProps> = ({
    size = 200,
    showLabel = true
}) => {
    return (
        <View style={styles.container}>
            {showLabel && (
                <Text style={styles.title}>Icône Yukpo - Motif Ndop</Text>
            )}

            <View style={[styles.iconContainer, { width: size, height: size }]}>
                <Svg width={size} height={size} viewBox="0 0 1024 1024">
                    <Defs>
                        {/* Gradient de fond */}
                        <SvgLinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#0F172A" stopOpacity="1" />
                            <Stop offset="50%" stopColor="#1E293B" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#0F172A" stopOpacity="1" />
                        </SvgLinearGradient>

                        {/* Gradient pour le Y */}
                        <SvgLinearGradient id="yGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#F7971E" stopOpacity="1" />
                            <Stop offset="50%" stopColor="#FFD200" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#6366F1" stopOpacity="1" />
                        </SvgLinearGradient>

                        {/* Motif Ndop - Losanges (COULEURS TRADITIONNELLES : INDIGO/BLEU FONCÉ) */}
                        <Pattern id="ndop" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                            <Path
                                d="M 40 0 L 80 40 L 40 80 L 0 40 Z"
                                fill="none"
                                stroke="#1A1D5A"
                                strokeWidth="4"
                                opacity="0.9"
                            />
                            <Path
                                d="M 40 20 L 60 40 L 40 60 L 20 40 Z"
                                fill="none"
                                stroke="#334155"
                                strokeWidth="3.5"
                                opacity="0.85"
                            />
                            <Line x1="0" y1="0" x2="80" y2="80" stroke="#1A1D5A" strokeWidth="3.5" opacity="0.8" />
                            <Line x1="80" y1="0" x2="0" y2="80" stroke="#1A1D5A" strokeWidth="3.5" opacity="0.8" />
                            <Line x1="20" y1="0" x2="60" y2="80" stroke="#334155" strokeWidth="2.5" opacity="0.7" />
                            <Line x1="60" y1="0" x2="20" y2="80" stroke="#334155" strokeWidth="2.5" opacity="0.7" />
                            <Circle cx="40" cy="40" r="4" fill="#F8F9FA" opacity="0.9" />
                            <Circle cx="20" cy="20" r="3" fill="#E2E8F0" opacity="0.8" />
                            <Circle cx="60" cy="60" r="3" fill="#E2E8F0" opacity="0.8" />
                            <Circle cx="20" cy="60" r="2.5" fill="#CBD5E1" opacity="0.75" />
                            <Circle cx="60" cy="20" r="2.5" fill="#CBD5E1" opacity="0.75" />
                        </Pattern>

                        {/* Ombre */}
                        <Filter id="shadow">
                            <FeGaussianBlur in="SourceAlpha" stdDeviation="8" />
                            <FeOffset dx="0" dy="8" result="offsetblur" />
                            <FeComponentTransfer>
                                <feFuncA type="linear" slope="0.3" />
                            </FeComponentTransfer>
                            <FeMerge>
                                <FeMergeNode />
                                <FeMergeNode in="SourceGraphic" />
                            </FeMerge>
                        </Filter>
                    </Defs>

                    {/* Fond avec gradient */}
                    <Rect width="1024" height="1024" fill="url(#bgGrad)" rx="180" />

                    {/* Motif Ndop */}
                    <Rect width="1024" height="1024" fill="url(#ndop)" rx="180" />

                    {/* Cercle central très subtil (opacité réduite pour laisser voir le ndop) */}
                    <Circle cx="512" cy="512" r="380" fill="#1E293B" opacity="0.08" />
                    <Circle cx="512" cy="512" r="380" fill="none" stroke="url(#yGrad)" strokeWidth="2" opacity="0.2" />

                    {/* Lettre Y */}
                    <G filter="url(#shadow)">
                        {/* Branche gauche */}
                        <Path
                            d="M 280 280 L 512 520 L 480 550 L 248 310 Z"
                            fill="url(#yGrad)"
                            stroke="url(#yGrad)"
                            strokeWidth="4"
                        />

                        {/* Branche droite */}
                        <Path
                            d="M 744 280 L 512 520 L 544 550 L 776 310 Z"
                            fill="url(#yGrad)"
                            stroke="url(#yGrad)"
                            strokeWidth="4"
                        />

                        {/* Tige centrale */}
                        <Path
                            d="M 480 520 L 544 520 L 544 780 L 480 780 Z"
                            fill="url(#yGrad)"
                            stroke="url(#yGrad)"
                            strokeWidth="4"
                        />
                    </G>

                    {/* Symbole araignée (sagesse Bamiléké) */}
                    <G opacity="0.3">
                        <Circle cx="512" cy="920" r="8" fill="#FFD200" />
                        <Line x1="512" y1="920" x2="490" y2="940" stroke="#FFD200" strokeWidth="2" />
                        <Line x1="512" y1="920" x2="534" y2="940" stroke="#FFD200" strokeWidth="2" />
                        <Line x1="512" y1="920" x2="490" y2="900" stroke="#FFD200" strokeWidth="2" />
                        <Line x1="512" y1="920" x2="534" y2="900" stroke="#FFD200" strokeWidth="2" />
                    </G>
                </Svg>
            </View>

            {showLabel && (
                <View style={styles.infoContainer}>
                    <Text style={styles.subtitle}>\uD83C\uDFA8 Design Professionnel</Text>
                    <Text style={styles.description}>
                        Motif Ndop Bamiléké traditionnel avec le "Y" moderne de Yukpo
                    </Text>
                    <View style={styles.colorRow}>
                        <View style={styles.colorBlock}>
                            <View style={[styles.colorSwatch, { backgroundColor: '#F7971E' }]} />
                            <Text style={styles.colorLabel}>Orange</Text>
                        </View>
                        <View style={styles.colorBlock}>
                            <View style={[styles.colorSwatch, { backgroundColor: '#FFD200' }]} />
                            <Text style={styles.colorLabel}>Jaune</Text>
                        </View>
                        <View style={styles.colorBlock}>
                            <View style={[styles.colorSwatch, { backgroundColor: '#6366F1' }]} />
                            <Text style={styles.colorLabel}>Violet</Text>
                        </View>
                        <View style={styles.colorBlock}>
                            <View style={[styles.colorSwatch, { backgroundColor: '#0F172A' }]} />
                            <Text style={styles.colorLabel}>Bleu Marine</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F8FAFC',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 20,
        textAlign: 'center',
    },
    iconContainer: {
        borderRadius: 30,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        marginBottom: 20,
    },
    infoContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 16,
        maxWidth: 300,
        lineHeight: 20,
    },
    colorRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    colorBlock: {
        alignItems: 'center',
    },
    colorSwatch: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginBottom: 4,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    colorLabel: {
        fontSize: 11,
        color: '#64748B',
    },
});

export default IconPreview;




