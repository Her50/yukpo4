import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';


export default function CommunicationPanel() {
  const [status, setStatus] = useState('');

  const sendAction = async (type: string) => {
    setStatus('⏳ Envoi en cours...');
    try {
      const res = await fetch(`/send/${type}`);
      const json = await res.json();
      setStatus(json.status || json.error || '✅ Action terminée');
    } catch (err) {
      setStatus('❌ Erreur réseau');
    }
  };

  const generatePdf = async () => {
    setStatus('⏳ Génération PDF...');
    try {
      const res = await fetch('/admin/generate-pdf');
      const json = await res.json();
      setStatus(json.status || json.error || '✅ PDF généré');
    } catch (err) {
      setStatus('❌ Erreur lors du PDF');
    }
  };

  return (
    <div className="">
      <h1 className="text-3xl font-bold text-center mb-10">
        📨 Centre Yukpomnang : Export & Partage
      </h1>

      <div className="">
        <button
          onClick={generatePdf}
          className=""
        >
          📄 Générer un PDF Yukpomnang
        </button>

        <button
          onClick={() => sendAction('email')}
          className=""
        >
          ✉️ Envoyer par Email
        </button>

        <button
          onClick={() => sendAction('whatsapp')}
          className=""
        >
          📲 Partager via WhatsApp
        </button>
      </div>

      {status && (
        <div className="mt-10 text-center font-semibold text-orange-700">
          {status}
        </div>
      )}

      <footer className="text-center text-sm text-gray-500 mt-20 border-t pt-6">
        Yukpomnang Connect — Communication multicanal © 2025
      </footer>
    </div>
  );
}