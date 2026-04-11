import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLang } from '../context/LangContext'

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      const { lat, lng } = points[0]
      map.setView([lat, lng], Math.max(map.getZoom(), 8), { animate: true })
      return
    }
    const latLngs = points.map((p) => L.latLng(p.lat, p.lng))
    const b = L.latLngBounds(latLngs)
    map.fitBounds(b, { padding: [36, 36], maxZoom: 11, animate: true })
  }, [map, points])
  return null
}

function validCoord(p) {
  const lat = Number(p?.lat)
  const lng = Number(p?.lng)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export default function TradesMap({ posts, myLat, myLng, currentUserId }) {
  const { t } = useLang()

  const markers = useMemo(
    () => (posts || []).filter((p) => validCoord(p)),
    [posts]
  )

  const boundsPoints = useMemo(() => {
    const pts = markers.map((m) => ({ lat: Number(m.lat), lng: Number(m.lng) }))
    if (
      myLat != null &&
      myLng != null &&
      Number.isFinite(Number(myLat)) &&
      Number.isFinite(Number(myLng))
    ) {
      return [{ lat: Number(myLat), lng: Number(myLng) }, ...pts]
    }
    return pts
  }, [markers, myLat, myLng])

  const center = useMemo(() => {
    if (myLat != null && myLng != null && !Number.isNaN(myLat) && !Number.isNaN(myLng)) {
      return [myLat, myLng]
    }
    if (markers.length) {
      const la = markers.reduce((s, m) => s + Number(m.lat), 0) / markers.length
      const lo = markers.reduce((s, m) => s + Number(m.lng), 0) / markers.length
      return [la, lo]
    }
    return [20, 0]
  }, [myLat, myLng, markers])

  const zoom = markers.length ? 5 : 2

  if (!markers.length) {
    return (
      <div className="trades-map trades-map--empty" role="status">
        <p>{t('map_no_locations')}</p>
      </div>
    )
  }

  return (
    <div className="trades-map-wrap">
      <MapContainer
        className="trades-map"
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: 'min(52vh, 380px)', width: '100%', minHeight: 260 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={boundsPoints} />
        {myLat != null &&
          myLng != null &&
          !Number.isNaN(Number(myLat)) &&
          !Number.isNaN(Number(myLng)) && (
            <CircleMarker
              center={[myLat, myLng]}
              radius={11}
              pathOptions={{
                color: '#f8fafc',
                weight: 3,
                fillColor: '#1e4d8c',
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div className="trades-map-popup trades-map-popup--you">
                  <strong>{t('map_my_pos')}</strong>
                  <p className="trades-map-popup__hint">{t('map_distances_hint')}</p>
                </div>
              </Popup>
            </CircleMarker>
          )}
        {markers.map((p) => {
          const mine = p.user_id === currentUserId
          return (
            <CircleMarker
              key={p.id}
              center={[Number(p.lat), Number(p.lng)]}
              radius={mine ? 10 : 9}
              pathOptions={{
                color: mine ? '#f8fafc' : '#c41e3a',
                weight: mine ? 2 : 2,
                fillColor: mine ? '#0a3161' : '#1e4d8c',
                fillOpacity: 0.92,
              }}
            >
              <Popup>
                <div className="trades-map-popup">
                  <p className="trades-map-popup__deal">
                    <span className="trades-map-popup__label">{t('map_offer')}</span>{' '}
                    <strong>#{p.offer_card}</strong>
                  </p>
                  <p className="trades-map-popup__deal">
                    <span className="trades-map-popup__label">{t('map_want')}</span>{' '}
                    <strong>#{p.want_card}</strong>
                  </p>
                  <p className="trades-map-popup__user">
                    {t('user_prefix')} {String(p.user_id).slice(0, 6)}…
                  </p>
                  {!mine ? (
                    <Link
                      className="btn btn--primary btn--sm trades-map-popup__cta"
                      to={`/chat?partner=${p.user_id}`}
                    >
                      {t('map_go_chat')}
                    </Link>
                  ) : (
                    <p className="trades-map-popup__hint">{t('map_my_post_hint')}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
