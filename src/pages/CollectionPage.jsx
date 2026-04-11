import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { TOTAL_CARDS } from '../constants'
import { buscarJugadores, getJugador } from '../data/jugadores'

function buildMap(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(r.card_number, r.quantity ?? 1)
  }
  return m
}

export default function CollectionPage() {
  const { user } = useAuth()
  const [qtyByCard, setQtyByCard] = useState(() => new Map())
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tapAnim, setTapAnim] = useState(null)
  const tapTimerRef = useRef(null)

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
    },
    []
  )

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

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  return (
    <div className="page collection">
      <header className="page-header">
        <h1>Colección</h1>
        <p>
          Pulsa una carta para marcarla o quitarla. <kbd>Mayús</kbd> + clic suma un duplicado si ya
          la tienes.
        </p>
      </header>

      <div className="collection-toolbar">
        <label className="field field--inline">
          <span>Buscar número o jugador</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Ej. 42, Messi, México…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={48}
          />
        </label>
        <button type="button" className="btn btn--ghost" onClick={() => refresh()}>
          Actualizar
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
              title={
                q === 0
                  ? `${tip} — marcar`
                  : q === 1
                    ? `${tip} — quitar · Mayús+clic: duplicado`
                    : `${tip} — ${q} copias`
              }
            >
              <span className="card-cell__num">{n}</span>
              <span className="card-cell__name">{j.nombre}</span>
              {q > 1 && <span className="card-cell__badge">{q}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
