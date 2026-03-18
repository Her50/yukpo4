/**
 * \uD83C\uDFA8 Yukpo Brand Colors — Source unique de vérité
 * 
 * Extraites du logo officiel (adaptive-icon.png):
 * - Monogramme "YP" en style circuit-board
 * - Gradient: Bleu (#3B82F6) → Violet (#7C3AED)
 * - Texte "YUKPO": Violet foncé (#4A1D96), bold uppercase
 * - Tagline "CONNECT. CREATE. SOLVE": Gris-violet clair
 * - Fond: Blanc
 */

// Couleurs du gradient du monogramme YP (gauche → droite)
export const BRAND_GRADIENT_START = '#3B82F6'; // Bleu (côté Y)
export const BRAND_GRADIENT_MID = '#6366F1';   // Indigo (milieu)
export const BRAND_GRADIENT_END = '#7C3AED';   // Violet (côté P)

// Couleurs du texte "YUKPO" sous le monogramme
export const BRAND_TEXT_PRIMARY = '#4A1D96';    // Violet foncé (texte principal)
export const BRAND_TEXT_TAGLINE = '#6B7280';    // Gris (tagline "CONNECT. CREATE. SOLVE")

// Couleurs par segment du texte "Yukpo" (pour effet gradient textuel)
export const BRAND_YUK_COLOR = '#3B82F6';       // Bleu (cohérent avec le côté Y du logo)
export const BRAND_PO_COLOR = '#7C3AED';        // Violet (cohérent avec le côté P du logo)

// Gradient complet pour LinearGradient
export const BRAND_GRADIENT = [BRAND_GRADIENT_START, BRAND_GRADIENT_MID, BRAND_GRADIENT_END] as const;
export const BRAND_GRADIENT_SIMPLE = [BRAND_GRADIENT_START, BRAND_GRADIENT_END] as const;

// Couleurs alternatives pour fonds colorés
export const BRAND_ON_DARK_PRIMARY = '#FFFFFF';
export const BRAND_ON_DARK_SECONDARY = 'rgba(255, 255, 255, 0.8)';

// Export groupé
export const brandColors = {
    gradientStart: BRAND_GRADIENT_START,
    gradientMid: BRAND_GRADIENT_MID,
    gradientEnd: BRAND_GRADIENT_END,
    textPrimary: BRAND_TEXT_PRIMARY,
    textTagline: BRAND_TEXT_TAGLINE,
    yukColor: BRAND_YUK_COLOR,
    poColor: BRAND_PO_COLOR,
    gradient: BRAND_GRADIENT,
    gradientSimple: BRAND_GRADIENT_SIMPLE,
};

export default brandColors;
