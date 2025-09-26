import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Avatar,
    Card,
    IconButton,
    Text,
    TextInput
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { aiService } from '../../services/api';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    images?: string[];
}

const AIChatScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Bonjour ! Je suis votre assistant IA Yukpomnang. Comment puis-je vous aider aujourd\'hui ?',
            isUser: false,
            timestamp: new Date(),
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<string[]>([]);

    useEffect(() => {
        // Scroll to bottom when new messages are added
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputText.trim() && images.length === 0) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date(),
            images: images.length > 0 ? [...images] : undefined,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setImages([]);
        setLoading(true);

        try {
            const response = await aiService.processRequest({
                text: inputText,
                images: images,
                userId: user?.id,
            });

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response.data.response || 'Désolé, je n\'ai pas pu traiter votre demande.',
                isUser: false,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Désolé, une erreur est survenue. Veuillez réessayer.',
                isUser: false,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleImagePicker = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
            });

            if (!result.canceled) {
                const newImages = result.assets.map(asset => asset.uri);
                setImages(prev => [...prev, ...newImages]);
            }
        } catch (error) {
            console.error('Erreur lors de la sélection d\'images:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View style={[
            styles.messageContainer,
            item.isUser ? styles.userMessage : styles.aiMessage
        ]}>
            <Avatar.Text
                size={32}
                label={item.isUser ? (user?.name?.charAt(0) || 'U') : 'AI'}
                style={[
                    styles.avatar,
                    item.isUser ? styles.userAvatar : styles.aiAvatar
                ]}
            />
            <Card style={[
                styles.messageCard,
                item.isUser ? styles.userMessageCard : styles.aiMessageCard
            ]}>
                <Card.Content style={styles.messageContent}>
                    <Text style={[
                        styles.messageText,
                        item.isUser ? styles.userMessageText : styles.aiMessageText
                    ]}>
                        {item.text}
                    </Text>

                    {item.images && item.images.length > 0 && (
                        <View style={styles.messageImages}>
                            {item.images.map((image, index) => (
                                <Text key={index} style={styles.imagePlaceholder}>
                                    📷 Image {index + 1}
                                </Text>
                            ))}
                        </View>
                    )}

                    <Text style={[
                        styles.timestamp,
                        item.isUser ? styles.userTimestamp : styles.aiTimestamp
                    ]}>
                        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Card.Content>
            </Card>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chat IA</Text>
                <IconButton
                    icon="information"
                    onPress={() => navigation.navigate('AIHub' as never)}
                />
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                ListFooterComponent={
                    loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#2563eb" />
                            <Text style={styles.loadingText}>IA en train de répondre...</Text>
                        </View>
                    ) : null
                }
            />

            {/* Images Preview */}
            {images.length > 0 && (
                <View style={styles.imagesPreview}>
                    <FlatList
                        data={images}
                        renderItem={({ item, index }) => (
                            <View style={styles.imagePreviewItem}>
                                <Text style={styles.imagePreviewText}>Image {index + 1}</Text>
                                <IconButton
                                    icon="close"
                                    size={16}
                                    onPress={() => removeImage(index)}
                                />
                            </View>
                        )}
                        keyExtractor={(_, index) => index.toString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                    />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inputContainer}
            >
                <View style={styles.inputRow}>
                    <IconButton
                        icon="camera"
                        onPress={handleImagePicker}
                        style={styles.imageButton}
                    />

                    <TextInput
                        style={styles.textInput}
                        placeholder="Tapez votre message..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={1000}
                    />

                    <IconButton
                        icon="send"
                        onPress={handleSendMessage}
                        disabled={(!inputText.trim() && images.length === 0) || loading}
                        style={styles.sendButton}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffffff',
        elevation: 2,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    userMessage: {
        justifyContent: 'flex-end',
    },
    aiMessage: {
        justifyContent: 'flex-start',
    },
    avatar: {
        marginHorizontal: 8,
    },
    userAvatar: {
        backgroundColor: '#2563eb',
    },
    aiAvatar: {
        backgroundColor: '#10b981',
    },
    messageCard: {
        maxWidth: '80%',
        elevation: 1,
    },
    userMessageCard: {
        backgroundColor: '#2563eb',
    },
    aiMessageCard: {
        backgroundColor: '#ffffff',
    },
    messageContent: {
        padding: 12,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    userMessageText: {
        color: '#ffffff',
    },
    aiMessageText: {
        color: '#1e293b',
    },
    messageImages: {
        marginTop: 8,
    },
    imagePlaceholder: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 12,
        marginTop: 4,
    },
    userTimestamp: {
        color: '#dbeafe',
    },
    aiTimestamp: {
        color: '#94a3b8',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#64748b',
    },
    imagesPreview: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingVertical: 8,
    },
    imagePreviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        marginHorizontal: 4,
    },
    imagePreviewText: {
        fontSize: 12,
        color: '#64748b',
        marginRight: 4,
    },
    inputContainer: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
    },
    imageButton: {
        margin: 0,
    },
    textInput: {
        flex: 1,
        marginHorizontal: 8,
        maxHeight: 100,
    },
    sendButton: {
        margin: 0,
    },
});

export default AIChatScreen;

