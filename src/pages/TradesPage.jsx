import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { TOTAL_CARDS } from '../constants'
import { formatDistanceKm, haversineKm, requestCurrentPosition } from '../lib/geo'
import { getJugador } from '../data/jugadores'

const TradesMap = lazy(() => import('../components/TradesMap.jsx'))

function shortUser(id) {
  if (!id) return '—'
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function TradesPage() {
  const { user } = useAuth()
  const { t, locale } = useLang()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offer, setOffer] = useState('')
  const [want, setWant] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saveLocationOnPublish, setSaveLocationOnPublish] = useState(true)
  const [geoHint, setGeoHint] = useState('')
  const [myPos, setMyPos] = useState(null)
  const [dupes, setDupes] = useState([])

  const loadDupes = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('card_number, quantity')
      .eq('user_id', user.id)
      .gt('quantity', 1)
      .order('card_number')
    if (!err) setDupes(data || [])
  }, [user.id])

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
      if (alive) {
        await loadDupes()
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [refresh, loadDupes])

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

  const geoPostsCount = useMemo(
    () => posts.filter((p) => p.lat != null && p.lng != null).length,
    [posts]
  )

  async function handlePublish(e) {
    e.preventDefault()
    const o = parseInt(offer, 10)
    const w = parseInt(want, 10)
    if (Number.isNaN(o) || o < 1 || o > TOTAL_CARDS) {
      setError(t('err_offer_range', { total: TOTAL_CARDS }))
      return
    }
    if (Number.isNaN(w) || w < 1 || w > TOTAL_CARDS) {
      setError(t('err_want_range', { total: TOTAL_CARDS }))
      return
    }
    if (o === w) {
      setError(t('err_same_card'))
      return
    }
    setSubmitting(true)
    setError('')
    setGeoHint('')

    let loc = null
    if (saveLocationOnPublish) {
      loc = await requestCurrentPosition()
      if (!loc) {
        setGeoHint(t('geo_denied'))
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
      await loadDupes()
    }
  }

  async function retirePost(id) {
    const { error: err } = await supabase
      .from('trade_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (err) setError(err.message)
    else {
      await refresh()
      await loadDupes()
    }
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
        <h1>{t('trades_title')}</h1>
        <p>{t('trades_subtitle')}</p>
      </header>

      <section className="trade-form-section">
        <h2>{t('new_post')}</h2>
        <form className="trade-form" onSubmit={handlePublish}>
          {dupes.length > 0 && (
            <div className="trade-dup-pick">
              <p className="trade-dup-pick__title">{t('dupe_pick_title')}</p>
              <div className="trade-dup-chips" role="list">
                {dupes.map((d) => {
                  const j = getJugador(d.card_number)
                  const active = offer === String(d.card_number)
                  return (
                    <button
                      key={d.card_number}
                      type="button"
                      role="listitem"
                      className={`trade-dup-chip${active ? ' trade-dup-chip--active' : ''}`}
                      onClick={() => setOffer(String(d.card_number))}
                    >
                      <span className="trade-dup-chip__num">#{d.card_number}</span>
                      <span className="trade-dup-chip__name">{j.nombre}</span>
                      <span className="trade-dup-chip__meta">
                        ×{d.quantity} · {j.pais}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="trade-form__row">
            <label className="field">
              <span>{dupes.length ? t('label_offer_alt') : t('label_offer')}</span>
              <input
                type="number"
                min={1}
                max={TOTAL_CARDS}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                required
                placeholder={t('placeholder_offer')}
                inputMode="numeric"
              />
            </label>
            <span className="trade-form__arrow" aria-hidden="true">
              →
            </span>
            <label className="field">
              <span>{t('label_want')}</span>
              <input
                type="number"
                min={1}
                max={TOTAL_CARDS}
                value={want}
                onChange={(e) => setWant(e.target.value)}
                required
                placeholder={t('placeholder_want')}
                inputMode="numeric"
              />
            </label>
          </div>
          <label className="trade-form__check field field--row">
            <input
              type="checkbox"
              checked={saveLocationOnPublish}
              onChange={(e) => setSaveLocationOnPublish(e.target.checked)}
            />
            <span>{t('check_location')}</span>
          </label>
          {error && <p className="form-error">{error}</p>}
          {geoHint && <p className="form-success trade-geo-hint">{geoHint}</p>}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? t('btn_publishing') : t('btn_publish')}
          </button>
        </form>
      </section>

      <section className="trade-map-section">
        <div className="trade-map-section__head">
          <h2>{t('map_title')}</h2>
          <span className="trade-map-section__badge">
            {geoPostsCount} {t('map_with_location')}
          </span>
        </div>
        <Suspense
          fallback={
            <div className="trades-map trades-map--empty" aria-busy="true">
              {t('map_loading')}
            </div>
          }
        >
          <TradesMap posts={posts} myLat={myPos?.lat} myLng={myPos?.lng} currentUserId={user.id} />
        </Suspense>
        {myPos == null && (
          <p className="trade-map-footnote">{t('map_footnote')}</p>
        )}
      </section>

      <section className="trade-list-section">
        <h2>{t('active_posts')}</h2>
        {posts.length === 0 ? (
          <p className="empty-state">{t('no_posts')}</p>
        ) : (
          <ul className="trade-list">
            {posts.map((p) => {
              const mine = p.user_id === user.id
              const date = new Date(p.created_at).toLocaleString(locale)
              const d = mine ? null : distanceForPost(p)
              const distLabel = mine ? '—' : formatDistanceKm(d)
              const hasGeo = p.lat != null && p.lng != null
              return (
                <li key={p.id} className={`trade-card${mine ? ' trade-card--mine' : ''}`}>
                  <div className="trade-card__body">
                    <div className="trade-card__deal">
                      <div className="trade-card__line">
                        <strong>
                          {t('offer_prefix')} #{p.offer_card}
                        </strong>
                        <span className="trade-card__player">
                          {getJugador(p.offer_card).nombre}
                        </span>
                      </div>
                      <span className="trade-card__sep">{t('trade_sep')}</span>
                      <div className="trade-card__line">
                        <strong>
                          {t('want_prefix')} #{p.want_card}
                        </strong>
                        <span className="trade-card__player">
                          {getJugador(p.want_card).nombre}
                        </span>
                      </div>
                    </div>
                    <p className="trade-card__meta">
                      {mine ? (
                        <span className="trade-card__badge">{t('my_post_badge')}</span>
                      ) : (
                        <span>
                          {t('user_prefix')} {shortUser(p.user_id)}
                        </span>
                      )}
                      <span>{date}</span>
                      {hasGeo && (
                        <span
                          className="trade-card__geo"
                          title={mine ? t('my_post_badge') : ''}
                        >
                          {mine ? t('location_saved') : `≈ ${distLabel}`}
                        </span>
                      )}
                      {!hasGeo && (
                        <span className="trade-card__geo trade-card__geo--muted">
                          {t('no_location')}
                        </span>
                      )}
                    </p>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => retirePost(p.id)}
                    >
                      {t('btn_remove_post')}
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
