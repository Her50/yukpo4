// Script d'activation automatique du mode développeur
(function() {
    console.log('🔧 Activation automatique du mode développeur...');
    
    // Activer le mode développeur
    localStorage.setItem('__DEV_FAKE_USER__', 'true');
    
    // Créer un message de confirmation
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    message.textContent = '✅ Mode développeur activé !';
    
    // Ajouter le message à la page
    document.body.appendChild(message);
    
    // Supprimer le message après 3 secondes
    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 3000);
    
    console.log('✅ Mode développeur activé avec succès !');
    console.log('💡 Vérification :', localStorage.getItem('__DEV_FAKE_USER__'));
    
    // Recharger la page après 1 seconde
    setTimeout(() => {
        window.location.reload();
    }, 1000);
})(); 