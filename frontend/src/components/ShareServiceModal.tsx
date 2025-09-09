import React from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Facebook, Share2, X, MessageCircle, Twitter, Mail, Link } from 'lucide-react';

interface ShareServiceModalProps {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  titre?: string;
}

const getServiceUrl = (serviceId: string) => `${window.location.origin}/service/${serviceId}`;

const ShareServiceModal: React.FC<ShareServiceModalProps> = ({ open, onClose, serviceId, titre }) => {
  const url = getServiceUrl(serviceId);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast({
      title: "✅ Lien copié !",
      description: "Le lien a été copié dans votre presse-papiers"
    });
  };

  const handleShare = (platform: 'whatsapp' | 'facebook' | 'twitter' | 'email' | 'linkedin' | 'telegram') => {
    let shareUrl = '';
    const serviceTitle = titre || 'Service Yukpo';
    const serviceDescription = `Découvrez ce service exceptionnel sur Yukpo : ${serviceTitle}`;
    const fullText = `${serviceDescription}\n\n${url}`;
    
    switch (platform) {
      case 'whatsapp':
        // WhatsApp avec numéro de téléphone optionnel
        shareUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
        break;
      case 'facebook':
        // Facebook avec métadonnées
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(serviceDescription)}`;
        break;
      case 'twitter':
        // Twitter avec hashtags
        const twitterText = `${serviceDescription}\n\n#Yukpo #Services #Cameroun\n\n${url}`;
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;
        break;
      case 'linkedin':
        // LinkedIn avec métadonnées professionnelles
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'telegram':
        // Telegram avec bot ou lien direct
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(serviceDescription)}`;
        break;
      case 'email':
        // Email avec sujet et corps structuré
        const emailSubject = `Service Yukpo : ${serviceTitle}`;
        const emailBody = `Bonjour,\n\nJe vous partage ce service intéressant sur Yukpo :\n\n${serviceTitle}\n\n${url}\n\nCordialement`;
        shareUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        break;
    }
    
    // Ouvrir dans une nouvelle fenêtre avec des dimensions appropriées
    const windowFeatures = 'width=600,height=400,scrollbars=yes,resizable=yes';
    window.open(shareUrl, '_blank', windowFeatures);
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: titre || 'Service Yukpo',
        text: `Découvrez ce service exceptionnel sur Yukpo : ${titre || 'Service Yukpo'}`,
        url,
      }).then(() => {
        toast({
          title: "✅ Partage réussi !",
          description: "Le service a été partagé avec succès"
        });
      }).catch((error) => {
        console.log('Erreur de partage natif:', error);
        // Fallback vers la copie
        handleCopy();
      });
    } else {
      handleCopy();
    }
  };

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-auto relative animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            Partager ce service
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* URL Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Lien du service
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onFocus={e => e.target.select()}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopy}
                className="shrink-0"
                title="Copier le lien"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Partager sur
            </h3>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                className="w-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                onClick={() => handleShare('whatsapp')}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                onClick={() => handleShare('facebook')}
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
              
              <Button
                className="w-full bg-sky-500 hover:bg-sky-600 text-white transition-colors"
                onClick={() => handleShare('twitter')}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              
              <Button
                className="w-full bg-blue-700 hover:bg-blue-800 text-white transition-colors"
                onClick={() => handleShare('linkedin')}
              >
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </Button>
              
              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                onClick={() => handleShare('telegram')}
              >
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </Button>
              
              <Button
                className="w-full bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                onClick={() => handleShare('email')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          {/* Native Share */}
          <div className="pt-2">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all duration-200"
              onClick={handleNativeShare}
            >
              <Link className="h-4 w-4 mr-2" />
              Partage natif
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareServiceModal; 