/**
 * Générateur de ticket PDF pour les réservations de bus
 * Génère un ticket de voyage professionnel avec toutes les informations
 * Inclut un QR Code pour validation du ticket
 */

/**
 * Génère un QR Code complet pour validation du ticket
 * Encode toutes les informations critiques du voyage
 */
async function generateQRCode(data: string): Promise<string> {
    try {
        // API gratuite QR Server avec paramètres optimaux pour tickets
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}&format=png&bgcolor=FFFFFF&color=000000&qzone=3&margin=15&ecc=H`;
        return qrCodeUrl;
    } catch (error) {
        console.error('Erreur génération QR code:', error);
        // Fallback: QR code basique
        return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}`;
    }
}

export interface BusTicketData {
    // Informations réservation
    reservationId: string;
    passengerName: string;
    seatNumber: number;

    // Informations voyage
    compagnie: string;
    logoAgence?: string;
    numeroBus: string;
    depart: string;
    destination: string;
    dateDepart: string;
    heureDepart: string;
    classeVoyage: string;

    // Informations paiement
    prix: number;
    devise: string;
    cautionPaid: number;
    totalPaid: number;

    // Informations supplémentaires
    escales?: string;
    conditionsVoyage?: string;

    // QR Code pour validation
    qrCodeData?: string;
}

/**
 * Génère le HTML du ticket de voyage
 * Ce HTML sera converti en PDF par le backend ou par expo-print
 */
export async function generateBusTicketHTML(ticketData: BusTicketData): Promise<string> {
    const now = new Date().toLocaleString('fr-FR');
    
    // Créer le contenu structuré du QR Code
    const qrData = JSON.stringify({
        type: 'BUS_TICKET_YUKPOMNANG',
        id: ticketData.reservationId,
        passenger: ticketData.passengerName,
        seat: ticketData.seatNumber,
        bus: ticketData.numeroBus,
        route: `${ticketData.depart}-${ticketData.destination}`,
        departure: `${ticketData.dateDepart} ${ticketData.heureDepart}`,
        price: ticketData.prix,
        companycompagnie: ticketData.compagnie,
        validated: false,
        timestamp: new Date().toISOString()
    });
    
    const qrCodeUrl = await generateQRCode(qrData);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket de Voyage - ${ticketData.passengerName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .ticket {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .ticket-header {
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            padding: 30px;
            color: white;
            position: relative;
        }
        .logo-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .logo {
            height: 60px;
            object-fit: contain;
        }
        .ticket-title {
            font-size: 32px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 10px;
        }
        .compagnie-name {
            font-size: 20px;
            text-align: center;
            opacity: 0.9;
        }
        .ticket-body {
            padding: 40px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 14px;
            text-transform: uppercase;
            color: #6B7280;
            font-weight: 600;
            margin-bottom: 15px;
            letter-spacing: 1px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        .info-item {
            background: #F9FAFB;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #6366F1;
        }
        .info-label {
            font-size: 12px;
            color: #6B7280;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .info-value {
            font-size: 18px;
            color: #1F2937;
            font-weight: 700;
        }
        .passenger-section {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            margin-bottom: 30px;
        }
        .passenger-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
        }
        .passenger-name {
            font-size: 28px;
            font-weight: 700;
        }
        .seat-number {
            background: #FCD34D;
            color: #92400E;
            display: inline-block;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 32px;
            font-weight: 700;
            margin: 20px 0;
        }
        .route-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 25px;
            background: linear-gradient(to right, #EFF6FF, #DBEAFE);
            border-radius: 15px;
            margin-bottom: 30px;
        }
        .route-city {
            font-size: 24px;
            font-weight: 700;
            color: #1E40AF;
        }
        .route-arrow {
            font-size: 36px;
            color: #6366F1;
        }
        .datetime-container {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }
        .datetime-box {
            flex: 1;
            background: #FEFCE8;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #FDE047;
        }
        .datetime-label {
            font-size: 12px;
            color: #92400E;
            margin-bottom: 5px;
        }
        .datetime-value {
            font-size: 20px;
            font-weight: 700;
            color: #713F12;
        }
        .payment-summary {
            background: #F0FDF4;
            border: 2px solid #86EFAC;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .payment-total {
            font-size: 24px;
            font-weight: 700;
            color: #10B981;
            border-top: 2px solid #86EFAC;
            padding-top: 15px;
            margin-top: 10px;
        }
        .conditions {
            background: #FEF3C7;
            padding: 15px;
            border-radius: 10px;
            font-size: 12px;
            line-height: 1.6;
            color: #92400E;
            margin-bottom: 30px;
        }
        .qr-code-section {
            text-align: center;
            padding: 20px;
            background: #F9FAFB;
            border-radius: 12px;
        }
        .qr-placeholder {
            width: 150px;
            height: 150px;
            background: white;
            border: 2px solid #E5E7EB;
            border-radius: 10px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
        }
        .reservation-id {
            font-size: 14px;
            color: #6B7280;
            font-family: 'Courier New', monospace;
            margin-top: 10px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #F3F4F6;
            color: #6B7280;
            font-size: 12px;
        }
        .print-notice {
            text-align: center;
            color: #9CA3AF;
            font-size: 11px;
            margin-top: 20px;
        }
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .print-notice {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="ticket">
        <!-- Header -->
        <div class="ticket-header">
            ${ticketData.logoAgence ? `
            <div class="logo-container">
                <img src="${ticketData.logoAgence}" alt="Logo" class="logo" />
            </div>
            ` : ''}
            <div class="ticket-title">🎫 TICKET DE VOYAGE</div>
            <div class="compagnie-name">${ticketData.compagnie}</div>
        </div>

        <!-- Body -->
        <div class="ticket-body">
            <!-- Passager -->
            <div class="passenger-section">
                <div class="passenger-label">PASSAGER</div>
                <div class="passenger-name">${ticketData.passengerName}</div>
            </div>

            <!-- Numéro de place -->
            <div style="text-align: center;">
                <div style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">PLACE N°</div>
                <div class="seat-number">${ticketData.seatNumber}</div>
            </div>

            <!-- Trajet -->
            <div class="route-container">
                <div class="route-city">${ticketData.depart}</div>
                <div class="route-arrow">→</div>
                <div class="route-city">${ticketData.destination}</div>
            </div>

            <!-- Date et Heure -->
            <div class="datetime-container">
                <div class="datetime-box">
                    <div class="datetime-label">📅 DATE</div>
                    <div class="datetime-value">${ticketData.dateDepart}</div>
                </div>
                <div class="datetime-box">
                    <div class="datetime-label">🕐 HEURE</div>
                    <div class="datetime-value">${ticketData.heureDepart}</div>
                </div>
            </div>

            <!-- Informations voyage -->
            <div class="section">
                <div class="section-title">📋 Informations Voyage</div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Numéro Bus</div>
                        <div class="info-value">${ticketData.numeroBus}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Classe</div>
                        <div class="info-value">${ticketData.classeVoyage}</div>
                    </div>
                    ${ticketData.escales ? `
                    <div class="info-item" style="grid-column: span 2;">
                        <div class="info-label">Escales</div>
                        <div class="info-value" style="font-size: 14px;">${ticketData.escales}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Résumé paiement -->
            <div class="payment-summary">
                <div class="payment-row">
                    <span>Prix du ticket</span>
                    <span>${ticketData.prix.toLocaleString()} ${ticketData.devise}</span>
                </div>
                <div class="payment-row">
                    <span>Caution payée</span>
                    <span style="color: #10B981;">-${ticketData.cautionPaid.toLocaleString()} ${ticketData.devise}</span>
                </div>
                <div class="payment-row payment-total">
                    <span>TOTAL PAYÉ</span>
                    <span>${ticketData.totalPaid.toLocaleString()} ${ticketData.devise}</span>
                </div>
            </div>

            <!-- Conditions -->
            ${ticketData.conditionsVoyage ? `
            <div class="conditions">
                <strong>📜 Conditions de voyage:</strong><br/>
                ${ticketData.conditionsVoyage}
            </div>
            ` : ''}

            <!-- QR Code -->
            <div class="qr-code-section">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 10px; border: 3px solid #E5E7EB;" />
                <div style="font-size: 13px; color: #6B7280; margin-top: 12px; font-weight: 600;">📱 Scannez pour valider le ticket</div>
                <div class="reservation-id">
                    ID: ${ticketData.reservationId}
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div style="margin-bottom: 10px;">✅ TICKET CONFIRMÉ ET VALIDÉ</div>
            <div>Généré le ${now}</div>
            <div style="margin-top: 10px;">📞 Conservez ce ticket pour votre voyage</div>
        </div>
    </div>

    <div class="print-notice">
        Ce ticket peut être imprimé ou présenté sur votre téléphone
    </div>
</body>
</html>
    `;
}

/**
 * Génère et télécharge le ticket PDF
 * Utilise expo-print pour générer le PDF sur mobile
 */
export async function generateAndDownloadTicket(ticketData: BusTicketData): Promise<string> {
    try {
        // Dynamically import expo-print
        const { printToFileAsync } = await import('expo-print');

        const html = await generateBusTicketHTML(ticketData);

        const { uri } = await printToFileAsync({
            html,
            base64: false
        });

        console.log('✅ Ticket PDF généré avec QR Code:', uri);
        return uri;
    } catch (error) {
        console.error('❌ Erreur génération PDF:', error);
        throw new Error('Impossible de générer le ticket PDF');
    }
}

/**
 * Partage le ticket PDF généré
 */
export async function shareTicketPDF(pdfUri: string, passengerName: string) {
    try {
        const { shareAsync } = await import('expo-sharing');

        await shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Ticket de voyage - ${passengerName}`,
            UTI: 'com.adobe.pdf'
        });

        console.log('✅ Ticket partagé');
    } catch (error) {
        console.error('❌ Erreur partage PDF:', error);
        throw new Error('Impossible de partager le ticket');
    }
}

