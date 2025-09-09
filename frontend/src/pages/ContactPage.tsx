// src/pages/ContactPage.tsx
import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Mail } from "lucide-react";

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ nom: "", email: "", message: "" });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700)); // simulate API
    setSuccess(true);
    setForm({ nom: "", email: "", message: "" });
    setLoading(false);
  };

  return (
    <AppLayout>
      <section className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-pink-50 dark:from-gray-900 dark:to-gray-950 py-20">
        <ResponsiveContainer className="max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 dark:text-white flex justify-center items-center gap-2">
              📬 Contactez-nous
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              Une question ? Une collaboration ? Écrivez-nous simplement ici.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 mx-auto space-y-6 w-full max-w-2xl"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <input
                name="nom"
                placeholder="Votre nom"
                value={form.nom}
                onChange={handleChange}
                required
                className="flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-yellow-400 outline-none dark:bg-gray-800 dark:border-gray-700"
              />
              <input
                type="email"
                name="email"
                placeholder="Votre email"
                value={form.email}
                onChange={handleChange}
                required
                className="flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-yellow-400 outline-none dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            <textarea
              name="message"
              placeholder="Votre message..."
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-yellow-400 outline-none dark:bg-gray-800 dark:border-gray-700"
            />

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-8 rounded-full transition-all shadow"
              >
                <Mail size={18} />
                {loading ? "Envoi..." : "Envoyer"}
              </button>
            </div>

            {success && (
              <p className="text-green-600 text-sm mt-4 text-center animate-pulse">
                ✅ Message envoyé avec succès !
              </p>
            )}
          </form>
        </ResponsiveContainer>
      </section>
    </AppLayout>
  );
};

export default ContactPage;
