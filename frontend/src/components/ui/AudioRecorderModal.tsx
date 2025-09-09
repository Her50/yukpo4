import React, { useState, useRef, useEffect } from 'react';

interface AudioRecorderModalProps {
  onClose: () => void;
  onConfirm: (file: { name: string; data: string; type: string }) => void;
}

const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({ onClose, onConfirm }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const visualize = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const draw = () => {
      animationFrameIdRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // Calculer le volume moyen
      let sum = 0;
      for(let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      const volume = (avg - 128) / 10; // Normaliser et amplifier un peu

      canvasCtx.fillStyle = '#f8fafc'; // bg-slate-50
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Changer la couleur en fonction du volume
      const blue = Math.max(0, 255 - volume * 25);
      const red = Math.min(255, volume * 25);
      canvasCtx.strokeStyle = `rgb(${red}, 80, ${blue})`;
      canvasCtx.lineWidth = 2;

      canvasCtx.beginPath();
      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };
    draw();
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      visualize(stream); // Démarrer la visualisation
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop()); // Libère le micro

        // Arrêter la visualisation et nettoyer
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      };
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioURL(null);
      setAudioBlob(null);
    } catch (err) {
      console.error("Erreur d'accès au microphone:", err);
      alert("Impossible d'accéder au microphone. Veuillez vérifier les autorisations de votre navigateur.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleConfirm = () => {
    if (audioBlob) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const audioFile = {
          name: `enregistrement-${Date.now()}.wav`,
          data: base64Data,
          type: 'audio/wav'
        };
        onConfirm(audioFile);
        onClose();
      };
      reader.readAsDataURL(audioBlob);
    }
  };

  // Nettoyage pour arrêter le stream si le composant est démonté
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      // Nettoyage de la visualisation
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Enregistreur Audio</h2>
        <div className="flex flex-col items-center gap-4">
          {!isRecording && !audioURL && (
            <button onClick={handleStartRecording} className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">
              Démarrer l'enregistrement
            </button>
          )}
          {isRecording && (
            <div className="flex flex-col items-center w-full gap-2">
                <p className="text-red-500 animate-pulse font-semibold">Enregistrement...</p>
                <canvas ref={canvasRef} className="w-full h-24 bg-slate-50 rounded-md border"></canvas>
                <button onClick={handleStopRecording} className="w-full px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600">
                    Arrêter l'enregistrement
                </button>
            </div>
          )}
          {audioURL && !isRecording && (
            <div className='w-full'>
              <p className='text-center mb-2'>Aperçu :</p>
              <audio src={audioURL} controls className="w-full" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400">Annuler</button>
          <button 
            onClick={handleConfirm} 
            disabled={!audioBlob}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Confirmer et Utiliser
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorderModal;
