/**
 * Générateur de PDF pour les recettes
 * Génère un PDF professionnel de la recette avec signature Yukpo
 */

import { GeneratedRecipe } from '../services/menuPlanningService';

export interface RecipePdfData {
    recipe: GeneratedRecipe;
    currency?: string;
}

/**
 * Génère le HTML de la recette pour conversion en PDF
 */
export async function generateRecipeHTML(recipeData: RecipePdfData): Promise<string> {
    const now = new Date().toLocaleString('fr-FR');
    const currency = recipeData.currency || 'FCFA';
    const { recipe } = recipeData;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recette - ${recipe.recipe_name} - Yukpo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background: #F9FAFB;
            padding: 20px;
        }
        .recipe-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .recipe-header {
            background: linear-gradient(135deg, #F59E0B 0%, #F97316 100%);
            padding: 40px;
            color: white;
            text-align: center;
        }
        .recipe-title {
            font-size: 36px;
            font-weight: 900;
            margin-bottom: 10px;
        }
        .recipe-subtitle {
            font-size: 18px;
            opacity: 0.95;
            margin-bottom: 20px;
        }
        .recipe-body {
            padding: 30px;
        }
        .recipe-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: #F9FAFB;
            border-radius: 12px;
        }
        .info-item {
            text-align: center;
        }
        .info-label {
            font-size: 12px;
            color: #6B7280;
            margin-bottom: 5px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .info-value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
        }
        .recipe-section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #E5E7EB;
        }
        .description-text {
            font-size: 16px;
            line-height: 1.6;
            color: #374151;
            margin-bottom: 20px;
        }
        .ingredients-list {
            list-style: none;
            padding: 0;
        }
        .ingredient-item {
            padding: 12px;
            margin-bottom: 8px;
            background: #F9FAFB;
            border-radius: 8px;
            border-left: 4px solid #6366F1;
        }
        .ingredient-text {
            font-size: 14px;
            color: #111827;
            line-height: 1.5;
        }
        .instructions-list {
            list-style: none;
            padding: 0;
        }
        .instruction-item {
            display: flex;
            margin-bottom: 20px;
            padding: 15px;
            background: #F9FAFB;
            border-radius: 8px;
        }
        .instruction-number {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            flex-shrink: 0;
            margin-right: 15px;
        }
        .instruction-text {
            font-size: 14px;
            color: #111827;
            line-height: 1.6;
            flex: 1;
        }
        .tips-list {
            list-style: none;
            padding: 0;
        }
        .tip-item {
            padding: 12px;
            margin-bottom: 8px;
            background: #FEF3C7;
            border-radius: 8px;
            border-left: 4px solid #F59E0B;
        }
        .tip-text {
            font-size: 14px;
            color: #111827;
            line-height: 1.5;
        }
        .nutrition-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        .nutrition-item {
            text-align: center;
            padding: 15px;
            background: #F9FAFB;
            border-radius: 8px;
        }
        .nutrition-label {
            font-size: 12px;
            color: #6B7280;
            margin-bottom: 5px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .nutrition-value {
            font-size: 20px;
            font-weight: 700;
            color: #6366F1;
        }
        .cost-section {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .cost-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        .cost-value {
            font-size: 28px;
            font-weight: 900;
        }
        .footer {
            text-align: center;
            padding: 30px;
            background: #F3F4F6;
            color: #6B7280;
            font-size: 12px;
        }
        .yukpo-signature {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            text-align: center;
        }
        .yukpo-logo {
            font-size: 24px;
            font-weight: 900;
            color: #6366F1;
            margin-bottom: 10px;
        }
        .yukpo-tagline {
            font-size: 11px;
            color: #9CA3AF;
            font-style: italic;
        }
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .recipe-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="recipe-container">
        <!-- Header -->
        <div class="recipe-header">
            <div class="recipe-title">\uD83C\uDF7D️ ${recipe.recipe_name}</div>
            <div class="recipe-subtitle">Recette complète</div>
        </div>

        <!-- Body -->
        <div class="recipe-body">
            ${recipe.description ? `
            <div class="recipe-section">
                <p class="description-text">${recipe.description}</p>
            </div>
            ` : ''}

            <!-- Informations rapides -->
            <div class="recipe-info-grid">
                ${recipe.prep_time_minutes ? `
                <div class="info-item">
                    <div class="info-label">⏱️ Temps de préparation</div>
                    <div class="info-value">${recipe.prep_time_minutes} min</div>
                </div>
                ` : ''}
                ${recipe.cook_time_minutes ? `
                <div class="info-item">
                    <div class="info-label">\uD83D\uDD25 Temps de cuisson</div>
                    <div class="info-value">${recipe.cook_time_minutes} min</div>
                </div>
                ` : ''}
                ${recipe.total_time_minutes ? `
                <div class="info-item">
                    <div class="info-label">⏰ Temps total</div>
                    <div class="info-value">${recipe.total_time_minutes} min</div>
                </div>
                ` : ''}
                ${recipe.difficulty ? `
                <div class="info-item">
                    <div class="info-label">⭐ Difficulté</div>
                    <div class="info-value">${recipe.difficulty}</div>
                </div>
                ` : ''}
                <div class="info-item">
                    <div class="info-label">\uD83D\uDC65 Portions</div>
                    <div class="info-value">${recipe.servings}</div>
                </div>
                ${recipe.cuisine_style ? `
                <div class="info-item">
                    <div class="info-label">\uD83C\uDF0D Style culinaire</div>
                    <div class="info-value">${recipe.cuisine_style}</div>
                </div>
                ` : ''}
            </div>

            <!-- Ingrédients -->
            ${recipe.ingredients && recipe.ingredients.length > 0 ? `
            <div class="recipe-section">
                <h2 class="section-title">\uD83D\uDCCB Ingrédients</h2>
                <ul class="ingredients-list">
                    ${recipe.ingredients.map((ingredient: any) => `
                    <li class="ingredient-item">
                        <div class="ingredient-text">
                            <strong>${ingredient.name}</strong>: ${ingredient.quantity} ${ingredient.unit}
                            ${ingredient.notes ? ` <em>(${ingredient.notes})</em>` : ''}
                        </div>
                    </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}

            <!-- Instructions -->
            ${recipe.instructions && recipe.instructions.length > 0 ? `
            <div class="recipe-section">
                <h2 class="section-title">\uD83D\uDC68‍\uD83C\uDF73 Instructions</h2>
                <ol class="instructions-list">
                    ${recipe.instructions.map((instruction: string, index: number) => `
                    <li class="instruction-item">
                        <div class="instruction-number">${index + 1}</div>
                        <div class="instruction-text">${instruction}</div>
                    </li>
                    `).join('')}
                </ol>
            </div>
            ` : ''}

            <!-- Astuces -->
            ${recipe.tips && recipe.tips.length > 0 ? `
            <div class="recipe-section">
                <h2 class="section-title">\uD83D\uDCA1 Astuces</h2>
                <ul class="tips-list">
                    ${recipe.tips.map((tip: string) => `
                    <li class="tip-item">
                        <div class="tip-text">${tip}</div>
                    </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}

            <!-- Nutrition -->
            ${recipe.nutrition ? `
            <div class="recipe-section">
                <h2 class="section-title">\uD83E\uDD57 Valeurs nutritionnelles (par portion)</h2>
                <div class="nutrition-grid">
                    ${recipe.calories_per_serving ? `
                    <div class="nutrition-item">
                        <div class="nutrition-label">Calories</div>
                        <div class="nutrition-value">${recipe.calories_per_serving.toFixed(0)}</div>
                    </div>
                    ` : ''}
                    <div class="nutrition-item">
                        <div class="nutrition-label">Protéines</div>
                        <div class="nutrition-value">${recipe.nutrition.proteins.toFixed(1)}g</div>
                    </div>
                    <div class="nutrition-item">
                        <div class="nutrition-label">Glucides</div>
                        <div class="nutrition-value">${recipe.nutrition.carbs.toFixed(1)}g</div>
                    </div>
                    <div class="nutrition-item">
                        <div class="nutrition-label">Lipides</div>
                        <div class="nutrition-value">${recipe.nutrition.fats.toFixed(1)}g</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Coût estimé -->
            ${recipe.estimated_cost ? `
            <div class="recipe-section">
                <div class="cost-section">
                    <div class="cost-label">\uD83D\uDCB0 Coût estimé</div>
                    <div class="cost-value">${recipe.estimated_cost.toLocaleString('fr-FR')} ${currency}</div>
                </div>
            </div>
            ` : ''}
        </div>

        <!-- Footer avec signature Yukpo -->
        <div class="footer">
            <div style="margin-bottom: 10px;">✅ Recette générée le ${now}</div>
            <div class="yukpo-signature">
                <div class="yukpo-logo">YUKPO</div>
                <div class="yukpo-tagline">Votre assistant intelligent pour une meilleure planification</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Génère et télécharge la recette PDF
 * Utilise expo-print pour générer le PDF sur mobile
 */
export async function generateAndDownloadRecipePDF(recipeData: RecipePdfData): Promise<string> {
    try {
        // Import statique de expo-print
        const { printToFileAsync } = require('expo-print');

        if (!printToFileAsync || typeof printToFileAsync !== 'function') {
            throw new Error('expo-print.printToFileAsync n\'est pas disponible. Veuillez installer expo-print: npm install expo-print');
        }

        const html = await generateRecipeHTML(recipeData);

        const { uri } = await printToFileAsync({
            html,
            base64: false
        });

        console.log('✅ Recette PDF générée:', uri);
        return uri;
    } catch (error: any) {
        console.error('❌ Erreur génération PDF:', error);
        if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
            throw new Error('Impossible de générer la recette PDF. Veuillez installer expo-print: npm install expo-print');
        }
        throw error;
    }
}

/**
 * Partage la recette PDF générée vers WhatsApp
 */
export async function shareRecipePDF(pdfUri: string, recipeName: string) {
    try {
        const Share = require('react-native-share');
        const { shareAsync } = require('expo-sharing');

        // Essayer d'abord avec react-native-share pour cibler WhatsApp spécifiquement
        try {
            await Share.default.open({
                url: `file://${pdfUri}`,
                type: 'application/pdf',
                title: `Recette - ${recipeName}`,
                message: `\uD83C\uDF7D️ Voici la recette de "${recipeName}" générée par Yukpo !`,
                social: Share.Social.WHATSAPP,
            });
        } catch (shareError) {
            // Fallback vers expo-sharing si WhatsApp n'est pas disponible
            await shareAsync(pdfUri, {
                mimeType: 'application/pdf',
                dialogTitle: `Recette - ${recipeName}`,
                UTI: 'com.adobe.pdf'
            });
        }

        console.log('✅ Recette partagée');
    } catch (error: any) {
        console.error('❌ Erreur partage PDF:', error);
        throw new Error('Impossible de partager la recette');
    }
}

