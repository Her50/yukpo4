/**
 * Composant pour initialiser le service de logging distant
 * Doit être placé dans AuthProvider pour avoir accès à l'utilisateur
 */

import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { remoteLoggingService } from '../services/remoteLoggingService';

const RemoteLoggingInitializer: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        // Initialiser avec l'ID utilisateur
        remoteLoggingService.setUserId(user?.id?.toString());
        
        // Activer le logging distant
        remoteLoggingService.setEnabled(true);
        
        console.log('[RemoteLoggingInitializer] ✅ Logging distant activé', {
            userId: user?.id,
            enabled: true
        });

        // Cleanup à la déconnexion
        return () => {
            remoteLoggingService.stop();
        };
    }, [user?.id]);

    return null; // Composant invisible
};

export default RemoteLoggingInitializer;

