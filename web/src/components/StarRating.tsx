interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function StarRating({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-2xl leading-none ${n <= value ? 'opacity-100' : 'opacity-25'}`}
            aria-label={`${label} : ${n} étoiles`}
          >
            ⭐
          </button>
        ))}
      </div>
    </div>
  );
}
