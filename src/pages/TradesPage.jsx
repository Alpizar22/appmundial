import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { TOTAL_CARDS } from '../constants'
import { formatDistanceKm, haversineKm, requestCurrentPosition } from '../lib/geo'

const TradesMap = lazy(() => import('../components/TradesMap.jsx'))

function shortUser(id) {
  if (!id) return '—'
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function TradesPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offer, setOffer] = useState('')
  const [want, setWant] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saveLocationOnPublish, setSaveLocationOnPublish] = useState(true)
  const [geoHint, setGeoHint] = useState('')
  const [myPos, setMyPos] = useState(null)

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('trade_posts')
      .select('id, user_id, offer_card, want_card, created_at, active, lat, lng')
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else {
      setPosts(data || [])
      setError('')
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      await refresh()
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pos = await requestCurrentPosition()
      if (!cancelled && pos) setMyPos(pos)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const distanceForPost = useCallback(
    (p) => {
      if (!myPos || myPos.lat == null || myPos.lng == null) return null
      if (p.lat == null || p.lng == null) return null
      const la = Number(p.lat)
      const lo = Number(p.lng)
      if (Number.isNaN(la) || Number.isNaN(lo)) return null
      return haversineKm(myPos.lat, myPos.lng, la, lo)
    },
    [myPos]
  )

  const geoPostsCount = useMemo(() => posts.filter((p) => p.lat != null && p.lng != null).length, [posts])

  async function handlePublish(e) {
    e.preventDefault()
    const o = parseInt(offer, 10)
    const w = parseInt(want, 10)
    if (Number.isNaN(o) || o < 1 || o > TOTAL_CARDS) {
      setError(`La carta ofrecida debe estar entre 1 y ${TOTAL_CARDS}.`)
      return
    }
    if (Number.isNaN(w) || w < 1 || w > TOTAL_CARDS) {
      setError(`La carta buscada debe estar entre 1 y ${TOTAL_CARDS}.`)
      return
    }
    if (o === w) {
      setError('La carta ofrecida y la buscada deben ser distintas.')
      return
    }
    setSubmitting(true)
    setError('')
    setGeoHint('')

    let loc = null
    if (saveLocationOnPublish) {
      loc = await requestCurrentPosition()
      if (!loc) {
        setGeoHint(
          'No pudimos leer tu ubicación (permiso denegado o no disponible). El anuncio se publica igual, sin coordenadas.'
        )
      }
    }

    const row = {
      user_id: user.id,
      offer_card: o,
      want_card: w,
      active: true,
    }
    if (loc) {
      row.lat = loc.lat
      row.lng = loc.lng
    }

    const { error: err } = await supabase.from('trade_posts').insert(row)
    setSubmitting(false)
    if (err) setError(err.message)
    else {
      setOffer('')
      setWant('')
      await refresh()
    }
  }

  async function retirePost(id) {
    const { error: err } = await supabase.from('trade_posts').delete().eq('id', id).eq('user_id', user.id)
    if (err) setError(err.message)
    else await refresh()
  }

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  return (
    <div className="page trades">
      <header className="page-header">
        <h1>Intercambios</h1>
        <p>
          Publicá con tu ubicación (opcional) para ver distancias y mapa. El navegador pedirá permiso al
          publicar si activás guardar ubicación.
        </p>
      </header>

      <section className="trade-form-section">
        <h2>Nueva publicación</h2>
        <form className="trade-form" onSubmit={handlePublish}>
          <div className="trade-form__row">
            <label className="field">
              <span>Ofrezco la carta n.º</span>
              <input
                type="number"
                min={1}
                max={TOTAL_CARDS}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                required
                placeholder="Ej. 120"
              />
            </label>
            <span className="trade-form__arrow" aria-hidden="true">
              →
            </span>
            <label className="field">
              <span>Busco la carta n.º</span>
              <input
                type="number"
                min={1}
                max={TOTAL_CARDS}
                value={want}
                onChange={(e) => setWant(e.target.value)}
                required
                placeholder="Ej. 305"
              />
            </label>
          </div>
          <label className="trade-form__check field field--row">
            <input
              type="checkbox"
              checked={saveLocationOnPublish}
              onChange={(e) => setSaveLocationOnPublish(e.target.checked)}
            />
            <span>Guardar mi ubicación en esta publicación (latitud / longitud)</span>
          </label>
          {error && <p className="form-error">{error}</p>}
          {geoHint && <p className="form-success trade-geo-hint">{geoHint}</p>}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Publicando…' : 'Publicar intercambio'}
          </button>
        </form>
      </section>

      <section className="trade-map-section">
        <div className="trade-map-section__head">
          <h2>Mapa de coleccionistas</h2>
          <span className="trade-map-section__badge">{geoPostsCount} con ubicación</span>
        </div>
        <Suspense
          fallback={
            <div className="trades-map trades-map--empty" aria-busy="true">
              Cargando mapa…
            </div>
          }
        >
          <TradesMap posts={posts} myLat={myPos?.lat} myLng={myPos?.lng} currentUserId={user.id} />
        </Suspense>
        {myPos == null && (
          <p className="trade-map-footnote">
            Permití ubicación en el navegador para centrar el mapa en vos y ver distancias en la lista.
          </p>
        )}
      </section>

      <section className="trade-list-section">
        <h2>Anuncios activos</h2>
        {posts.length === 0 ? (
          <p className="empty-state">Aún no hay publicaciones.</p>
        ) : (
          <ul className="trade-list">
            {posts.map((p) => {
              const mine = p.user_id === user.id
              const date = new Date(p.created_at).toLocaleString('es')
              const d = mine ? null : distanceForPost(p)
              const distLabel = mine ? '—' : formatDistanceKm(d)
              const hasGeo = p.lat != null && p.lng != null
              return (
                <li key={p.id} className={`trade-card${mine ? ' trade-card--mine' : ''}`}>
                  <div className="trade-card__body">
                    <p className="trade-card__deal">
                      <strong>Ofrezco #{p.offer_card}</strong>
                      <span className="trade-card__sep">por</span>
                      <strong>busco #{p.want_card}</strong>
                    </p>
                    <p className="trade-card__meta">
                      {mine ? (
                        <span className="trade-card__badge">Tu publicación</span>
                      ) : (
                        <span>Usuario {shortUser(p.user_id)}</span>
                      )}
                      <span>{date}</span>
                      {hasGeo && (
                        <span className="trade-card__geo" title={mine ? 'Tu anuncio' : 'Distancia desde tu ubicación'}>
                          {mine ? 'Ubicación guardada' : `≈ ${distLabel}`}
                        </span>
                      )}
                      {!hasGeo && <span className="trade-card__geo trade-card__geo--muted">Sin ubicación</span>}
                    </p>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => retirePost(p.id)}
                    >
                      Quitar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
