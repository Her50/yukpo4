import React from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Phone, Mail, Video } from 'lucide-react';
import { Service } from '@/types/service';

// Fonction utilitaire pour extraire la valeur d'un champ de service
const getServiceFieldValue = (field: any): string => {
  if (!field) return 'Non spécifié';
  
  if (typeof field === 'string') return field;
  
  if (field && typeof field === 'object') {
    if (field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      if (typeof value === 'number') return value.toString();
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    }
  }
  
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spécifié';
};

interface ContactModalProps {
  service: Service;
  prestataires: Map<number, any>;
  user: any;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({
  service,
  prestataires,
  user,
  onClose
}) => {
  const handleCall = () => {
    const phone = getServiceFieldValue(service.data?.telephone);
    if (phone && phone !== 'Non spécifié') {
      window.open(`tel:${phone}`, '_self');
    }
  };

  const handleEmail = () => {
    const email = getServiceFieldValue(service.data?.email);
    if (email && email !== 'Non spécifié') {
      window.open(`mailto:${email}?subject=Demande de service`, '_self');
    }
  };

  const handleVideoCall = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Caméra non disponible');
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        const videoWindow = window.open(
          `/video-call?service=${service.id}&user=${user?.id}`,
          'video-call',
          'width=800,height=600,scrollbars=no,resizable=yes'
        );
        
        if (videoWindow) {
          console.log('Appel vidéo démarré');
        }
      })
      .catch((error) => {
        console.error('Erreur accès caméra:', error);
      });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Contacter le prestataire</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </Button>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            <strong>Service :</strong> {getServiceFieldValue(service.data?.titre_service)}
          </p>
          <p className="text-gray-600 mb-2">
            <strong>Prestataire :</strong> {getServiceFieldValue(service.data?.nom_prestataire) || `#${service.user_id}`}
          </p>
          <p className="text-gray-600">
            <strong>Localisation :</strong> {getServiceFieldValue(service.data?.gps_fixe)}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleCall}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <Phone className="w-4 h-4 mr-2" />
            Appeler
          </Button>
          
          <Button
            onClick={handleEmail}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Mail className="w-4 h-4 mr-2" />
            Envoyer un email
          </Button>
          
          <Button
            onClick={handleVideoCall}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Video className="w-4 h-4 mr-2" />
            Appel vidéo
          </Button>
        </div>

        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContactModal; 