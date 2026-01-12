/**
 * Générateur de PDF pour les listes de courses
 * Génère un PDF professionnel de la liste de courses avec signature Yukpo
 */

export interface ShoppingListPdfData {
    items: Array<{
        ingredient_name: string;
        quantity: number;
        unit: string;
        estimated_price: number;
        associated_meals: string[];
    }>;
    total_estimated_cost: number;
    currency?: string;
    family_members?: number;
}

/**
 * Génère le HTML de la liste de courses pour conversion en PDF
 */
export async function generateShoppingListHTML(listData: ShoppingListPdfData): Promise<string> {
    const now = new Date().toLocaleString('fr-FR');
    const currency = listData.currency || 'FCFA';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liste de Courses - Yukpomnang</title>
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
        .list-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .list-header {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            padding: 40px;
            color: white;
            text-align: center;
        }
        .list-title {
            font-size: 36px;
            font-weight: 900;
            margin-bottom: 10px;
        }
        .list-subtitle {
            font-size: 18px;
            opacity: 0.95;
        }
        .list-body {
            padding: 30px;
        }
        .info-section {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
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
            font-size: 20px;
            font-weight: 700;
            color: #111827;
        }
        .list-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .list-table thead {
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
        }
        .list-table th {
            padding: 15px;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .list-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #E5E7EB;
            font-size: 13px;
            vertical-align: top;
        }
        .list-table tr:last-child td {
            border-bottom: none;
        }
        .ingredient-name {
            font-weight: 600;
            color: #111827;
        }
        .ingredient-quantity {
            color: #6366F1;
            font-weight: 700;
        }
        .ingredient-price {
            color: #10B981;
            font-weight: 700;
        }
        .ingredient-meals {
            color: #6B7280;
            font-size: 11px;
            font-style: italic;
        }
        .summary-section {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 30px;
        }
        .summary-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .summary-value {
            font-size: 32px;
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
        }
    </style>
</head>
<body>
    <div class="list-container">
        <!-- Header -->
        <div class="list-header">
            <div class="list-title">🛒 LISTE DE COURSES</div>
            <div class="list-subtitle">Planification des achats</div>
        </div>

        <!-- Body -->
        <div class="list-body">
            <!-- Informations -->
            ${listData.family_members ? `
            <div class="info-section">
                <div class="info-item">
                    <div class="info-label">👥 Membres</div>
                    <div class="info-value">${listData.family_members}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">💰 Budget Total</div>
                    <div class="info-value">${listData.total_estimated_cost.toLocaleString('fr-FR')} ${currency}</div>
                </div>
            </div>
            ` : ''}

            <!-- Tableau de la liste -->
            <table class="list-table">
                <thead>
                    <tr>
                        <th>Ingrédient</th>
                        <th>Quantité</th>
                        <th>Prix Estimé</th>
                        <th>Repas Associés</th>
                    </tr>
                </thead>
                <tbody>
                    ${listData.items.map((item, index) => `
                    <tr>
                        <td class="ingredient-name">${item.ingredient_name}</td>
                        <td class="ingredient-quantity">${item.quantity} ${item.unit}</td>
                        <td class="ingredient-price">${item.estimated_price.toLocaleString('fr-FR')} ${currency}</td>
                        <td class="ingredient-meals">${item.associated_meals.join(', ')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Résumé total -->
            <div class="summary-section">
                <div class="summary-label">💰 Coût Total Estimé</div>
                <div class="summary-value">${listData.total_estimated_cost.toLocaleString('fr-FR')} ${currency}</div>
            </div>
        </div>

        <!-- Footer avec signature Yukpo -->
        <div class="footer">
            <div style="margin-bottom: 10px;">✅ Liste générée le ${now}</div>
            <div class="yukpo-signature">
                <div class="yukpo-logo">YUKPOMNANG</div>
                <div class="yukpo-tagline">Votre assistant intelligent pour une meilleure planification</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Génère et télécharge la liste de courses PDF
 */
export async function generateAndDownloadShoppingListPDF(listData: ShoppingListPdfData): Promise<string> {
    try {
        // Import statique de expo-print
        const { printToFileAsync } = require('expo-print');

        if (!printToFileAsync || typeof printToFileAsync !== 'function') {
            throw new Error('expo-print.printToFileAsync n\'est pas disponible. Veuillez installer expo-print: npm install expo-print');
        }

        const html = await generateShoppingListHTML(listData);

        const { uri } = await printToFileAsync({
            html,
            base64: false
        });

        console.log('✅ Liste de courses PDF générée:', uri);
        return uri;
    } catch (error: any) {
        console.error('❌ Erreur génération PDF:', error);
        if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
            throw new Error('Impossible de générer la liste de courses PDF. Veuillez installer expo-print: npm install expo-print');
        }
        throw error;
    }
}

/**
 * Partage la liste de courses PDF générée vers WhatsApp
 */
export async function shareShoppingListPDF(pdfUri: string, listTitle: string) {
    try {
        const Share = require('react-native-share');
        const { shareAsync } = require('expo-sharing');

        // Essayer d'abord avec react-native-share pour cibler WhatsApp spécifiquement
        try {
            await Share.default.open({
                url: `file://${pdfUri}`,
                type: 'application/pdf',
                title: `Liste de Courses - ${listTitle}`,
                message: `🛒 Voici ma liste de courses générée par Yukpomnang !`,
                social: Share.Social.WHATSAPP,
            });
        } catch (shareError) {
            // Fallback vers expo-sharing si WhatsApp n'est pas disponible
            await shareAsync(pdfUri, {
                mimeType: 'application/pdf',
                dialogTitle: `Liste de Courses - ${listTitle}`,
                UTI: 'com.adobe.pdf'
            });
        }

        console.log('✅ Liste de courses partagée');
    } catch (error: any) {
        console.error('❌ Erreur partage PDF:', error);
        throw new Error('Impossible de partager la liste de courses');
    }
}

