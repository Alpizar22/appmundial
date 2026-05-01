import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { TOTAL_CARDS } from '../constants'
import { buscarJugadores, getJugador } from '../data/jugadores'

const LONG_PRESS_MS = 600

function buildMap(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(r.card_number, r.quantity ?? 1)
  }
  return m
}

export default function CollectionPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [qtyByCard, setQtyByCard] = useState(() => new Map())
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tapAnim, setTapAnim] = useState(null)
  const tapTimerRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const didLongPressRef = useRef(false)

  const bumpTap = useCallback((n) => {
    setTapAnim(n)
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = window.setTimeout(() => setTapAnim(null), 380)
  }, [])

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('card_number, quantity')
      .eq('user_id', user.id)
    if (err) {
      setError(err.message)
      return
    }
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
    return () => {
      alive = false
    }
  }, [refresh])

  useEffect(
    () => () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    },
    []
  )

  const handleLongPressStart = useCallback(
    (cardNumber) => {
      longPressTimerRef.current = window.setTimeout(async () => {
        const current = qtyByCard.get(cardNumber) || 0
        if (current > 0) {
          didLongPressRef.current = true
          bumpTap(cardNumber)
          await setQuantity(cardNumber, current + 1)
        }
      }, LONG_PRESS_MS)
    },
    [qtyByCard, bumpTap]
  )

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const numbers = useMemo(() => {
    const q = filter.trim()
    if (!q) return Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1)
    if (/^\d+$/.test(q)) {
      const n = parseInt(q, 10)
      if (!Number.isNaN(n) && n >= 1 && n <= TOTAL_CARDS) return [n]
      return Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1).filter((num) =>
        String(num).includes(q)
      )
    }
    const byName = buscarJugadores(q)
    if (byName?.length) return byName
    return Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1).filter((num) =>
      String(num).includes(q)
    )
  }, [filter])

  async function setQuantity(cardNumber, nextQty) {
    if (nextQty <= 0) {
      const { error: err } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('card_number', cardNumber)
      if (err) setError(err.message)
      else {
        setQtyByCard((prev) => {
          const n = new Map(prev)
          n.delete(cardNumber)
          return n
        })
      }
      return
    }
    const { error: err } = await supabase.from('user_cards').upsert(
      {
        user_id: user.id,
        card_number: cardNumber,
        quantity: nextQty,
      },
      { onConflict: 'user_id,card_number' }
    )
    if (err) setError(err.message)
    else {
      setQtyByCard((prev) => {
        const n = new Map(prev)
        n.set(cardNumber, nextQty)
        return n
      })
    }
  }

  async function handleCellClick(cardNumber, e) {
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }
    bumpTap(cardNumber)
    const current = qtyByCard.get(cardNumber) || 0
    if (e.shiftKey && current > 0) {
      await setQuantity(cardNumber, current + 1)
      return
    }
    if (current === 0) await setQuantity(cardNumber, 1)
    else if (current === 1) await setQuantity(cardNumber, 0)
    else await setQuantity(cardNumber, current - 1)
  }

  async function handleAddDup(e, cardNumber) {
    e.stopPropagation()
    e.preventDefault()
    const current = qtyByCard.get(cardNumber) || 0
    if (current > 0) {
      bumpTap(cardNumber)
      await setQuantity(cardNumber, current + 1)
    }
  }

  async function handleRemoveDup(e, cardNumber) {
    e.stopPropagation()
    e.preventDefault()
    const current = qtyByCard.get(cardNumber) || 0
    if (current > 0) {
      bumpTap(cardNumber)
      await setQuantity(cardNumber, current - 1)
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
    <div className="page collection">
      <Helmet>
        <title>Mi colección de cromos – SoccerSticker | Álbum de fútbol 2026</title>
        <meta name="description" content="Registra cada carta de tu colección de stickers de fútbol. Organiza tus cromos por selección y descubre qué cartas te faltan para completar el álbum." />
        <meta property="og:title" content="Mi colección – SoccerSticker" />
        <meta property="og:description" content="Organiza tu álbum de cromos de fútbol 2026 y descubre qué cartas te faltan." />
        <meta property="og:url" content="https://soccersticker.app/coleccion" />
      </Helmet>
      <header className="page-header">
        <h1>{t('collection_title')}</h1>
        <p className="collection-subtitle-desktop">
          {t('collection_subtitle_p1')} <kbd>{t('collection_kbd')}</kbd>{' '}
          {t('collection_subtitle_p2')}
        </p>
        <p className="collection-subtitle-mobile">{t('collection_subtitle_mobile')}</p>
      </header>

      <div className="collection-toolbar">
        <label className="field field--inline">
          <span>{t('collection_search_label')}</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('collection_search_placeholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={48}
          />
        </label>
        <button type="button" className="btn btn--ghost" onClick={() => refresh()}>
          {t('collection_btn_refresh')}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="card-grid" role="list">
        {numbers.map((n) => {
          const q = qtyByCard.get(n) || 0
          const j = getJugador(n)
          const cls = [
            'card-cell',
            q === 1 ? 'card-cell--owned' : '',
            q > 1 ? 'card-cell--dup' : '',
            tapAnim === n ? 'card-cell--tap' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const tip = `${j.nombre} (${j.pais}) · #${n}`
          return (
            <button
              key={n}
              type="button"
              role="listitem"
              className={cls}
              onClick={(e) => handleCellClick(n, e)}
              onTouchStart={() => handleLongPressStart(n)}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleLongPressEnd}
              onContextMenu={(e) => e.preventDefault()}
              title={
                q === 0
                  ? `${tip} — ${t('tip_mark')}`
                  : q === 1
                    ? `${tip} — ${t('tip_remove')}`
                    : `${tip} — ${t('tip_copies', { q })}`
              }
            >
              <span className="card-cell__num">{n}</span>
              <span className="card-cell__name">{j.nombre}</span>
              {q > 0 && <span className="card-cell__badge">×{q}</span>}
              {q > 0 && (
                <>
                  {/* Desktop: hover + button */}
                  <span
                    className="card-cell__add-dup"
                    role="button"
                    aria-label={t('tip_add_dup')}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleAddDup(e, n)}
                  >
                    +
                  </span>
                  {/* Mobile: visible − and + action bar */}
                  <span className="card-cell__mob-actions" aria-hidden="true">
                    <span
                      className="card-cell__mob-btn card-cell__mob-btn--minus"
                      role="button"
                      aria-label={t('tip_remove_copy')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleRemoveDup(e, n)}
                    >
                      −
                    </span>
                    <span
                      className="card-cell__mob-btn card-cell__mob-btn--plus"
                      role="button"
                      aria-label={t('tip_add_dup')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleAddDup(e, n)}
                    >
                      +
                    </span>
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
