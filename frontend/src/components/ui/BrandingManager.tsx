import { Button } from '@/components/ui/buttons';
import { Crown, Flag, Upload, X } from 'lucide-react';
import React, { useRef } from 'react';

interface BrandingManagerProps {
    logo: string[];
    banner: string[];
    onLogoChange: (logo: string[]) => void;
    onBannerChange: (banner: string[]) => void;
    readonly?: boolean;
}

const BrandingManager: React.FC<BrandingManagerProps> = ({
    logo,
    banner,
    onLogoChange,
    onBannerChange,
    readonly = false
}) => {
    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File, type: 'logo' | 'banner') => {
        if (!file.type.startsWith('image/')) {
            alert('Veuillez sélectionner une image');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            if (type === 'logo') {
                onLogoChange([base64]);
            } else {
                onBannerChange([base64]);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">🎨 Identité Visuelle</h3>
                <p className="text-sm text-gray-600">Logo et bannière de votre service</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold text-gray-900">Logo</h4>
                    </div>

                    {!readonly && (
                        <button
                            onClick={() => logoInputRef.current?.click()}
                            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50 transition-all"
                        >
                            {logo.length > 0 ? (
                                <div className="relative">
                                    <img src={logo[0]} alt="Logo" className="w-32 h-32 object-contain mx-auto rounded" />
                                    <div className="mt-2 text-sm text-blue-600">Cliquer pour changer</div>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">Télécharger le logo</p>
                                    <p className="text-xs text-gray-500 mt-1">Format carré recommandé</p>
                                </>
                            )}
                        </button>
                    )}

                    {readonly && logo.length > 0 && (
                        <img src={logo[0]} alt="Logo" className="w-32 h-32 object-contain mx-auto rounded border" />
                    )}

                    {logo.length > 0 && !readonly && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLogoChange([])}
                            className="w-full text-red-600"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Supprimer le logo
                        </Button>
                    )}

                    <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'logo');
                        }}
                    />
                </div>

                {/* Bannière */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold text-gray-900">Bannière</h4>
                    </div>

                    {!readonly && (
                        <button
                            onClick={() => bannerInputRef.current?.click()}
                            className="w-full border-2 border-dashed border-purple-300 rounded-lg p-6 hover:border-purple-400 hover:bg-purple-50 transition-all"
                        >
                            {banner.length > 0 ? (
                                <div className="relative">
                                    <img src={banner[0]} alt="Bannière" className="w-full h-24 object-cover rounded" />
                                    <div className="mt-2 text-sm text-purple-600">Cliquer pour changer</div>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">Télécharger la bannière</p>
                                    <p className="text-xs text-gray-500 mt-1">Format rectangle recommandé (16:9)</p>
                                </>
                            )}
                        </button>
                    )}

                    {readonly && banner.length > 0 && (
                        <img src={banner[0]} alt="Bannière" className="w-full h-24 object-cover rounded border" />
                    )}

                    {banner.length > 0 && !readonly && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onBannerChange([])}
                            className="w-full text-red-600"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Supprimer la bannière
                        </Button>
                    )}

                    <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'banner');
                        }}
                    />
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-gray-700">
                    💡 <span className="font-semibold">Conseil :</span> Un logo professionnel et une belle bannière renforcent votre identité de marque
                </p>
            </div>
        </div>
    );
};

export default BrandingManager;

