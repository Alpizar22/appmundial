import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useLang } from '../context/LangContext'
import { fetchHistoria } from '../lib/api'
import TarjetaWhatif from '../components/TarjetaWhatif'

export default function HistoriaPage() {
  const { id } = useParams()
  const { t, lang } = useLang()
  const [historia, setHistoria] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchHistoria(id)
      .then((data) => { if (!cancelled) setHistoria(data) })
      .catch(() => { if (!cancelled) setError(t('historia_not_found')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <div className="screen-loading"><div className="screen-loading__spinner" /></div>
  if (error || !historia) return (
    <div className="empty-state">
      <p>{error || t('historia_not_found')}</p>
      <Link to="/" className="btn btn--primary">{t('nav_home')}</Link>
    </div>
  )

  const url = typeof window !== 'undefined' ? window.location.href : `https://whatif.lat/historia/${id}`
  const variableTexto = historia.variable_custom
    || (lang === 'en' ? (historia.variable?.texto_en || historia.variable?.texto) : historia.variable?.texto)
  const momentoTitulo = lang === 'en'
    ? (historia.momento?.titulo_en || historia.momento?.titulo)
    : historia.momento?.titulo

  return (
    <div className="historia-page">
      <Helmet>
        <title>{variableTexto} — whatif.lat</title>
        <meta name="description" content={historia.narrativa.slice(0, 160)} />
        <meta property="og:title" content={variableTexto} />
        <meta property="og:description" content={historia.narrativa.slice(0, 160)} />
        <meta property="og:type" content="article" />
      </Helmet>

      <TarjetaWhatif historia={historia} url={url} />

      <article className="historia-full">
        <div className="historia-full__momento">
          <span aria-hidden="true">{historia.momento?.imagen_emoji}</span> {momentoTitulo}
          {historia.momento?.año && <span className="historia-full__año"> · {historia.momento.año}</span>}
        </div>
        <h1 className="historia-full__variable">{variableTexto}</h1>
        <div className="historia-full__body">
          {historia.narrativa.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="historia-full__actions">
          {historia.momento?.slug && (
            <Link to={`/momento/${historia.momento.slug}`} className="btn btn--ghost">
              {t('historia_more_variants')}
            </Link>
          )}
          <Link to="/" className="btn btn--primary">{t('historia_new')}</Link>
        </div>
      </article>
    </div>
  )
}
