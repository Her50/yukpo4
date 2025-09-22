import { Button } from '@/components/ui/buttons/Button';
import { Phone, Video, X } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface VideoCallNotificationProps {
    call: {
        id: string;
        fromUserId: number;
        fromUserName: string;
        serviceId: string;
        timestamp: Date;
        status: 'ringing' | 'answered' | 'declined' | 'missed';
    };
    onAnswer: (callId: string) => void;
    onDecline: (callId: string) => void;
    onDismiss: (callId: string) => void;
}

const VideoCallNotification: React.FC<VideoCallNotificationProps> = ({
    call,
    onAnswer,
    onDecline,
    onDismiss
}) => {
    const navigate = useNavigate();

    const handleAnswer = () => {
        onAnswer(call.id);
        navigate(`/video-call?service=${call.serviceId}&user=${call.fromUserId}`);
    };

    const handleDecline = () => {
        onDecline(call.id);
    };

    const handleDismiss = () => {
        onDismiss(call.id);
    };

    if (call.status !== 'ringing') {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm animate-pulse">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <Video className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Appel vidéo entrant</h3>
                        <p className="text-sm text-gray-600">{call.fromUserName}</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={handleAnswer}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                    <Phone className="w-4 h-4 mr-2" />
                    Répondre
                </Button>
                <Button
                    onClick={handleDecline}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                >
                    <X className="w-4 h-4 mr-2" />
                    Refuser
                </Button>
            </div>
        </div>
    );
};

export default VideoCallNotification;
