import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const AdminAnalyticsPanel: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const [responseMessage, setResponseMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/contact/entreprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setResponseMessage('✅ Votre message a été envoyé avec succès !');
      } else {
        setResponseMessage("❌ Erreur lors de l'envoi. Essayez à nouveau.");
      }
    } catch (error) {
      setResponseMessage('⚠️ Une erreur est survenue. Essayez à nouveau.');
    }
  };

  return (
    <RequireAccess plan="enterprise">
      <ResponsiveContainer className="py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">📩 Contactez l'entreprise</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-xl space-y-6 border"
        >
          <div>
            <label className="font-medium text-sm mb-1 block">Nom</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border rounded"
              required
            />
          </div>

          <div>
            <label className="font-medium text-sm mb-1 block">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-3 border rounded"
              required
            />
          </div>

          <div>
            <label className="font-medium text-sm mb-1 block">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full p-3 border rounded"
              rows={4}
              placeholder="Votre message..."
              required
            />
          </div>

          <button
            type="submit"
            className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded"
          >
            Envoyer
          </button>

          {responseMessage && (
            <p className="mt-4 text-center text-gray-700">{responseMessage}</p>
          )}
        </form>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default AdminAnalyticsPanel;
