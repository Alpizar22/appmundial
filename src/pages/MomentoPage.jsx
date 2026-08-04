import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useLang } from '../context/LangContext'
import { fetchMomentoBySlug, generarHistoria } from '../lib/api'

const LOADING_MESSAGES = {
  es: [
    'Reescribiendo la historia…',
    'Consultando universos paralelos…',
    'Repasando la jugada en la línea del tiempo alterna…',
    'Los balones vuelan en otra dirección…',
  ],
  en: [
    'Rewriting history…',
    'Consulting parallel universes…',
    'Reviewing the play in the alternate timeline…',
    'The balls fly a different way…',
  ],
}

export default function MomentoPage() {
  const { slug } = useParams()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [momento, setMomento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedVar, setSelectedVar] = useState(null)
  const [customVar, setCustomVar] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMomentoBySlug(slug)
      .then((data) => { if (!cancelled) setMomento(data) })
      .catch(() => { if (!cancelled) setError(t('momento_not_found')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug, t])

  useEffect(() => {
    if (!generating) return
    const msgs = LOADING_MESSAGES[lang] || LOADING_MESSAGES.es
    setLoadingMsg(msgs[Math.floor(Math.random() * msgs.length)])
    const interval = setInterval(() => {
      setLoadingMsg(msgs[Math.floor(Math.random() * msgs.length)])
    }, 2500)
    return () => clearInterval(interval)
  }, [generating, lang])

  async function handleGenerate() {
    setError('')
    if (!selectedVar && customVar.trim().length < 5) {
      setError(t('momento_err_select'))
      return
    }
    setGenerating(true)
    try {
      const payload = selectedVar
        ? { momento_id: momento.id, variable_id: selectedVar, lang }
        : { momento_id: momento.id, variable_custom: customVar.trim(), lang }
      const result = await generarHistoria(payload)
      navigate(`/historia/${result.id}`)
    } catch (err) {
      setError(err.message || t('gen_err_fallback'))
      setGenerating(false)
    }
  }

  if (loading) return <div className="screen-loading"><div className="screen-loading__spinner" /></div>
  if (error && !momento) return (
    <div className="empty-state">
      <p>{error}</p>
      <Link to="/" className="btn btn--primary">{t('nav_home')}</Link>
    </div>
  )
  if (!momento) return null

  const titulo = lang === 'en' ? (momento.titulo_en || momento.titulo) : momento.titulo

  return (
    <div className="momento-page">
      <Helmet>
        <title>{titulo} — whatif.lat</title>
        <meta name="description" content={momento.descripcion} />
      </Helmet>

      <Link to="/" className="back-link">← {t('nav_home')}</Link>

      <div className="momento-header">
        <div className="momento-header__emoji" aria-hidden="true">{momento.imagen_emoji}</div>
        <h1>{titulo}</h1>
        {momento.año && <span className="momento-header__año">{momento.año}</span>}
        <p className="momento-header__desc">{momento.descripcion}</p>
      </div>

      <section className="variables-section">
        <h2>{t('momento_choose_variable')}</h2>
        <div className="variables-list">
          {momento.variables?.map((v) => {
            const txt = lang === 'en' ? (v.texto_en || v.texto) : v.texto
            return (
              <button
                key={v.id}
                type="button"
                className={`variable-chip${selectedVar === v.id ? ' variable-chip--active' : ''}`}
                onClick={() => { setSelectedVar(v.id); setCustomVar('') }}
                disabled={generating}
              >
                {txt}
              </button>
            )
          })}
        </div>

        <div className="custom-variable">
          <label className="field">
            <span>{t('momento_or_custom')}</span>
            <input
              type="text"
              value={customVar}
              onChange={(e) => { setCustomVar(e.target.value); setSelectedVar(null) }}
              placeholder={t('momento_custom_placeholder')}
              maxLength={300}
              disabled={generating}
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={handleGenerate}
          disabled={generating || (!selectedVar && customVar.trim().length < 5)}
        >
          {generating ? loadingMsg : t('momento_generate_btn')}
        </button>
      </section>
    </div>
  )
}
