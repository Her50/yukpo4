// ✅ Étape 3 : IARecorder.tsx — Enregistrement vocal + injection dans le contexte IA
import React, { useState } from 'react';
import { Mic, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/buttons';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const IARecorder: React.FC<{ onTranscription: (texte: string) => void }> = ({ onTranscription }) => {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    recorder.ondataavailable = (e) => audioChunks.push(e.data);
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      try {
        const res = await fetch('/api/ia/transcrire', { method: 'POST', body: formData });
        const data = await res.json();
        onTranscription(data.transcription);
        toast({ title: '✅ Transcription réussie', description: 'Le texte a été injecté au contexte IA.' });
      } catch (e) {
        toast({ title: 'Erreur IA', description: 'Transcription échouée.', type: 'error' });
      }
    };

    recorder.start();
    setRecording(true);
    setMediaRecorder(recorder);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  return (
    <motion.div
      className="flex items-center gap-2 mt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Button onClick={recording ? stopRecording : startRecording} variant={recording ? 'destructive' : 'default'}>
        {recording ? <StopCircle className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
        {recording ? 'Arrêter' : 'Parler'}
      </Button>
    </motion.div>
  );
};

export default IARecorder;
