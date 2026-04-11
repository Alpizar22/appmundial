const R_KM = 6371

/** Distancia en km entre dos puntos WGS84 (Haversine). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R_KM * c
}

export function formatDistanceKm(km) {
  if (km == null || Number.isNaN(km)) return '—'
  if (km < 0.05) return '< 50 m'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toLocaleString('es', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`
}

export function requestCurrentPosition() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
    )
  })
}
