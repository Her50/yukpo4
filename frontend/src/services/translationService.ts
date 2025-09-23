// Service de traduction automatique pour Yukpo
export interface TranslationResult {
    translatedText: string;
    detectedLanguage: string;
    confidence: number;
}

export class TranslationService {
    private static instance: TranslationService;
    private apiKey: string;
    private baseUrl = 'https://translation.googleapis.com/language/translate/v2';

    private constructor() {
        this.apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY || '';
    }

    public static getInstance(): TranslationService {
        if (!TranslationService.instance) {
            TranslationService.instance = new TranslationService();
        }
        return TranslationService.instance;
    }

    /**
     * Traduit un texte vers une langue cible
     */
    async translateText(
        text: string,
        targetLanguage: string,
        sourceLanguage?: string
    ): Promise<TranslationResult> {
        if (!this.apiKey) {
            console.warn('Clé API Google Translate non configurée');
            return {
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: targetLanguage,
                    source: sourceLanguage,
                    format: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur API Google Translate: ${response.status}`);
            }

            const data = await response.json();
            const translation = data.data.translations[0];

            return {
                translatedText: translation.translatedText,
                detectedLanguage: translation.detectedSourceLanguage,
                confidence: 1.0
            };
        } catch (error) {
            console.error('Erreur traduction:', error);
            return {
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            };
        }
    }

    /**
     * Traduit automatiquement tous les textes de la page
     */
    async translatePage(targetLanguage: string): Promise<void> {
        const textNodes = this.getTextNodes(document.body);

        for (const node of textNodes) {
            if (node.textContent && node.textContent.trim().length > 0) {
                try {
                    const result = await this.translateText(node.textContent, targetLanguage);
                    if (result.confidence > 0.5) {
                        node.textContent = result.translatedText;
                    }
                } catch (error) {
                    console.error('Erreur traduction nœud:', error);
                }
            }
        }
    }

    /**
     * Récupère tous les nœuds de texte d'un élément
     */
    private getTextNodes(element: Node): Text[] {
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Ignorer les scripts, styles, et autres éléments non traduisibles
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tagName = parent.tagName.toLowerCase();
                    if (['script', 'style', 'code', 'pre'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Ignorer les nœuds vides ou avec seulement des espaces
                    if (!node.textContent || !node.textContent.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node as Text);
        }

        return textNodes;
    }

    /**
     * Traduit les attributs alt, title, placeholder, etc.
     */
    async translateAttributes(targetLanguage: string): Promise<void> {
        const elements = document.querySelectorAll('[alt], [title], [placeholder]');

        for (const element of elements) {
            const attributes = ['alt', 'title', 'placeholder'];

            for (const attr of attributes) {
                const value = element.getAttribute(attr);
                if (value && value.trim().length > 0) {
                    try {
                        const result = await this.translateText(value, targetLanguage);
                        if (result.confidence > 0.5) {
                            element.setAttribute(attr, result.translatedText);
                        }
                    } catch (error) {
                        console.error('Erreur traduction attribut:', error);
                    }
                }
            }
        }
    }

    /**
     * Traduit complètement la page
     */
    async translateFullPage(targetLanguage: string): Promise<void> {
        console.log(`Traduction de la page vers ${targetLanguage}...`);

        // Traduire les textes
        await this.translatePage(targetLanguage);

        // Traduire les attributs
        await this.translateAttributes(targetLanguage);

        console.log('Traduction terminée');
    }
}

export default TranslationService;
