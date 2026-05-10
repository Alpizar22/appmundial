import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { getCarta, EQUIPOS, buscarCartas } from '../data/jugadores'

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
  const [form, setForm] = useState({ equipo_id: '', carta_num: '', prioridad: 'media', texto: '' })
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
    const num = parseInt(form.carta_num, 10)
    const cartaId = form.equipo_id && !Number.isNaN(num) && num >= 1 && num <= 20
      ? `${form.equipo_id}_${num}`
      : null
    const { carta } = cartaId ? getCarta(cartaId) : {}
    if (!cartaId || carta?.nombre === '—') {
      setError(t('nota_err_invalid'))
      return
    }
    setAdding(true)
    const { error: err } = await supabase.from('notas').insert({
      user_id: user.id,
      carta_numero: cartaId,
      prioridad: form.prioridad,
      texto: form.texto.trim(),
    })
    setAdding(false)
    if (err) { setError(t('nota_err_fallback')); return }
    setForm({ equipo_id: '', carta_num: '', prioridad: 'media', texto: '' })
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
            <span>Selección</span>
            <select
              ref={cardInputRef}
              value={form.equipo_id}
              onChange={(e) => setForm((f) => ({ ...f, equipo_id: e.target.value }))}
              required
            >
              <option value="">-- Elige selección --</option>
              {EQUIPOS.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.bandera} {eq.nombre}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('nota_card_label')} (1–20)</span>
            <input
              type="number"
              min="1"
              max="20"
              value={form.carta_num}
              onChange={(e) => setForm((f) => ({ ...f, carta_num: e.target.value }))}
              placeholder="Ej. 5"
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
            const { equipo, carta } = getCarta(nota.carta_numero)
            return (
              <li key={nota.id} className="nota-item" role="listitem">
                <div className="nota-item__badge">{equipo.bandera} #{carta.numero}</div>
                <div className="nota-item__body">
                  <div className="nota-item__card-name">{carta.nombre}</div>
                  <div className="nota-item__jugador">{equipo.nombre}</div>
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
