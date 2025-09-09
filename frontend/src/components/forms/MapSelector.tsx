import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map, Marker, MapMouseEvent } from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { Button } from '@/components/ui/buttons';
import { Select } from '@/components/ui/select';
import { X } from 'lucide-react';

mapboxgl.accessToken = 'pk.eyJ1IjoiaGVybmFuZGV6ODciLCJhIjoiY21hdDJnbzh6MDJpeDJsc2gyeDZwNTVxMCJ9.YXFT01T6B9sMX9Wj8WJmvQ';

type MapStyleKey = 'streets' | 'satellite' | 'dark';

const mapStyles: Record<MapStyleKey, string> = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

interface PointData {
  coord: string;
  type: 'gps_fixe' | 'gps_dynamique';
}

export interface MapSelectorProps {
  googleApiKey: string;
  onSitesChange: (coords: string[]) => void;
  defaultCoords?: string[];
  label?: string;
}

const MapSelector: React.FC<MapSelectorProps> = ({
  googleApiKey,
  onSitesChange,
  defaultCoords = [],
  label = 'Localisation des sites'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('satellite');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [points, setPoints] = useState<PointData[]>([]);
  const [currentCoord, setCurrentCoord] = useState<string | null>(null);

  const getPreciseLocation = async (): Promise<[number, number] | null> => {
    try {
      const res = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${googleApiKey}`, { method: 'POST' });
      const data = await res.json();
      return [data.location.lat, data.location.lng];
    } catch {
      alert("Impossible d'obtenir la localisation GPS exacte");
      return null;
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyles[mapStyle],
      center: [9.7861, 4.0615],
      zoom: 13,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    mapRef.current = map;

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken || '',
      mapboxgl: mapboxgl as any,
      marker: false,
      placeholder: '🔍 Rechercher une adresse...',
    }) as any;

    map.addControl(geocoder);

    defaultCoords.forEach((coordStr) => {
      const [lat, lng] = coordStr.split(',').map(Number);
      const marker = new mapboxgl.Marker({ color: 'blue' })
        .setLngLat([lng, lat])
        .addTo(map);
      setMarkers((prev) => [...prev, marker]);
      setPoints((prev) => [...prev, { coord: coordStr, type: 'gps_fixe' }]);
    });

    if (defaultCoords.length > 0) {
      const [lat, lng] = defaultCoords[0].split(',').map(Number);
      map.flyTo({ center: [lng, lat], zoom: 15 });
    }

    geocoder.on('result', (e: any) => {
      const [lng, lat] = e.result.center;
      const coordStr = `${lat},${lng}`;
      setCurrentCoord(coordStr);
      map.flyTo({ center: [lng, lat], zoom: 15 });
    });

    map.on('click', (e: MapMouseEvent) => {
      const coordStr = `${e.lngLat.lat},${e.lngLat.lng}`;
      setCurrentCoord(coordStr);
    });

    map.on('load', async () => {
      const precise = await getPreciseLocation();
      if (precise) {
        const [lat, lng] = precise;
        const marker = new mapboxgl.Marker({ color: 'red' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setText('📍 Ma position'))
          .addTo(map);
        setMarkers((prev) => [...prev, marker]);
        setPoints((prev) => [...prev, { coord: `${lat},${lng}`, type: 'gps_dynamique' }]);
        map.flyTo({ center: [lng, lat], zoom: 16 });
      }
    });

    return () => map.remove();
  }, [mapStyle]);

  const addPoint = () => {
    if (!currentCoord) return;
    const [lat, lng] = currentCoord.split(',').map(Number);
    const marker = new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText(`Ajouté : ${currentCoord}`))
      .addTo(mapRef.current!);
    setMarkers((prev) => [...prev, marker]);
    setPoints((prev) => [...prev, { coord: currentCoord, type: 'gps_fixe' }]);
    setCurrentCoord(null);
  };

  const removePoint = (index: number) => {
    markers[index].remove();
    setMarkers((prev) => prev.filter((_, i) => i !== index));
    const updated = points.filter((_, i) => i !== index);
    setPoints(updated);
    onSitesChange(updated.map(p => p.coord));
  };

  const updateType = (index: number, newType: 'gps_fixe' | 'gps_dynamique') => {
    const updated = [...points];
    updated[index].type = newType;
    setPoints(updated);
  };

  useEffect(() => {
    onSitesChange(points.map(p => p.coord));
  }, [points]);

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground">
        Cliquez sur la carte ou utilisez la recherche pour sélectionner un point. Validez ensuite avec le bouton.
      </p>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">🗺️ Style :</span>
        <Select
          defaultValue={mapStyle}
          onValueChange={(value: string) => setMapStyle(value as MapStyleKey)}
          options={[
            { label: 'Satellite', value: 'satellite' },
            { label: 'Rue', value: 'streets' },
            { label: 'Nuit', value: 'dark' },
          ]}
        />
        <Button disabled={!currentCoord} onClick={addPoint}>
          📍 Ajouter ce point
        </Button>
      </div>

      <div ref={mapContainerRef} className="h-96 rounded border shadow" />

      <div className="space-y-2">
        <h4 className="text-sm font-bold">📋 Points sélectionnés :</h4>
        {points.map((pt, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-gray-100 p-2 rounded text-sm"
          >
            <span>{pt.coord}</span>
            <div className="flex items-center gap-2">
              <Select
                defaultValue={pt.type}
                onValueChange={(val: string) =>
                  updateType(idx, val as 'gps_fixe' | 'gps_dynamique')
                }
                options={[
                  { label: 'GPS Fixe', value: 'gps_fixe' },
                  { label: 'GPS Dynamique', value: 'gps_dynamique' },
                ]}
              />
              <Button size="icon" variant="ghost" onClick={() => removePoint(idx)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          markers.forEach((m) => m.remove());
          setMarkers([]);
          setPoints([]);
        }}
      >
        🔄 Réinitialiser tous les points
      </Button>
    </div>
  );
};

export default MapSelector;
