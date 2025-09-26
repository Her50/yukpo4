import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
      const res = await fetch(`${API_BASE_URL}/api/contact/entreprise`, {
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
      <View style="font-inter">
        <Text style="text-3xl font-bold text-center mb-10">ðŸ“§ Contactez l'entreprise</Text>

        <form onSubmit={handleSubmit} style="space-y-6">
          <View>
            <label style="block text-sm font-medium mb-1">Nom</label>
            <TextInput
              type="text"
              name="nom"
              value={form.nom}
              onChange={handleChange}
              style="w-full p-3 border rounded"
              placeholder="Votre nom"
            />
          </View>

          <View>
            <label style="block text-sm font-medium mb-1">Email</label>
            <TextInput
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              style="w-full p-3 border rounded"
              placeholder="Votre email"
            />
          </View>

          <View>
            <label style="block text-sm font-medium mb-1">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              style="w-full p-3 border rounded"
              placeholder="Votre message"
              rows={4}
            />
          </View>

          <TouchableOpacity
            type="submit"
            style="w-full py-3 bg-blue-600 text-white rounded"
            disabled={loading}
          >
            {loading ? 'Envoi en cours...' : 'Envoyer le message'}
          </TouchableOpacity>

          {success && (
            <View style="mt-4 text-green-600 text-center">
              âœ… Votre message a Ã©tÃ© envoyÃ© avec succÃ¨s !
            </View>
          )}
        </form>

        <RequireAccess plan="enterprise">
          <View style="mt-10 text-center">
            <Text style="text-lg font-semibold">
              ðŸ” AccÃ©dez Ã  des fonctionnalitÃ©s Premium
            </Text>
          </View>
        </RequireAccess>
      </View>
    </ResponsiveContainer>
  );
};

export default ContactEnterprisePage;





