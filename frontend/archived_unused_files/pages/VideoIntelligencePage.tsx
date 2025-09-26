import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import VideoLangDetector from '@/components/VideoLangDetector';

const VideoIntelligencePage = () => {
  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-2xl font-bold text-center mb-6">🎥 Intelligence Vidéo Yukpo</h1>
        <VideoLangDetector />
      </div>
    </AppLayout>
  );
};

export default VideoIntelligencePage;
