export type TemplateTheme = {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
};

export interface TemplateProduct {
    id: string;
    title: string;
    price?: string;
    promotion?: string;
    imageUrl?: string;
    description?: string;
}

export interface IntroPulseProps {
    headline: string;
    subheadline?: string;
    theme?: TemplateTheme;
    backgroundMediaUrl?: string;
    durationSeconds?: number;
}

export interface ProductShowcaseProps {
    products: TemplateProduct[];
    theme?: TemplateTheme;
    showPrice?: boolean;
    highlightPromotion?: boolean;
    durationSeconds?: number;
}

export interface ARHighlightProps {
    title: string;
    bulletPoints: string[];
    icon?: string;
    theme?: TemplateTheme;
    durationSeconds?: number;
}

export interface GlowCTAProps {
    title: string;
    buttonLabel: string;
    url?: string;
    theme?: TemplateTheme;
    durationSeconds?: number;
}

export const defaultTheme: TemplateTheme = {
    primary: '#6366F1',
    secondary: '#14B8A6',
    accent: '#F97316',
    background: '#0F172A',
    text: '#F8FAFC',
};


