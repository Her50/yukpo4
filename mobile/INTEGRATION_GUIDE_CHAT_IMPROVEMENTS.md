# 🚀 Guide d'Intégration - Améliorations ChatModal

Ce guide explique comment intégrer les nouvelles fonctionnalités dans `ChatModalMobile.tsx`.

---

## 📦 Composants Créés

1. **MessageReactions.tsx** - Réactions rapides aux messages
2. **AudioMessageWaveform.tsx** - Waveform pour messages vocaux
3. **MessageStatusIndicator.tsx** - Double check (lu/non lu)
4. **SwipeableMessage.tsx** - Actions par swipe
5. **DateSeparator.tsx** - Séparateurs de date

---

## 🔧 Intégration Étape par Étape

### 1. Imports dans ChatModalMobile.tsx

```typescript
// Ajouter en haut du fichier
import MessageReactions from './chat/MessageReactions';
import AudioMessageWaveform from './chat/AudioMessageWaveform';
import MessageStatusIndicator from './chat/MessageStatusIndicator';
import SwipeableMessage from './chat/SwipeableMessage';
import DateSeparator from './chat/DateSeparator';
import * as Haptics from 'expo-haptics';
```

### 2. États pour les Réactions

```typescript
// Ajouter dans les états du composant
const [messageReactions, setMessageReactions] = useState<Record<string, Array<{
    emoji: string;
    count: number;
    users: Array<{ id: number; name: string; avatar?: string }>;
}>>>({});
```

### 3. Fonctions de Gestion des Réactions

```typescript
// Ajouter ces fonctions dans le composant
const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
        // Mettre à jour localement
        setMessageReactions(prev => {
            const reactions = prev[messageId] || [];
            const existingIndex = reactions.findIndex(r => r.emoji === emoji);
            
            if (existingIndex >= 0) {
                // Ajouter l'utilisateur à la réaction existante
                const updated = [...reactions];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    count: updated[existingIndex].count + 1,
                    users: [...updated[existingIndex].users, {
                        id: user?.id || 0,
                        name: user?.name || 'Vous',
                        avatar: user?.avatar
                    }]
                };
                return { ...prev, [messageId]: updated };
            } else {
                // Nouvelle réaction
                return {
                    ...prev,
                    [messageId]: [...reactions, {
                        emoji,
                        count: 1,
                        users: [{
                            id: user?.id || 0,
                            name: user?.name || 'Vous',
                            avatar: user?.avatar
                        }]
                    }]
                };
            }
        });

        // Envoyer au backend via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'add_reaction',
                messageId,
                emoji,
                userId: user?.id
            }));
        }
    } catch (error) {
        console.error('Erreur ajout réaction:', error);
    }
};

const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
        setMessageReactions(prev => {
            const reactions = prev[messageId] || [];
            const updated = reactions.map(r => {
                if (r.emoji === emoji) {
                    return {
                        ...r,
                        count: r.count - 1,
                        users: r.users.filter(u => u.id !== user?.id)
                    };
                }
                return r;
            }).filter(r => r.count > 0);
            
            return { ...prev, [messageId]: updated };
        });

        // Envoyer au backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'remove_reaction',
                messageId,
                emoji,
                userId: user?.id
            }));
        }
    } catch (error) {
        console.error('Erreur suppression réaction:', error);
    }
};
```

### 4. Grouper les Messages par Date

```typescript
// Fonction utilitaire pour grouper les messages
const groupMessagesByDate = (messages: any[]) => {
    const grouped: Array<{ date: Date; messages: any[] }> = [];
    let currentDate: Date | null = null;
    let currentGroup: any[] = [];

    messages.forEach((message, index) => {
        const messageDate = new Date(message.timestamp);
        messageDate.setHours(0, 0, 0, 0);

        if (!currentDate || messageDate.getTime() !== currentDate.getTime()) {
            // Nouvelle date
            if (currentGroup.length > 0) {
                grouped.push({ date: currentDate!, messages: currentGroup });
            }
            currentDate = messageDate;
            currentGroup = [message];
        } else {
            currentGroup.push(message);
        }

        // Dernier message
        if (index === messages.length - 1) {
            grouped.push({ date: currentDate!, messages: currentGroup });
        }
    });

    return grouped;
};
```

### 5. Modifier le Rendu des Messages

Remplacer la section de rendu des messages dans le `ScrollView` :

```typescript
{/* Messages */}
<ScrollView
    ref={scrollViewRef}
    style={styles.messagesContainer}
    contentContainerStyle={styles.messagesContent}
    showsVerticalScrollIndicator={false}
>
    {groupMessagesByDate(messages).map((group, groupIndex) => (
        <React.Fragment key={`group-${groupIndex}`}>
            <DateSeparator date={group.date} />
            {group.messages.map((message) => (
                <SwipeableMessage
                    key={message.id}
                    onSwipeLeft={() => setReplyingTo({
                        id: message.id,
                        sender_name: message.from === 'client' ? user?.name : nomPrestataire,
                        content: message.content,
                        content_type: message.type || 'text',
                        imageUrl: message.imageUrl,
                        audioUrl: message.audioUrl,
                        fileUrl: message.fileUrl
                    })}
                    onSwipeRight={message.from === 'client' && message.editable
                        ? () => handleDeleteMessage(message.id)
                        : undefined
                    }
                    canDelete={message.from === 'client' && message.editable}
                >
                    <View
                        style={[
                            styles.messageContainer,
                            message.from === 'client' ? styles.messageContainerRight : styles.messageContainerLeft
                        ]}
                    >
                        <View style={[
                            styles.messageBubble,
                            message.from === 'client' ? styles.messageBubbleRight : styles.messageBubbleLeft
                        ]}>
                            {/* Contenu du message existant */}
                            {editingMessageId === message.id ? (
                                // ... code d'édition existant
                            ) : (
                                <>
                                    {/* Images */}
                                    {message.type === 'image' && message.imageUrl && (
                                        <Image
                                            source={{ uri: message.imageUrl }}
                                            style={styles.messageImage}
                                            resizeMode="cover"
                                        />
                                    )}

                                    {/* Audio avec waveform */}
                                    {message.type === 'audio' && message.audioUrl && (
                                        <AudioMessageWaveform
                                            audioUrl={message.audioUrl}
                                            duration={message.duration}
                                            isFromClient={message.from === 'client'}
                                        />
                                    )}

                                    {/* Fichiers */}
                                    {message.type === 'file' && message.fileUrl && (
                                        <View style={styles.fileContainer}>
                                            <SafeIcon name="file" size={20} color={message.from === 'client' ? '#FFFFFF' : modernColors.primary} />
                                            <Text style={[
                                                styles.fileText,
                                                message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                            ]}>
                                                Document
                                            </Text>
                                        </View>
                                    )}

                                    {/* Message cité */}
                                    {message.reply_to && (
                                        <View style={styles.quotedMessage}>
                                            {/* ... code existant */}
                                        </View>
                                    )}

                                    {/* Texte */}
                                    {(message.type === 'text' || (message.content && !message.content.match(/^[📷🎤📎]/))) && (
                                        <Text style={[
                                            styles.messageText,
                                            message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                        ]}>
                                            {message.content}
                                        </Text>
                                    )}

                                    {/* Footer avec statut */}
                                    <View style={styles.messageFooter}>
                                        <View style={styles.messageFooterLeft}>
                                            <MessageStatusIndicator
                                                status={message.status || 'sent'}
                                                timestamp={message.timestamp}
                                                isFromClient={message.from === 'client'}
                                            />
                                            <TouchableOpacity
                                                style={styles.replyButton}
                                                onPress={() => setReplyingTo({
                                                    id: message.id,
                                                    sender_name: message.from === 'client' ? user?.name : nomPrestataire,
                                                    content: message.content,
                                                    content_type: message.type || 'text',
                                                    imageUrl: message.imageUrl,
                                                    audioUrl: message.audioUrl,
                                                    fileUrl: message.fileUrl
                                                })}
                                            >
                                                <SafeIcon name="corner-up-right" size={14} color={modernColors.textSecondary} />
                                                <Text style={styles.replyButtonText}>Répondre</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {message.from === 'client' && message.editable && (
                                            <View style={styles.messageActions}>
                                                <TouchableOpacity
                                                    style={styles.messageActionButton}
                                                    onPress={() => startEditing(message)}
                                                >
                                                    <SafeIcon name="edit" size={14} color={modernColors.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.messageActionButton}
                                                    onPress={() => handleDeleteMessage(message.id)}
                                                >
                                                    <SafeIcon name="trash" size={14} color={modernColors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* Réactions */}
                                    <MessageReactions
                                        messageId={message.id}
                                        reactions={messageReactions[message.id] || []}
                                        currentUserId={user?.id || 0}
                                        onAddReaction={handleAddReaction}
                                        onRemoveReaction={handleRemoveReaction}
                                    />
                                </>
                            )}
                        </View>
                    </View>
                </SwipeableMessage>
            ))}
        </React.Fragment>
    ))}

    {/* Indicateur de frappe */}
    {prestataireTyping && (
        <View style={styles.typingContainer}>
            {/* ... code existant */}
        </View>
    )}
</ScrollView>
```

### 6. Gérer les Réactions depuis WebSocket

Dans `useWebSocketChat.ts`, ajouter la gestion des réactions :

```typescript
case 'reaction_added':
    // Mettre à jour les réactions du message
    setMessageReactions(prev => {
        const reactions = prev[data.messageId] || [];
        // ... logique d'ajout
        return { ...prev, [data.messageId]: updatedReactions };
    });
    break;

case 'reaction_removed':
    // Mettre à jour les réactions du message
    setMessageReactions(prev => {
        // ... logique de suppression
        return { ...prev, [data.messageId]: updatedReactions };
    });
    break;
```

### 7. Installation des Dépendances

```bash
# Haptic feedback (déjà dans Expo)
# Vérifier que expo-haptics est installé
npm install expo-haptics
```

### 8. Styles Supplémentaires

Ajouter dans les styles existants :

```typescript
// Styles pour les réactions (déjà dans MessageReactions.tsx)
// Styles pour waveform (déjà dans AudioMessageWaveform.tsx)
// Styles pour swipe (déjà dans SwipeableMessage.tsx)
```

---

## 🎯 Points d'Attention

1. **Performance**: Le groupement par date se fait à chaque render. Considérer l'utilisation de `useMemo`.

2. **WebSocket**: S'assurer que le backend supporte les événements `reaction_added` et `reaction_removed`.

3. **Haptic Feedback**: Tester sur différents appareils. Certains Android peuvent ne pas supporter.

4. **Waveform**: La génération de waveform est simulée. Pour la production, utiliser une lib comme `wavesurfer.js` ou générer côté serveur.

5. **Accessibilité**: Ajouter des labels pour les actions de swipe.

---

## ✅ Checklist d'Intégration

- [ ] Imports ajoutés
- [ ] États pour réactions créés
- [ ] Fonctions de gestion des réactions implémentées
- [ ] Groupement par date fonctionnel
- [ ] SwipeableMessage intégré
- [ ] MessageStatusIndicator remplace l'ancien système
- [ ] AudioMessageWaveform remplace l'affichage audio basique
- [ ] MessageReactions ajouté sous chaque message
- [ ] WebSocket mis à jour pour les réactions
- [ ] Haptic feedback testé
- [ ] Tests sur iOS et Android

---

## 🚀 Prochaines Étapes

Une fois ces améliorations intégrées, passer aux fonctionnalités suivantes :
- Prévisualisation de liens
- Recherche dans la conversation
- Formatage de texte
- Messages épinglés

