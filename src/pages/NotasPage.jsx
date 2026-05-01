import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { TOTAL_CARDS } from '../constants'
import { getJugador } from '../data/jugadores'

const PRIORIDADES = ['alta', 'media', 'baja']

function PrioridadBadge({ prioridad }) {
  return (
    <span className={`nota-item__prioridad nota-item__prioridad--${prioridad}`}>
      {prioridad}
    </span>
  )
}

export default function NotasPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ carta_numero: '', prioridad: 'media', texto: '' })
  const cardInputRef = useRef(null)

  async function fetchNotas() {
    const { data, error: err } = await supabase
      .from('notas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!err) setNotas(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchNotas() }, [user.id])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const n = parseInt(form.carta_numero, 10)
    if (Number.isNaN(n) || n < 1 || n > TOTAL_CARDS) {
      setError(t('nota_err_invalid'))
      return
    }
    setAdding(true)
    const { error: err } = await supabase.from('notas').insert({
      user_id: user.id,
      carta_numero: n,
      prioridad: form.prioridad,
      texto: form.texto.trim(),
    })
    setAdding(false)
    if (err) { setError(t('nota_err_fallback')); return }
    setForm({ carta_numero: '', prioridad: 'media', texto: '' })
    cardInputRef.current?.focus()
    fetchNotas()
  }

  async function handleDelete(id) {
    await supabase.from('notas').delete().eq('id', id).eq('user_id', user.id)
    setNotas((prev) => prev.filter((nota) => nota.id !== id))
  }

  return (
    <div className="page notas-page">
      <Helmet>
        <title>Mis notas – SoccerSticker</title>
      </Helmet>

      <header className="page-header">
        <h1>{t('notas_title')}</h1>
        <p>{t('notas_subtitle')}</p>
      </header>

      {/* Add form */}
      <form className="nota-form" onSubmit={handleAdd} noValidate>
        <h2 className="nota-form__title">{t('notas_add_title')}</h2>

        <div className="nota-form__row">
          <label className="field">
            <span>{t('nota_card_label')}</span>
            <input
              ref={cardInputRef}
              type="number"
              min="1"
              max={TOTAL_CARDS}
              value={form.carta_numero}
              onChange={(e) => setForm((f) => ({ ...f, carta_numero: e.target.value }))}
              placeholder={t('nota_card_placeholder')}
              required
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span>{t('nota_prioridad_label')}</span>
            <select
              value={form.prioridad}
              onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {t(`nota_prioridad_${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>{t('nota_texto_label')}</span>
          <textarea
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            placeholder={t('nota_texto_placeholder')}
            rows={2}
            maxLength={280}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={adding}>
          {adding ? t('btn_adding_nota') : t('btn_add_nota')}
        </button>
      </form>

      {/* Notes list */}
      {loading ? (
        <div className="screen-loading">
          <div className="screen-loading__spinner" />
        </div>
      ) : notas.length === 0 ? (
        <p className="empty-hint">{t('notas_empty')}</p>
      ) : (
        <ul className="notas-list" role="list">
          {notas.map((nota) => {
            const jugador = getJugador(nota.carta_numero)
            return (
              <li key={nota.id} className="nota-item" role="listitem">
                <div className="nota-item__badge">#{nota.carta_numero}</div>
                <div className="nota-item__body">
                  <div className="nota-item__card-name">{jugador.nombre}</div>
                  <div className="nota-item__jugador">{jugador.pais}</div>
                  <PrioridadBadge prioridad={nota.prioridad} />
                  {nota.texto && <div className="nota-item__texto">{nota.texto}</div>}
                </div>
                <button
                  type="button"
                  className="nota-item__del"
                  aria-label={t('btn_delete_nota')}
                  onClick={() => handleDelete(nota.id)}
                  title={t('btn_delete_nota')}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
