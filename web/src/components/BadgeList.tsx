import type { Badge } from '../api/types';

/**
 * Affiche tous les badges connus, séparés en débloqués / à débloquer.
 * Les verrouillés sont grisés avec une barre de progression vers leur cible.
 */
export function BadgeList({ badges, emptyHint }: { badges: Badge[]; emptyHint: string }) {
  if (badges.length === 0) {
    return <p className="text-sm text-amber-600">{emptyHint}</p>;
  }
  const unlocked = badges.filter((b) => b.unlockedAt);
  const locked = badges.filter((b) => !b.unlockedAt);

  return (
    <div className="flex flex-col gap-5">
      {unlocked.length > 0 && (
        <div data-testid="badges-unlocked" className="grid grid-cols-2 gap-3">
          {unlocked.map((b) => (
            <BadgeCard key={b.code} badge={b} unlocked />
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            À débloquer
          </h3>
          <div data-testid="badges-locked" className="grid grid-cols-2 gap-3">
            {locked.map((b) => (
              <BadgeCard key={b.code} badge={b} unlocked={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, unlocked }: { badge: Badge; unlocked: boolean }) {
  const { current, target } = badge.progress;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div
      data-testid={`badge-${badge.code}`}
      data-unlocked={unlocked ? 'true' : 'false'}
      className={
        'flex flex-col gap-2 rounded-2xl p-3 shadow-sm ' +
        (unlocked ? 'bg-white' : 'bg-white/60')
      }
    >
      <div className="flex items-center gap-3">
        <div className={'text-3xl ' + (unlocked ? '' : 'grayscale opacity-50')}>
          {badge.icon ?? '🏅'}
        </div>
        <div className="min-w-0">
          <div
            className={
              'text-sm font-semibold ' + (unlocked ? 'text-gray-900' : 'text-gray-500')
            }
          >
            {badge.name}
          </div>
          <div className="truncate text-xs text-gray-500">{badge.description}</div>
        </div>
      </div>

      {!unlocked && (
        <div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-right text-[10px] tabular-nums text-gray-500">
            {current.toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
}
