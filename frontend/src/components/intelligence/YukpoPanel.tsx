import React, { useState } from 'react';
import ChatInputPanel from './ChatInputPanel';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const YukpoPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (input: any) => {
    try {
      setLoading(true);
      const response = await axios.post("/api/yukpo/input-context", input);
      toast.success("Demande analysée avec succès !");
      console.log("Résultat IA:", response.data);
    } catch (error) {
      toast.error("Erreur lors de l’envoi !");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <ChatInputPanel onSubmit={handleSubmit} loading={loading} />
    </div>
  );
};

export default YukpoPanel;
