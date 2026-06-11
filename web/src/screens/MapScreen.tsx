import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import { ApiError } from '../api/client';
import { useAddToilet, useNearbyToilets } from '../api/hooks';
import type { CheckinResult, ToiletSummary } from '../api/types';
import { ToiletMarker } from '../components/ToiletMarker';
import { ToiletSheet } from '../components/ToiletSheet';
import { useGeolocation } from '../hooks/useGeolocation';

/**
 * Retire toutes les couches de POI du fond OpenFreeMap (schéma OpenMapTiles :
 * source-layer "poi") pour que seuls NOS marqueurs toilettes ressortent.
 * On garde routes, eau et noms de lieux pour le repère.
 */
function declutterBaseMap(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
    if (layer.type === 'symbol' && sourceLayer === 'poi' && map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  }
}

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';

export function MapScreen() {
  const { position, error: geoError } = useGeolocation();
  const { data: toilets } = useNearbyToilets(position, 1500);
  const addToilet = useAddToilet();
  const [selected, setSelected] = useState<ToiletSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const centered = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function onAddToilet() {
    if (!position) return showToast('Position GPS requise pour ajouter une toilette.');
    const name = window.prompt('Nom de la toilette (optionnel)')?.trim() || undefined;
    try {
      await addToilet.mutateAsync({ lat: position.lat, lng: position.lng, name });
      showToast('🚽 Toilette ajoutée ! Merci 🙏');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Échec de l'ajout");
    }
  }

  // Centre la carte sur l'utilisateur au premier fix GPS — une fois la carte chargée
  // (sinon flyTo est ignoré sur une carte non prête et le recentrage est raté).
  useEffect(() => {
    if (mapLoaded && position && !centered.current) {
      mapRef.current?.flyTo({ center: [position.lng, position.lat], zoom: 16 });
      centered.current = true;
    }
  }, [mapLoaded, position]);

  function onCheckedIn(result: CheckinResult) {
    setSelected(null);
    const badge = result.newBadges[0];
    showToast(
      badge
        ? `🏅 Badge débloqué : ${badge.name} !`
        : result.newlyCollected
          ? '✓ Nouvelle toilette collectée !'
          : '💩 Poop enregistré !',
    );
  }

  return (
    <div className="relative h-dvh w-full">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 2.3522, latitude: 48.8566, zoom: 12 }}
        onLoad={(e) => {
          declutterBaseMap(e.target);
          setMapLoaded(true);
        }}
      >
        {/* Position de l'utilisateur */}
        {position && (
          <Marker longitude={position.lng} latitude={position.lat}>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/25">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-md" />
            </div>
          </Marker>
        )}

        {/* Toilettes alentour */}
        {toilets?.map((t) => (
          <Marker
            key={t.id}
            longitude={t.lng}
            latitude={t.lat}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(t);
            }}
          >
            <ToiletMarker collected={t.collected} avgOverall={t.avgOverall} />
          </Marker>
        ))}
      </Map>

      {/* Boutons flottants : recentrer + ajouter une toilette ici */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => position && mapRef.current?.flyTo({ center: [position.lng, position.lat], zoom: 16 })}
          className="rounded-full bg-white p-3 shadow-lg active:bg-gray-100"
          aria-label="Recentrer"
        >
          🎯
        </button>
        <button
          onClick={onAddToilet}
          disabled={addToilet.isPending}
          className="rounded-full bg-amber-700 p-3 text-white shadow-lg active:bg-amber-800 disabled:opacity-50"
          aria-label="Ajouter une toilette ici"
          title="Ajouter une toilette ici"
        >
          ➕
        </button>
      </div>

      {geoError && (
        <div className="absolute left-4 right-4 top-4 z-10 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
          Géolocalisation indisponible : {geoError}
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {selected && (
        <ToiletSheet
          toilet={selected}
          position={position}
          onClose={() => setSelected(null)}
          onCheckedIn={onCheckedIn}
        />
      )}
    </div>
  );
}
