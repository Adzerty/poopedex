import { allowedCheckinRadius } from '@poopedex/shared';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { useCheckin, useDeleteToilet, useProfile } from '../api/hooks';
import type { CheckinResult, RatingInput, ToiletSummary } from '../api/types';
import type { GeoPosition } from '../hooks/useGeolocation';
import { haversineM } from '../lib/geo';
import { RatingForm } from './RatingForm';

interface Props {
  toilet: ToiletSummary;
  position: GeoPosition | null;
  onClose: () => void;
  onCheckedIn: (result: CheckinResult) => void;
}

export function ToiletSheet({ toilet, position, onClose, onCheckedIn }: Props) {
  const checkin = useCheckin();
  const deleteToilet = useDeleteToilet();
  const { data: me } = useProfile();
  const isAdmin = me?.isAdmin === true;
  const [error, setError] = useState<string | null>(null);

  const distance = position ? haversineM(position.lat, position.lng, toilet.lat, toilet.lng) : null;
  const maxRadius = allowedCheckinRadius(position?.accuracy);
  // Admin : check-in possible peu importe la distance, mais la position GPS reste
  // requise pour envoyer le check-in (lat/lng obligatoires côté API).
  const inRange = distance !== null && (isAdmin || distance <= maxRadius);

  async function onDelete() {
    if (!window.confirm('Supprimer définitivement cette toilette ?')) return;
    setError(null);
    try {
      await deleteToilet.mutateAsync(toilet.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression');
    }
  }

  async function doCheckin(rating?: RatingInput) {
    if (!position) return;
    setError(null);
    try {
      const result = await checkin.mutateAsync({
        toiletId: toilet.id,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        rating,
      });
      onCheckedIn(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec du check-in');
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />

        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{toilet.name ?? 'Toilette publique'}</h2>
            <p className="text-sm text-gray-500">
              {toilet.avgOverall !== null ? `⭐ ${toilet.avgOverall.toFixed(1)}/5` : 'Pas encore notée'}
              {' · '}
              {toilet.poopsCount} poop{toilet.poopsCount > 1 ? 's' : ''}
            </p>
          </div>
          {toilet.collected && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">✓ Collectée</span>
          )}
        </div>

        <div className="my-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {distance === null
            ? 'Position inconnue…'
            : isAdmin
              ? `📍 ${Math.round(distance)} m — mode admin (distance ignorée)`
              : inRange
                ? `📍 Tu y es (${Math.round(distance)} m) — enregistre ton passage !`
                : `📍 Approche-toi : ${Math.round(distance)} m (max ${Math.round(maxRadius)} m)`}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteToilet.isPending}
            className="mb-3 w-full rounded-xl border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-700 active:bg-red-100 disabled:opacity-50"
          >
            🗑️ Supprimer cette toilette (admin)
          </button>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {inRange ? (
          <>
            <RatingForm onSubmit={doCheckin} busy={checkin.isPending} />
            <button
              type="button"
              disabled={checkin.isPending}
              onClick={() => doCheckin()}
              className="mt-3 w-full text-center text-sm text-gray-400 underline"
            >
              Juste enregistrer sans noter
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-gray-400">
            Rapproche-toi de la toilette pour pouvoir l'enregistrer.
          </p>
        )}
      </div>
    </div>
  );
}
