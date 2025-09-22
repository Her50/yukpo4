// Bouton de partage de service vers l'extérieur
// Génère des liens de partage avec redirection intelligente

import React, { useState } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Share2, 
  ExternalLink, 
  Copy, 
  Check,
  MessageCircle,
  Mail,
  Facebook,
  Twitter
} from 'lucide-react';
import { Service } from '@/types/service';

interface ShareServiceButtonProps {
  service: Service;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const ShareServiceButton: React.FC<ShareServiceButtonProps> = ({
  service,
  variant = 'outline',
  size = 'sm',
  showText = true,
  className = ''
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const generateShareUrl = (serviceId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/shared-service?serviceId=${serviceId}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Lien copié !",
        description: "Le lien de partage a été copié dans le presse-papiers.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien.",
        variant: "destructive",
      });
    }
  };

  const shareViaWhatsApp = () => {
    const shareUrl = generateShareUrl(service.id);
    const message = `Découvrez ce service sur Yukpo : ${service.data?.title || 'Service intéressant'}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message + ' ' + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareViaEmail = () => {
    const shareUrl = generateShareUrl(service.id);
    const subject = `Service intéressant : ${service.data?.title || 'Découvrez ce service'}`;
    const body = `Bonjour,\n\nJe vous partage ce service qui pourrait vous intéresser :\n\n${service.data?.title || 'Service'}\n${service.data?.description || ''}\n\nVoir le service : ${shareUrl}\n\nCordialement`;
    
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);
  };

  const shareViaFacebook = () => {
    const shareUrl = generateShareUrl(service.id);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };

  const shareViaTwitter = () => {
    const shareUrl = generateShareUrl(service.id);
    const text = `Découvrez ce service sur Yukpo : ${service.data?.title || 'Service intéressant'}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const handleQuickShare = () => {
    const shareUrl = generateShareUrl(service.id);
    copyToClipboard(shareUrl);
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      action: shareViaWhatsApp,
      color: 'text-green-600'
    },
    {
      name: 'Email',
      icon: Mail,
      action: shareViaEmail,
      color: 'text-blue-600'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      action: shareViaFacebook,
      color: 'text-blue-700'
    },
    {
      name: 'Twitter',
      icon: Twitter,
      action: shareViaTwitter,
      color: 'text-blue-400'
    }
  ];

  return (
    <div className="relative">
      <Button
        onClick={() => setShowShareOptions(!showShareOptions)}
        variant={variant}
        size={size}
        className={`flex items-center space-x-2 ${className}`}
      >
        <Share2 className="h-4 w-4" />
        {showText && <span>Partager</span>}
      </Button>

      {showShareOptions && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-3">
            <div className="text-sm font-medium text-gray-900 mb-3">
              Partager ce service
            </div>
            
            {/* Lien de partage */}
            <div className="mb-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={generateShareUrl(service.id)}
                  readOnly
                  className="flex-1 text-xs bg-gray-50 border rounded px-2 py-1"
                />
                <Button
                  onClick={handleQuickShare}
                  size="sm"
                  variant="ghost"
                  className="p-1"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Options de partage */}
            <div className="grid grid-cols-2 gap-2">
              {shareOptions.map((option) => (
                <Button
                  key={option.name}
                  onClick={option.action}
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-2 justify-start"
                >
                  <option.icon className={`h-4 w-4 ${option.color}`} />
                  <span className="text-sm">{option.name}</span>
                </Button>
              ))}
            </div>

            {/* Information sur la redirection */}
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
              <ExternalLink className="h-3 w-3 inline mr-1" />
              Les personnes non connectées seront redirigées vers l'inscription
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareServiceButton;
