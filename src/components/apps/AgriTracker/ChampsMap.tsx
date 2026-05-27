'use client'

/**
 * ChampsMap — Carte interactive des champs d'une plantation.
 * Utilise Leaflet + OpenStreetMap (gratuit, sans clé API).
 * Importé via next/dynamic({ ssr: false }) car Leaflet nécessite window.
 */

// CSS Leaflet importé directement (bundlé par webpack, pas de CDN fragile)
import 'leaflet/dist/leaflet.css'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import type { Champ, PhotoTerrain } from './types'

interface Props {
  champs: Champ[]
  /** Photos terrain avec coordonnées GPS — affichées en marqueurs oranges */
  photos?: PhotoTerrain[]
  /** Si true, la carte est en lecture seule (acheteur) */
  readOnly?: boolean
  height?: string
  /** Callback déclenché après un maintien long sur la carte */
  onLongPress?: (lat: number, lon: number) => void
  /** Durée du maintien en secondes avant déclenchement (défaut: 10) */
  longPressSecs?: number
  /** ID du champ à mettre en surbrillance (hover depuis les cartes) */
  highlightedChampId?: string
  /** Point GPS animé (pulsation) — hover card ou marqueur formulaire */
  pulsedPoint?: { lat: number; lon: number }
}

// ─── Popup builders (outside component, pure functions) ───────────────────────

function _champPopup(champ: Champ & { coordonnees: { lat: number; lon: number } }, readOnly: boolean): string {
  return `
    <div style="font-family:system-ui,sans-serif;min-width:180px">
      <div style="font-weight:600;font-size:14px;margin-bottom:4px">🌾 ${champ.nom}</div>
      <div style="font-size:12px;color:#059669;margin-bottom:2px">🌿 ${champ.produit_faostat}</div>
      ${champ.variete ? `<div style="font-size:11px;color:#6b7280">Variété : ${champ.variete}</div>` : ''}
      ${champ.superficie_ha != null ? `<div style="font-size:11px;color:#6b7280">📐 ${champ.superficie_ha} ha</div>` : ''}
      <div style="font-size:10px;color:#9ca3af;margin-top:4px">
        📍 ${champ.coordonnees.lat.toFixed(5)}, ${champ.coordonnees.lon.toFixed(5)}
      </div>
      ${!readOnly ? `<a href="https://maps.google.com/?q=${champ.coordonnees.lat},${champ.coordonnees.lon}" target="_blank"
        style="font-size:11px;color:#3b82f6;text-decoration:none;display:block;margin-top:6px">
        Ouvrir dans Google Maps →</a>` : ''}
    </div>
  `
}

function _photoPopup(photo: PhotoTerrain & { latitude: number; longitude: number }): string {
  const date = new Date(photo.date_prise).toLocaleDateString('fr-FR')
  return `
    <div style="font-family:system-ui,sans-serif;min-width:160px">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">📷 Photo terrain</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:2px">📅 ${date}</div>
      ${photo.type_sujet ? `<div style="font-size:11px;color:#6b7280">🏷️ ${photo.type_sujet}</div>` : ''}
      ${photo.produit ? `<div style="font-size:11px;color:#059669">🌿 ${photo.produit}</div>` : ''}
      ${photo.commentaire ? `<div style="font-size:11px;color:#374151;margin-top:3px;font-style:italic">${photo.commentaire}</div>` : ''}
      <div style="font-size:10px;color:#9ca3af;margin-top:4px">
        📍 ${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}
      </div>
    </div>
  `
}

export default function ChampsMap({
  champs,
  photos = [],
  readOnly = false,
  height = '380px',
  onLongPress,
  longPressSecs = 10,
  highlightedChampId,
  pulsedPoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  // Refs des marqueurs champs, indexés par champ.id
  const markerRefsRef = useRef<Map<string, LeafletMarker>>(new Map())
  // Marqueur animé (pulsation) — séparé pour ne pas être supprimé lors des refresh
  const pulsedMarkerRef = useRef<LeafletMarker | null>(null)

  const champsWithCoords = champs.filter(
    (c): c is Champ & { coordonnees: { lat: number; lon: number } } =>
      c.coordonnees != null && typeof c.coordonnees.lat === 'number' && typeof c.coordonnees.lon === 'number'
  )

  const photosWithCoords = photos.filter(
    (p): p is PhotoTerrain & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  )

  // ── Init carte (une seule fois) ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    import('leaflet').then((L) => {
      // Fix icônes Leaflet avec webpack (chemins cassés par défaut)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!containerRef.current || mapRef.current) return

      const defaultCenter: [number, number] =
        champsWithCoords.length > 0
          ? [champsWithCoords[0].coordonnees.lat, champsWithCoords[0].coordonnees.lon]
          : photosWithCoords.length > 0
            ? [photosWithCoords[0].latitude, photosWithCoords[0].longitude]
            : [6.8276, -5.2893]

      const hasPoints = champsWithCoords.length > 0 || photosWithCoords.length > 0
      const zoom = hasPoints ? 13 : 7

      const map = L.map(containerRef.current, { preferCanvas: true }).setView(defaultCenter, zoom)
      mapRef.current = map

      // Tuiles OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // ResizeObserver — invalide la carte dès que le conteneur change de taille
      // (résout le problème de carte noire lors du changement d'onglet)
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.invalidateSize()
      })
      ro.observe(containerRef.current)

      // Fallback timeout au cas où ResizeObserver ne se déclenche pas
      setTimeout(() => { map.invalidateSize() }, 200)

      // Marqueurs verts pour chaque champ avec coordonnées
      markerRefsRef.current.clear()
      champsWithCoords.forEach((champ) => {
        const marker = L.marker([champ.coordonnees.lat, champ.coordonnees.lon]).addTo(map)
        marker.bindPopup(_champPopup(champ, readOnly))
        markerRefsRef.current.set(champ.id, marker)
      })

      // Marqueurs oranges pour les photos avec coordonnées GPS
      photosWithCoords.forEach((photo) => {
        L.circleMarker([photo.latitude, photo.longitude], {
          radius: 9, fillColor: '#f97316', color: '#c2410c', weight: 2, opacity: 1, fillOpacity: 0.9,
        }).addTo(map).bindPopup(_photoPopup(photo))
      })

      // Ajuster la vue pour englober tous les marqueurs
      const allCoords: [number, number][] = [
        ...champsWithCoords.map(c => [c.coordonnees.lat, c.coordonnees.lon] as [number, number]),
        ...photosWithCoords.map(p => [p.latitude, p.longitude] as [number, number]),
      ]
      if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] })
      }

      // ─── Long-press GPS pin drop ─────────────────────────────────────────────
      if (onLongPress) {
        let timer: ReturnType<typeof setTimeout> | null = null
        let progressMarker: LeafletMarker | null = null

        const cancelPress = () => {
          if (timer) { clearTimeout(timer); timer = null }
          if (progressMarker) { map.removeLayer(progressMarker); progressMarker = null }
        }

        map.on('mousedown', (e: L.LeafletMouseEvent) => {
          const latlng = e.latlng
          if (!latlng) return
          cancelPress()

          progressMarker = L.marker(latlng, {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid #f97316;background:rgba(249,115,22,0.15);animation:agri-longpress ${longPressSecs}s linear forwards;transform:translate(-50%,-50%)"></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })
          }).addTo(map)

          timer = setTimeout(() => {
            onLongPress(latlng.lat, latlng.lng)
            if (progressMarker) { map.removeLayer(progressMarker); progressMarker = null }
            L.popup().setLatLng(latlng).setContent('📍 Position définie').openOn(map)
            setTimeout(() => map.closePopup(), 1500)
          }, longPressSecs * 1000)
        })

        map.on('mouseup mousemove', cancelPress)
      }

      return () => { ro.disconnect() }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mise à jour des marqueurs quand les champs ou photos changent ────────────
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then((L) => {
      if (!mapRef.current) return
      const map = mapRef.current

      // Supprimer tous les marqueurs et cercles existants (sauf marqueur pulsé)
      const pulsedMs = pulsedMarkerRef.current
      map.eachLayer((layer) => {
        if (layer === pulsedMs) return
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer)
      })

      // Reconstruire les refs
      markerRefsRef.current.clear()

      // Marqueurs verts — champs
      champsWithCoords.forEach((champ) => {
        const marker = L.marker([champ.coordonnees.lat, champ.coordonnees.lon]).addTo(map)
        marker.bindPopup(_champPopup(champ, readOnly))
        markerRefsRef.current.set(champ.id, marker)
      })

      // Marqueurs oranges — photos
      photosWithCoords.forEach((photo) => {
        L.circleMarker([photo.latitude, photo.longitude], {
          radius: 9, fillColor: '#f97316', color: '#c2410c', weight: 2, opacity: 1, fillOpacity: 0.9,
        }).addTo(map).bindPopup(_photoPopup(photo))
      })

      const allCoords: [number, number][] = [
        ...champsWithCoords.map(c => [c.coordonnees.lat, c.coordonnees.lon] as [number, number]),
        ...photosWithCoords.map(p => [p.latitude, p.longitude] as [number, number]),
      ]
      if (allCoords.length === 1) {
        map.setView(allCoords[0], 14)
      } else if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] })
      }
    })
  }, [champs, photos, readOnly, champsWithCoords, photosWithCoords])

  // ── Marqueur pulsé (hover card ou GPS formulaire) ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current) return
      if (pulsedMarkerRef.current) {
        mapRef.current.removeLayer(pulsedMarkerRef.current)
        pulsedMarkerRef.current = null
      }
      if (!pulsedPoint) return
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#f97316;border:2px solid #fff;animation:agri-pulse 1.1s ease-in-out infinite;transform:translate(-50%,-50%);box-shadow:0 0 0 0 rgba(249,115,22,0.7)"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      })
      const m = L.marker([pulsedPoint.lat, pulsedPoint.lon], { icon, zIndexOffset: 1000 }).addTo(mapRef.current)
      pulsedMarkerRef.current = m
      mapRef.current.panTo([pulsedPoint.lat, pulsedPoint.lon], { animate: true, duration: 0.3 })
    })
  }, [pulsedPoint])

  // ── Surbrillance au hover — pan vers le champ + ouvre son popup ─────────────
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (!highlightedChampId) {
      map.closePopup()
      return
    }

    const marker = markerRefsRef.current.get(highlightedChampId)
    if (!marker) return

    map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 })
    // Petit délai pour laisser le pan se terminer avant d'ouvrir le popup
    const t = setTimeout(() => { marker.openPopup() }, 450)
    return () => clearTimeout(t)
  }, [highlightedChampId])

  // Toujours rendre le conteneur pour que containerRef soit disponible dès le montage.
  // Si on faisait un early return conditionnel ici, le useEffect([],...) s'exécuterait
  // avec containerRef.current === null et la carte ne serait jamais initialisée.
  // Le message "pas de coordonnées" est affiché en overlay à la place.
  const noCoords = champsWithCoords.length === 0 && photosWithCoords.length === 0 && !onLongPress

  return (
    <div
      style={{ height, position: 'relative' }}
      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <style>{`
        @keyframes agri-longpress { from { transform: translate(-50%,-50%) scale(0.3); opacity:0.8; } to { transform: translate(-50%,-50%) scale(3); opacity:0; } }
        @keyframes agri-pulse {
          0%   { transform: translate(-50%,-50%) scale(1);   box-shadow: 0 0 0 0 rgba(249,115,22,0.7); }
          70%  { transform: translate(-50%,-50%) scale(1.45); box-shadow: 0 0 0 12px rgba(249,115,22,0); }
          100% { transform: translate(-50%,-50%) scale(1);   box-shadow: 0 0 0 0 rgba(249,115,22,0); }
        }
      `}</style>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
      />
      {/* Overlay "pas de coordonnées" — affiché par-dessus le conteneur (toujours monté) */}
      {noCoords && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/90 text-gray-400 dark:text-gray-500 gap-2 rounded-xl">
          <div className="text-3xl">🗺️</div>
          <p className="text-sm">Aucune coordonnée GPS disponible</p>
          <p className="text-xs">Ajoutez des coordonnées à vos champs ou géolocalisez vos photos</p>
        </div>
      )}
    </div>
  )
}
