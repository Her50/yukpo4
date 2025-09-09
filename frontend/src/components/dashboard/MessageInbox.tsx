// @generated
import React, { useEffect, useState } from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import ajouté

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
};

interface Props {
  userId: string;
}

const MessageInbox: React.FC<Props> = ({ userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/messages/${userId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Erreur réseau lors du chargement des messages.");
        }
        return res.json();
      })
      .then((data) => {
        setMessages(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-lg font-bold mb-4">📩 Messages reçus</h2>

      {loading && <p>Chargement des messages...</p>}
      {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}

      {!loading && !error && messages.length === 0 && (
        <p className="text-gray-500">Aucun message reçu.</p>
      )}

      <ul>
        {messages.map((msg) => (
          <li key={msg.id} className="border-b py-2">
            <p className="text-sm">{msg.content}</p>
            <p className="text-xs text-gray-500">
              Reçu le {new Date(msg.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center border-t pt-6">
        <a
          href={ROUTES.SERVICES}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
        >
          Contacter l'équipe Yukpomnang
        </a>
      </div>
    </div>
  );
};

export default MessageInbox;
