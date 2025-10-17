import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import VideoLangDetector from '@/components/VideoLangDetector';

const VideoIntelligencePage = () => {
  return (
    <AppLayout padding>
      <View style="max-w-4xl mx-auto py-8">
        <Text style="text-2xl font-bold text-center mb-6">🎥 Intelligence Vidéo Yukpo</Text>
        <VideoLangDetector />
      </View>
    </AppLayout>
  );
};

export default VideoIntelligencePage;





