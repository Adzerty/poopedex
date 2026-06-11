import { useState } from 'react';
import type { RatingInput } from '../api/types';
import { StarRating } from './StarRating';

interface Props {
  onSubmit: (rating: RatingInput) => void;
  busy?: boolean;
}

const FLAGS = [
  { key: 'hasSoap', label: '🧼 Savon' },
  { key: 'hasToiletPaper', label: '🧻 Papier' },
  { key: 'hasBin', label: '🗑️ Poubelle' },
  { key: 'hasMenstrualProducts', label: '🩸 Protections hygiéniques' },
  { key: 'hasBabyChanging', label: '🍼 Table à langer' },
] as const;

export function RatingForm({ onSubmit, busy }: Props) {
  const [cleanliness, setCleanliness] = useState(0);
  const [safety, setSafety] = useState(0);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');

  const canSubmit = cleanliness > 0 && safety > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <StarRating label="Propreté" value={cleanliness} onChange={setCleanliness} />
        <StarRating label="Sécurité" value={safety} onChange={setSafety} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FLAGS.map((f) => {
          const on = !!flags[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFlags((prev) => ({ ...prev, [f.key]: !on }))}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                on ? 'border-amber-600 bg-amber-100 text-amber-900' : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <textarea
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
        placeholder="Commentaire (optionnel)"
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={() =>
          onSubmit({
            cleanliness,
            safety,
            hasSoap: !!flags.hasSoap,
            hasToiletPaper: !!flags.hasToiletPaper,
            hasBin: !!flags.hasBin,
            hasMenstrualProducts: !!flags.hasMenstrualProducts,
            hasBabyChanging: !!flags.hasBabyChanging,
            comment: comment.trim() || undefined,
          })
        }
        className="rounded-xl bg-amber-700 px-4 py-3 font-semibold text-white active:bg-amber-800 disabled:opacity-50"
      >
        {busy ? '…' : '💩 Enregistrer mon poop'}
      </button>
      {!canSubmit && <p className="text-center text-xs text-gray-400">Note la propreté et la sécurité pour valider.</p>}
    </div>
  );
}
