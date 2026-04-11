import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function DuplicatesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('user_cards')
      .select('card_number, quantity')
      .eq('user_id', user.id)
      .gt('quantity', 1)
      .order('card_number')
    if (err) setError(err.message)
    else {
      setRows(data || [])
      setError('')
    }
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

  async function removeOneDuplicate(cardNumber, currentQty) {
    const next = currentQty - 1
    if (next <= 0) return
    const { error: err } = await supabase
      .from('user_cards')
      .update({ quantity: next })
      .eq('user_id', user.id)
      .eq('card_number', cardNumber)
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

  const totalExtra = rows.reduce((s, r) => s + (r.quantity - 1), 0)

  return (
    <div className="page duplicates">
      <header className="page-header">
        <h1>Duplicados</h1>
        <p>
          Cartas con más de una copia. Cada clic en «Quitar una copia extra» deja una sola en el
          álbum.
        </p>
      </header>

      {error && <p className="form-error">{error}</p>}

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>No tienes duplicados registrados.</p>
          <p className="empty-state__hint">
            En la colección usa <kbd>Mayús</kbd> + clic en una carta que ya tengas para sumar
            duplicados.
          </p>
        </div>
      ) : (
        <>
          <p className="dup-summary">
            <strong>{totalExtra}</strong> copias de más en{' '}
            <strong>{rows.length}</strong> números distintos.
          </p>
          <ul className="dup-list">
            {rows.map((r) => (
              <li key={r.card_number} className="dup-row">
                <div>
                  <span className="dup-row__num">Carta #{r.card_number}</span>
                  <span className="dup-row__qty">{r.quantity} copias</span>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => removeOneDuplicate(r.card_number, r.quantity)}
                >
                  Quitar una copia extra
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
