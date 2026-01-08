// ✅ Service pour l'analyse d'image IA (Hôpital et Pharmacie)
import { apiPost } from './api';

export interface ImageAnalysisResult {
    success: boolean;
    analysis: {
        description?: string;
        interpretation?: string;
        tags?: string[];
        category_detected?: string;
        recommendations?: string[];
        confidence?: number;
        [key: string]: any;
    };
    error?: string;
}

export const imageAnalysisService = {
    // Analyser une image pour hôpital (examens médicaux)
    analyzeHospitalImage: async (
        imageBase64: string,
        examinationType: string = 'general',
        patientAge?: number,
        patientSex?: string
    ): Promise<{ success: boolean; data?: ImageAnalysisResult; error?: string }> => {
        try {
            const response = await apiPost<ImageAnalysisResult>(
                '/api/laboratoires/examinations/analyze-image',
                {
                    image_uri: imageBase64,
                    image_base64: imageBase64, // Support des deux formats
                    examination_type: examinationType,
                    patient_age: patientAge,
                    patient_sex: patientSex,
                }
            );
            
            // Normaliser la réponse
            if (response.success) {
                return {
                    success: true,
                    data: response.data || response as any,
                };
            } else {
                return {
                    success: false,
                    error: response.message || response.error || 'L\'IA d\'analyse d\'images n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[imageAnalysisService] Erreur analyse hôpital:', error);
            return {
                success: false,
                error: error.message || error.error || 'Erreur lors de l\'analyse de l\'image. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.'
            };
        }
    },

    // Analyser une image pour pharmacie (médicaments)
    analyzePharmacyImage: async (
        imageBase64: string
    ): Promise<{ success: boolean; data?: ImageAnalysisResult; error?: string }> => {
        try {
            // Utiliser l'API d'analyse d'image générique avec contexte pharmacie
            const response = await apiPost<ImageAnalysisResult>(
                '/api/search/by-image',
                {
                    image_base64: imageBase64,
                    image_uri: imageBase64, // Support des deux formats
                    category: 'pharmacie',
                    context: 'medication_analysis'
                }
            );
            
            // Normaliser la réponse
            if (response.success) {
                return {
                    success: true,
                    data: response.data || response as any,
                };
            } else {
                return {
                    success: false,
                    error: response.message || response.error || 'L\'IA d\'analyse d\'images n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[imageAnalysisService] Erreur analyse pharmacie:', error);
            return {
                success: false,
                error: error.message || error.error || 'Erreur lors de l\'analyse de l\'image. L\'IA d\'analyse d\'images n\'est peut-être pas encore opérationnelle.'
            };
        }
    },
};

