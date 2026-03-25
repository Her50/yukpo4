import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeIcon from '../components/SafeIcon';
import { modernColors } from '../theme/modernTheme';

const BlogScreen: React.FC = () => {
    const { t } = useLanguageSafe();

    const openBlogUrl = () => {
        Linking.openURL('https://yukpomnang.com/blog');
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <SafeIcon name="file-text" size={32} color={modernColors.primary} />
                    <Text style={styles.title}>{t('blog.title') || 'Blog Yukpo'}</Text>
                    <Text style={styles.subtitle}>{t('blog.subtitle') || 'Actualités et articles sur Yukpo'}</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('blog.comingSoon') || 'Bientôt disponible'}</Text>
                        <Text style={styles.sectionText}>
                            {t('blog.comingSoonText') || 'Le blog Yukpo avec toutes nos actualités sera bientôt accessible dans l\'application.'}
                        </Text>
                        <TouchableOpacity style={styles.blogBtn} onPress={openBlogUrl}>
                            <SafeIcon name="external-link" size={16} color="#fff" />
                            <Text style={styles.blogBtnText}>{t('blog.visitWebsite') || 'Visiter le site web'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    content: {
        padding: 20,
    },
    section: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    sectionText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    blogBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    blogBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
});

export default BlogScreen;
