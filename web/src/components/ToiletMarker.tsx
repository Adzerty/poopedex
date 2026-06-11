interface Props {
  collected: boolean;
  avgOverall: number | null;
}

/**
 * Marqueur de toilette lisible et visible : pastille blanche + anneau coloré
 * (vert si collectée, ambre sinon) + ombre, badge ✓, et pastille de note.
 * Le cercle de 40px est l'élément ancré ; badges en absolu pour ne pas décaler l'ancre.
 */
export function ToiletMarker({ collected, avgOverall }: Props) {
  const ring = collected ? 'ring-green-500' : 'ring-amber-600';
  return (
    <div className="relative h-10 w-10 cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-110">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-[0_2px_6px_rgba(0,0,0,0.4)] ring-[3px] ${ring}`}
      >
        🚽
      </div>

      {collected && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white ring-2 ring-white">
          ✓
        </span>
      )}

      {avgOverall !== null && (
        <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900/85 px-1.5 text-[10px] font-semibold leading-4 text-white shadow">
          ★ {avgOverall.toFixed(1)}
        </span>
      )}
    </div>
  );
}
