import React from 'react';

function AddRatingForm() {
  return (
    <form className="p-4 border rounded shadow-md max-w-sm">
      <label className="block mb-2">
        Votre note :
        <input
          type="number"
          min="1"
          max="5"
          className="block mt-1 border p-2 rounded w-full"
        />
      </label>
      <button
        type="submit"
        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Envoyer
      </button>
    </form>
  );
}

export default AddRatingForm;
