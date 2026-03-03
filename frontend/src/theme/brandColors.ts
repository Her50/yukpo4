/**
 * 🎨 Yukpo Brand Colors — Source unique de vérité (Frontend Web)
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

// Tailwind CSS classes correspondantes (approximation la plus proche)
export const BRAND_YUK_TW = 'text-blue-500';    // ~#3B82F6
export const BRAND_PO_TW = 'text-violet-600';   // ~#7C3AED

export const brandColors = {
    gradientStart: BRAND_GRADIENT_START,
    gradientMid: BRAND_GRADIENT_MID,
    gradientEnd: BRAND_GRADIENT_END,
    textPrimary: BRAND_TEXT_PRIMARY,
    textTagline: BRAND_TEXT_TAGLINE,
    yukColor: BRAND_YUK_COLOR,
    poColor: BRAND_PO_COLOR,
};

export default brandColors;
