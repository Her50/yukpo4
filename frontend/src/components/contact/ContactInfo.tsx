import React from 'react';
import { Phone, Mail, MapPin, Globe, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/buttons/Button';

interface ContactInfoProps {
  service: any;
  prestataireInfo?: any;
  className?: string;
  compact?: boolean;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ 
  service, 
  prestataireInfo, 
  className = '',
  compact = false 
}) => {
  // Fonction utilitaire pour extraire la valeur d'un champ
  const getFieldValue = (field: any): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object' && field.valeur !== undefined) {
      return String(field.valeur);
    }
    return '';
  };

  // Récupérer les informations de contact
  const getContactInfo = () => {
    const contacts = [];
    
    // Téléphone - priorité au service, puis à l'utilisateur
    const phone = getFieldValue(service.data?.telephone) || prestataireInfo?.telephone;
    if (phone && phone !== 'Non spécifié') {
      contacts.push({
        type: 'phone',
        value: phone,
        icon: Phone,
        action: () => window.open(`tel:${phone}`, '_self'),
        label: 'Appeler'
      });
    }
    
    // Email - priorité au service, puis à l'utilisateur
    const email = getFieldValue(service.data?.email) || prestataireInfo?.email;
    if (email && email !== 'Non spécifié') {
      contacts.push({
        type: 'email',
        value: email,
        icon: Mail,
        action: () => window.open(`mailto:${email}?subject=Demande de service`, '_self'),
        label: 'Email'
      });
    }
    
    // Site web
    const website = getFieldValue(service.data?.website);
    if (website && website !== 'Non spécifié') {
      contacts.push({
        type: 'website',
        value: website,
        icon: Globe,
        action: () => window.open(website, '_blank'),
        label: 'Site web'
      });
    }
    
    // WhatsApp
    const whatsapp = getFieldValue(service.data?.whatsapp);
    if (whatsapp && whatsapp !== 'Non spécifié') {
      contacts.push({
        type: 'whatsapp',
        value: whatsapp,
        icon: MessageCircle,
        action: () => window.open(`https://wa.me/${whatsapp}`, '_blank'),
        label: 'WhatsApp'
      });
    }
    
    return contacts;
  };

  const contacts = getContactInfo();

  if (contacts.length === 0) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <p className="text-sm">Aucune information de contact disponible</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {contacts.map((contact, index) => {
          const Icon = contact.icon;
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={contact.action}
              className="flex items-center gap-2 text-xs px-3 py-1 h-8"
              title={`${contact.label}: ${contact.value}`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{contact.label}</span>
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="font-medium text-gray-700 text-sm">Contacts disponibles :</h4>
      <div className="grid gap-2">
        {contacts.map((contact, index) => {
          const Icon = contact.icon;
          return (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{contact.label}</p>
                  <p className="text-xs text-gray-600">{contact.value}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={contact.action}
                className="text-xs"
              >
                Utiliser
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContactInfo; 