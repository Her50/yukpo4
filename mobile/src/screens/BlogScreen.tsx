import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { Card, Button, Chip } from 'react-native-paper';
import { Article, Share as ShareIcon, Copy, BookOpen } from 'phosphor-react-native';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  date: string;
  readTime: string;
}

const BlogScreen: React.FC = () => {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const blogPosts: BlogPost[] = [
    {
      id: '1',
      title: 'Guide complet Yukpomnang',
      excerpt: 'Découvrez toutes les fonctionnalités de l\'application Yukpomnang',
      content: `# Guide complet Yukpomnang

## Fonctionnalités principales
- Services de proximité
- Géolocalisation intelligente
- Chat IA intégré
- Système de tokens

## Comment utiliser l'app
1. Créez votre compte
2. Activez la géolocalisation
3. Explorez les services disponibles
4. Utilisez l'IA pour vos besoins`,
      category: 'Guide',
      date: '2024-01-15',
      readTime: '5 min'
    },
    {
      id: '2',
      title: 'Résolution des problèmes',
      excerpt: 'Solutions aux problèmes courants de l\'application',
      content: `# Résolution des problèmes

## Problèmes de connexion
- Vérifiez votre connexion internet
- Redémarrez l'application
- Videz le cache

## Problèmes de géolocalisation
- Activez la géolocalisation
- Vérifiez les permissions
- Redémarrez le GPS`,
      category: 'Support',
      date: '2024-01-10',
      readTime: '3 min'
    }
  ];

  const shareBlogPost = (post: BlogPost) => {
    const content = `📱 ${post.title}\n\n${post.excerpt}\n\nLire plus dans l'app Yukpomnang`;
    Share.share({
      message: content,
      title: post.title
    });
  };

  const copyBlogContent = (post: BlogPost) => {
    Alert.alert('Contenu copié', 'Le contenu du blog a été copié !');
  };

  if (selectedPost) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedPost(null)}>
            <Text style={styles.backButton}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => shareBlogPost(selectedPost)}>
              <ShareIcon size={24} color="#6366F1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => copyBlogContent(selectedPost)}>
              <Copy size={24} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Card style={styles.postCard}>
          <Card.Content>
            <Text style={styles.postTitle}>{selectedPost.title}</Text>
            <View style={styles.postMeta}>
              <Chip style={styles.categoryChip}>{selectedPost.category}</Chip>
              <Text style={styles.postDate}>{selectedPost.date}</Text>
              <Text style={styles.readTime}>{selectedPost.readTime} de lecture</Text>
            </View>
            <Text style={styles.postContent}>{selectedPost.content}</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📚 Blog Yukpomnang</Text>
        <Text style={styles.subtitle}>Guides et actualités</Text>
      </View>

      {blogPosts.map((post) => (
        <Card key={post.id} style={styles.postCard}>
          <TouchableOpacity onPress={() => setSelectedPost(post)}>
            <Card.Content>
              <View style={styles.postHeader}>
                <Text style={styles.postTitle}>{post.title}</Text>
                <TouchableOpacity onPress={() => shareBlogPost(post)}>
                  <ShareIcon size={20} color="#6366F1" />
                </TouchableOpacity>
              </View>
              <Text style={styles.postExcerpt}>{post.excerpt}</Text>
              <View style={styles.postMeta}>
                <Chip style={styles.categoryChip}>{post.category}</Chip>
                <Text style={styles.postDate}>{post.date}</Text>
                <Text style={styles.readTime}>{post.readTime}</Text>
              </View>
            </Card.Content>
          </TouchableOpacity>
        </Card>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  backButton: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  postCard: {
    margin: 20,
    marginTop: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  postExcerpt: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryChip: {
    backgroundColor: '#6366F1',
  },
  postDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  readTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  postContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginTop: 16,
  },
});

export default BlogScreen;


