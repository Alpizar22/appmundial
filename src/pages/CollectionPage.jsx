import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { EQUIPOS, buscarCartas, isEspecial } from '../data/jugadores'

const LONG_PRESS_MS = 600

function buildMap(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(r.carta_id, r.cantidad ?? 1)
  }
  return m
}

const VALID_VISTAS = ['tengo', 'faltan', 'especiales']

export default function CollectionPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const [qtyByCard, setQtyByCard] = useState(() => new Map())
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [paisFiltro, setPaisFiltro] = useState(null)
  const [error, setError] = useState('')
  const [tapAnim, setTapAnim] = useState(null)
  const tapTimerRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const didLongPressRef = useRef(false)
  const teamRefs = useRef({})
  const chipsRowRef = useRef(null)

  const vista = VALID_VISTAS.includes(searchParams.get('vista')) ? searchParams.get('vista') : null

  const bumpTap = useCallback((id) => {
    setTapAnim(id)
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = window.setTimeout(() => setTapAnim(null), 380)
  }, [])

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('carta_id, cantidad')
      .eq('user_id', user.id)
    if (err) { setError(err.message); return }
    setQtyByCard(buildMap(data || []))
    setError('')
  }, [user.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      await refresh()
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [refresh])

  useEffect(() => () => {
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
  }, [])

  const handleLongPressStart = useCallback((cartaId) => {
    longPressTimerRef.current = window.setTimeout(async () => {
      const current = qtyByCard.get(cartaId) || 0
      if (current > 0) {
        didLongPressRef.current = true
        bumpTap(cartaId)
        await setQuantity(cartaId, current + 1)
      }
    }, LONG_PRESS_MS)
  }, [qtyByCard, bumpTap])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Build a Set of matching carta_ids when search is active
  const searchSet = useMemo(() => {
    const q = filter.trim()
    if (!q) return null
    const results = buscarCartas(q)
    return results ? new Set(results) : new Set()
  }, [filter])

  // Filter EQUIPOS based on vista + search + paisFiltro
  const equiposFiltrados = useMemo(() => {
    return EQUIPOS.map((equipo) => {
      let cartas = equipo.cartas

      if (vista === 'tengo') cartas = cartas.filter((c) => (qtyByCard.get(`${equipo.id}_${c.numero}`) || 0) > 0)
      else if (vista === 'faltan') cartas = cartas.filter((c) => (qtyByCard.get(`${equipo.id}_${c.numero}`) || 0) === 0)
      else if (vista === 'especiales') cartas = cartas.filter((c) => c.tipo === 'escudo')

      if (searchSet) cartas = cartas.filter((c) => searchSet.has(`${equipo.id}_${c.numero}`))

      return { ...equipo, cartas }
    }).filter((equipo) => {
      if (paisFiltro && equipo.nombre !== paisFiltro) return false
      return equipo.cartas.length > 0
    })
  }, [vista, qtyByCard, searchSet, paisFiltro])

  async function setQuantity(cartaId, nextQty) {
    if (nextQty <= 0) {
      const { error: err } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('carta_id', cartaId)
      if (err) setError(err.message)
      else setQtyByCard((prev) => { const n = new Map(prev); n.delete(cartaId); return n })
      return
    }
    const { error: err } = await supabase.from('user_cards').upsert(
      { user_id: user.id, carta_id: cartaId, cantidad: nextQty },
      { onConflict: 'user_id,carta_id' }
    )
    if (err) setError(err.message)
    else setQtyByCard((prev) => { const n = new Map(prev); n.set(cartaId, nextQty); return n })
  }

  async function handleCellClick(cartaId, e) {
    if (didLongPressRef.current) { didLongPressRef.current = false; return }
    bumpTap(cartaId)
    const current = qtyByCard.get(cartaId) || 0
    if (e.shiftKey && current > 0) { await setQuantity(cartaId, current + 1); return }
    if (current === 0) await setQuantity(cartaId, 1)
    else if (current === 1) await setQuantity(cartaId, 0)
    else await setQuantity(cartaId, current - 1)
  }

  async function handleAddDup(e, cartaId) {
    e.stopPropagation(); e.preventDefault()
    const current = qtyByCard.get(cartaId) || 0
    if (current > 0) { bumpTap(cartaId); await setQuantity(cartaId, current + 1) }
  }

  async function handleRemoveDup(e, cartaId) {
    e.stopPropagation(); e.preventDefault()
    const current = qtyByCard.get(cartaId) || 0
    if (current > 0) { bumpTap(cartaId); await setQuantity(cartaId, current - 1) }
  }

  function scrollToTeam(nombre) {
    setPaisFiltro(null)
    const el = teamRefs.current[nombre]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function renderCard(equipo, carta) {
    const cartaId = `${equipo.id}_${carta.numero}`
    const q = qtyByCard.get(cartaId) || 0
    const cls = [
      'card-cell',
      carta.tipo === 'escudo' ? 'card-cell--escudo' : '',
      carta.tipo === 'foto' ? 'card-cell--foto' : '',
      q === 1 ? 'card-cell--owned' : '',
      q > 1 ? 'card-cell--dup' : '',
      tapAnim === cartaId ? 'card-cell--tap' : '',
    ].filter(Boolean).join(' ')

    const tip = `${carta.nombre} · ${equipo.nombre} · #${carta.numero}`
    return (
      <button
        key={cartaId}
        type="button"
        role="listitem"
        className={cls}
        onClick={(e) => handleCellClick(cartaId, e)}
        onTouchStart={() => handleLongPressStart(cartaId)}
        onTouchEnd={handleLongPressEnd}
        onTouchMove={handleLongPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        title={q === 0 ? `${tip} — ${t('tip_mark')}` : q === 1 ? `${tip} — ${t('tip_remove')}` : `${tip} — ${t('tip_copies', { q })}`}
      >
        <span className="card-cell__num">{carta.numero}</span>
        <span className="card-cell__name">{carta.nombre}</span>
        {q > 0 && <span className="card-cell__badge">×{q}</span>}
        {q > 0 && (
          <>
            <span className="card-cell__add-dup" role="button" aria-label={t('tip_add_dup')}
              onPointerDown={(e) => e.stopPropagation()} onClick={(e) => handleAddDup(e, cartaId)}>+</span>
            <span className="card-cell__mob-actions" aria-hidden="true">
              <span className="card-cell__mob-btn card-cell__mob-btn--minus" role="button"
                aria-label={t('tip_remove_copy')} onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => handleRemoveDup(e, cartaId)}>−</span>
              <span className="card-cell__mob-btn card-cell__mob-btn--plus" role="button"
                aria-label={t('tip_add_dup')} onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => handleAddDup(e, cartaId)}>+</span>
            </span>
          </>
        )}
      </button>
    )
  }

  if (loading) return <div className="screen-loading"><div className="screen-loading__spinner" /></div>

  return (
    <div className="page collection">
      <Helmet>
        <title>Mi colección – SoccerSticker | Álbum de fútbol 2026</title>
        <meta name="description" content="Registra cada carta de tu colección de stickers del Mundial 2026. Organiza tus cromos por selección y descubre qué cartas te faltan." />
        <meta property="og:title" content="Mi colección – SoccerSticker" />
        <meta property="og:description" content="Organiza tu álbum de cromos del Mundial 2026 por selección." />
        <meta property="og:url" content="https://soccersticker.app/coleccion" />
      </Helmet>

      <header className="page-header">
        <h1>{t('collection_title')}</h1>
        <p className="collection-subtitle-desktop">
          {t('collection_subtitle_p1')} <kbd>{t('collection_kbd')}</kbd>{' '}{t('collection_subtitle_p2')}
        </p>
        <p className="collection-subtitle-mobile">{t('collection_subtitle_mobile')}</p>
      </header>

      {/* Vista filter bar */}
      <div className="collection-vista-bar" role="group" aria-label="Filtrar vista">
        {[
          { key: null, label: t('collection_vista_all') },
          { key: 'tengo', label: t('collection_vista_tengo') },
          { key: 'faltan', label: t('collection_vista_faltan') },
          { key: 'especiales', label: t('collection_vista_especiales') },
        ].map(({ key, label }) => (
          <button key={key ?? 'all'} type="button"
            className={`collection-vista-btn${vista === key ? ' collection-vista-btn--active' : ''}`}
            onClick={() => key === null ? setSearchParams({}) : setSearchParams({ vista: key })}>
            {label}
          </button>
        ))}
      </div>

      {/* Country chips — scroll to team */}
      <div className="collection-chips-row" ref={chipsRowRef} role="group" aria-label="Ir a selección">
        <button type="button"
          className={`country-chip${!paisFiltro ? ' country-chip--active' : ''}`}
          onClick={() => setPaisFiltro(null)}>
          {t('collection_chip_all')}
        </button>
        {EQUIPOS.map((equipo) => (
          <button key={equipo.id} type="button"
            className={`country-chip${paisFiltro === equipo.nombre ? ' country-chip--active' : ''}`}
            onClick={() => {
              if (paisFiltro === equipo.nombre) { setPaisFiltro(null); return }
              setPaisFiltro(equipo.nombre)
              scrollToTeam(equipo.nombre)
            }}>
            {equipo.bandera} {equipo.nombre}
          </button>
        ))}
      </div>

      <div className="collection-toolbar">
        <label className="field field--inline">
          <span>{t('collection_search_label')}</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder={t('collection_search_placeholder')} autoCapitalize="none"
            autoCorrect="off" spellCheck={false} maxLength={48} />
        </label>
        <button type="button" className="btn btn--ghost" onClick={() => refresh()}>
          {t('collection_btn_refresh')}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="collection-by-team">
        {equiposFiltrados.length === 0 ? (
          <p className="empty-hint">No hay cartas con ese filtro.</p>
        ) : (
          equiposFiltrados.map((equipo) => {
            const ownedCount = equipo.cartas.filter(
              (c) => (qtyByCard.get(`${equipo.id}_${c.numero}`) || 0) > 0
            ).length
            const totalCartas = EQUIPOS.find((e) => e.id === equipo.id)?.cartas.length ?? 20
            return (
              <section key={equipo.id} className="team-section"
                ref={(el) => { teamRefs.current[equipo.nombre] = el }}>
                <h2 className="team-section__header">
                  <span className="team-section__flag">{equipo.bandera}</span>
                  <span className="team-section__name">{equipo.nombre}</span>
                  <span className="team-section__count">{ownedCount}/{totalCartas}</span>
                </h2>
                <div className="card-grid" role="list">
                  {equipo.cartas.map((carta) => renderCard(equipo, carta))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
