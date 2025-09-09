import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapboxWrapper.css';

interface MapboxWrapperProps {
  accessToken: string;
  style?: string;
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: React.ReactNode;
}

export const MapboxWrapper: React.FC<MapboxWrapperProps> = ({
  accessToken,
  style = 'mapbox://styles/mapbox/streets-v12',
  center = [0, 0],
  zoom = 9,
  className = '',
  children
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Configurer Mapbox
    mapboxgl.accessToken = accessToken;

    // Créer la carte
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      center,
      zoom,
      // Options pour améliorer l'accessibilité
      attributionControl: true,
      customAttribution: '© YukpoMang',
      // Désactiver les animations pour les utilisateurs qui préfèrent moins de mouvement
      fadeDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300
    });

    // Ajouter les contrôles de navigation
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    }), 'top-right');

    // Gestionnaire d'erreurs
    map.current.on('error', (e) => {
      console.error('Erreur Mapbox:', e);
    });

    // Nettoyage
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [accessToken, style, center, zoom]);

  // Appliquer les styles de contraste élevé
  useEffect(() => {
    const applyHighContrastStyles = () => {
      if (!map.current) return;

      const mapContainer = map.current.getContainer();
      const controls = mapContainer.querySelectorAll('.mapboxgl-ctrl');
      
      controls.forEach((control) => {
        // Remplacer les styles obsolètes par les nouveaux standards
        if (control instanceof HTMLElement) {
          control.style.setProperty('--mapbox-control-bg', 'Canvas');
          control.style.setProperty('--mapbox-control-color', 'CanvasText');
        }
      });
    };

    // Appliquer les styles après le chargement de la carte
    if (map.current) {
      map.current.on('load', applyHighContrastStyles);
    }

    // Observer les changements de préférences de contraste
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    mediaQuery.addEventListener('change', applyHighContrastStyles);

    return () => {
      mediaQuery.removeEventListener('change', applyHighContrastStyles);
    };
  }, [map.current]);

  return (
    <div className={`mapbox-wrapper ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
      {children}
    </div>
  );
}; 