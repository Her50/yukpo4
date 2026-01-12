/**
 * Générateur de PDF pour les menus de planification
 * Génère un PDF professionnel du menu hebdomadaire avec signature Yukpo
 */

import { WeeklyMenu } from '../services/menuPlanningService';

export interface MenuPdfData {
    menu: WeeklyMenu;
    familyProfile?: {
        total_members: number;
        adults_count?: number;
        children_count?: number;
    };
    weekStart: string;
    weekEnd: string;
    totalCost: number;
    currency?: string;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Génère le HTML du menu pour conversion en PDF
 */
export async function generateMenuHTML(menuData: MenuPdfData): Promise<string> {
    const now = new Date().toLocaleString('fr-FR');
    const currency = menuData.currency || 'FCFA';
    
    // Calculer les totaux par jour
    const dailyTotals = menuData.menu.meals.map(meal => {
        const total = (meal.petit_dejeuner?.estimated_cost || 0) +
                     (meal.dejeuner?.estimated_cost || 0) +
                     (meal.diner?.estimated_cost || 0);
        return { day: meal.day_name, total };
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Menu de la Semaine - Yukpomnang</title>
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
        .menu-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .menu-header {
            background: linear-gradient(135deg, #F59E0B 0%, #F97316 100%);
            padding: 40px;
            color: white;
            text-align: center;
        }
        .menu-title {
            font-size: 36px;
            font-weight: 900;
            margin-bottom: 10px;
        }
        .menu-subtitle {
            font-size: 18px;
            opacity: 0.95;
            margin-bottom: 20px;
        }
        .menu-period {
            font-size: 16px;
            opacity: 0.9;
        }
        .menu-body {
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
        .menu-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .menu-table thead {
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
        }
        .menu-table th {
            padding: 15px;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .menu-table th:first-child {
            width: 120px;
        }
        .menu-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #E5E7EB;
            font-size: 13px;
            vertical-align: top;
        }
        .menu-table tr:last-child td {
            border-bottom: none;
        }
        .day-cell {
            background: #F3F4F6;
            font-weight: 700;
            color: #111827;
            text-align: center;
        }
        .meal-cell {
            min-height: 80px;
        }
        .meal-name {
            font-weight: 600;
            color: #111827;
            margin-bottom: 6px;
        }
        .meal-price {
            color: #6366F1;
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .meal-servings {
            color: #6B7280;
            font-size: 11px;
        }
        .total-row {
            background: #F3F4F6;
            font-weight: 700;
        }
        .total-cell {
            text-align: center;
            color: #6366F1;
            font-size: 14px;
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
            .menu-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="menu-container">
        <!-- Header -->
        <div class="menu-header">
            <div class="menu-title">🍽️ MENU DE LA SEMAINE</div>
            <div class="menu-subtitle">Planification des repas</div>
            <div class="menu-period">
                ${new Date(menuData.weekStart).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })} - ${new Date(menuData.weekEnd).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })}
            </div>
        </div>

        <!-- Body -->
        <div class="menu-body">
            <!-- Informations famille -->
            ${menuData.familyProfile ? `
            <div class="info-section">
                <div class="info-item">
                    <div class="info-label">👥 Membres</div>
                    <div class="info-value">${menuData.familyProfile.total_members}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">💰 Budget Total</div>
                    <div class="info-value">${menuData.totalCost.toLocaleString('fr-FR')} ${currency}</div>
                </div>
            </div>
            ` : ''}

            <!-- Tableau du menu -->
            <table class="menu-table">
                <thead>
                    <tr>
                        <th>Jour</th>
                        <th>🌅 Petit-déjeuner</th>
                        <th>☀️ Déjeuner</th>
                        <th>🌙 Dîner</th>
                    </tr>
                </thead>
                <tbody>
                    ${menuData.menu.meals.map((meal, index) => {
                        const dayTotal = (meal.petit_dejeuner?.estimated_cost || 0) +
                                       (meal.dejeuner?.estimated_cost || 0) +
                                       (meal.diner?.estimated_cost || 0);
                        return `
                        <tr>
                            <td class="day-cell">${meal.day_name}</td>
                            <td class="meal-cell">
                                ${meal.petit_dejeuner ? `
                                <div class="meal-name">${meal.petit_dejeuner.recipe_name}</div>
                                <div class="meal-price">${(meal.petit_dejeuner.estimated_cost || 0).toLocaleString('fr-FR')} ${currency}</div>
                                <div class="meal-servings">👥 ${meal.petit_dejeuner.servings} portion${meal.petit_dejeuner.servings > 1 ? 's' : ''}</div>
                                ` : '<div style="color: #9CA3AF; font-style: italic;">-</div>'}
                            </td>
                            <td class="meal-cell">
                                ${meal.dejeuner ? `
                                <div class="meal-name">${meal.dejeuner.recipe_name}</div>
                                <div class="meal-price">${(meal.dejeuner.estimated_cost || 0).toLocaleString('fr-FR')} ${currency}</div>
                                <div class="meal-servings">👥 ${meal.dejeuner.servings} portion${meal.dejeuner.servings > 1 ? 's' : ''}</div>
                                ` : '<div style="color: #9CA3AF; font-style: italic;">-</div>'}
                            </td>
                            <td class="meal-cell">
                                ${meal.diner ? `
                                <div class="meal-name">${meal.diner.recipe_name}</div>
                                <div class="meal-price">${(meal.diner.estimated_cost || 0).toLocaleString('fr-FR')} ${currency}</div>
                                <div class="meal-servings">👥 ${meal.diner.servings} portion${meal.diner.servings > 1 ? 's' : ''}</div>
                                ` : '<div style="color: #9CA3AF; font-style: italic;">-</div>'}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                    <!-- Ligne de totaux -->
                    <tr class="total-row">
                        <td class="day-cell">Total</td>
                        ${dailyTotals.map(day => `
                        <td class="total-cell">${day.total.toLocaleString('fr-FR')} ${currency}</td>
                        `).join('')}
                    </tr>
                </tbody>
            </table>

            <!-- Résumé total -->
            <div class="summary-section">
                <div class="summary-label">💰 Coût Total Estimé</div>
                <div class="summary-value">${menuData.totalCost.toLocaleString('fr-FR')} ${currency}</div>
            </div>
        </div>

        <!-- Footer avec signature Yukpo -->
        <div class="footer">
            <div style="margin-bottom: 10px;">✅ Menu généré le ${now}</div>
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
 * Génère et télécharge le menu PDF
 * Utilise expo-print pour générer le PDF sur mobile
 */
export async function generateAndDownloadMenuPDF(menuData: MenuPdfData): Promise<string> {
    try {
        // Import statique de expo-print
        const { printToFileAsync } = require('expo-print');

        if (!printToFileAsync || typeof printToFileAsync !== 'function') {
            throw new Error('expo-print.printToFileAsync n\'est pas disponible. Veuillez installer expo-print: npm install expo-print');
        }

        const html = await generateMenuHTML(menuData);

        const { uri } = await printToFileAsync({
            html,
            base64: false
        });

        console.log('✅ Menu PDF généré:', uri);
        return uri;
    } catch (error: any) {
        console.error('❌ Erreur génération PDF:', error);
        if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
            throw new Error('Impossible de générer le menu PDF. Veuillez installer expo-print: npm install expo-print');
        }
        throw error;
    }
}

/**
 * Partage le menu PDF généré vers WhatsApp
 */
export async function shareMenuPDF(pdfUri: string, menuTitle: string) {
    try {
        const { shareAsync } = require('expo-sharing');
        const Share = require('react-native-share');

        // Essayer d'abord avec react-native-share pour cibler WhatsApp spécifiquement
        try {
            await Share.default.open({
                url: `file://${pdfUri}`,
                type: 'application/pdf',
                title: `Menu de la Semaine - ${menuTitle}`,
                message: `🍽️ Voici mon menu de la semaine généré par Yukpomnang !`,
                social: Share.Social.WHATSAPP,
            });
        } catch (shareError) {
            // Fallback vers expo-sharing si WhatsApp n'est pas disponible
            await shareAsync(pdfUri, {
                mimeType: 'application/pdf',
                dialogTitle: `Menu de la Semaine - ${menuTitle}`,
                UTI: 'com.adobe.pdf'
            });
        }

        console.log('✅ Menu partagé');
    } catch (error: any) {
        console.error('❌ Erreur partage PDF:', error);
        throw new Error('Impossible de partager le menu');
    }
}

