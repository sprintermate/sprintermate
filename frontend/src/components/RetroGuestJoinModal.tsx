import { useState } from 'react';

interface RetroGuestJoinModalProps {
  onJoin: (name: string) => void;
}

export default function RetroGuestJoinModal({ onJoin }: RetroGuestJoinModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('İsim gerekli');
      return;
    }
    setError('');
    onJoin(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-lg p-6 flex flex-col gap-4 w-full max-w-xs"
      >
        <h2 className="text-lg font-bold text-center">Retroya Katıl</h2>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Adınız"
          className="border rounded px-3 py-2 text-sm"
          autoFocus
        />
        {error && <div className="text-red-500 text-xs text-center">{error}</div>}
        <button
          type="submit"
          className="bg-indigo-600 text-white rounded px-4 py-2 font-semibold hover:bg-indigo-700 transition"
        >
          Katıl
        </button>
      </form>
    </div>
  );
}
