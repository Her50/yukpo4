﻿import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import { API_BASE_URL } from '@/config/api';

const ContactEnterprisePage: React.FC = () => {
  const [form, setForm] = useState({ nom: '', email: '', message: '' });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(${API_BASE_URL}/api/contact/entreprise', {
        method: 'POST',
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();
      setSuccess(res.ok);
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error);
      setSuccess(false);
    }

    setLoading(false);
  };

  return (
    <ResponsiveContainer>
      <div className="font-inter">
        <h1 className="text-3xl font-bold text-center mb-10">ðŸ“§ Contactez l'entreprise</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <input
              type="text"
              name="nom"
              value={form.nom}
              onChange={handleChange}
              className="w-full p-3 border rounded"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full p-3 border rounded"
              placeholder="Votre email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              className="w-full p-3 border rounded"
              placeholder="Votre message"
              rows={4}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded"
            disabled={loading}
          >
            {loading ? 'Envoi en cours...' : 'Envoyer le message'}
          </button>

          {success && (
            <div className="mt-4 text-green-600 text-center">
              âœ… Votre message a Ã©tÃ© envoyÃ© avec succÃ¨s !
            </div>
          )}
        </form>

        <RequireAccess plan="enterprise">
          <div className="mt-10 text-center">
            <p className="text-lg font-semibold">
              ðŸ” AccÃ©dez Ã  des fonctionnalitÃ©s Premium
            </p>
          </div>
        </RequireAccess>
      </div>
    </ResponsiveContainer>
  );
};

export default ContactEnterprisePage;
