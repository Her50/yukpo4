// @generated
import React, { useState } from 'react';
import axios from 'axios';

interface Props {
  serviceId: number;
}

const VoteForm: React.FC<Props> = ({ serviceId }) => {
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    try {
      await axios.post('/api/votes', {
        user_id: 1,
        service_id: serviceId,
        rating,
        comment,
      });
      alert('✅ Vote enregistré !');
    } catch (error) {
      alert('Erreur lors de l’enregistrement du vote.');
    }
  };

  return (
    <div className="border p-4 rounded shadow mt-4">
      <h3 className="font-semibold mb-2">Donnez votre avis</h3>
      <label className="block mb-1">Note :</label>
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="border p-1 mb-2"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} ★
          </option>
        ))}
      </select>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Votre commentaire"
        className="w-full border p-2 mb-2"
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        Envoyer
      </button>
    </div>
  );
};

export default VoteForm;
