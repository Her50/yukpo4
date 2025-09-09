import React from 'react';

function StarRating({ note }: { note: number }) {
  return (
    <div className="text-yellow-500 text-lg">
      {'★'.repeat(note)}
      {'☆'.repeat(5 - note)}
    </div>
  );
}

export default StarRating;
