import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useLang } from '../context/LangContext'
import { fetchMomentos } from '../lib/api'

export default function HomePage() {
  const { t, lang } = useLang()
  const [momentos, setMomentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMomentos()
      .then((data) => { if (!cancelled) setMomentos(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="home-page">
      <Helmet>
        <title>{t('home_meta_title')}</title>
        <meta name="description" content={t('home_meta_desc')} />
      </Helmet>

      <section className="hero-block">
        <h1 className="hero-block__title">{t('home_title')}</h1>
        <p className="hero-block__subtitle">{t('home_subtitle')}</p>
      </section>

      {loading && <div className="screen-loading"><div className="screen-loading__spinner" /></div>}
      {error && <p className="form-error">{error}</p>}

      <div className="momentos-grid">
        {momentos.map((m) => (
          <Link key={m.id} to={`/momento/${m.slug}`} className="momento-card">
            <div className="momento-card__emoji" aria-hidden="true">{m.imagen_emoji}</div>
            <div className="momento-card__body">
              <h3 className="momento-card__title">
                {lang === 'en' ? (m.titulo_en || m.titulo) : m.titulo}
              </h3>
              <div className="momento-card__meta">
                {m.año && <span>{m.año}</span>}
                {m.equipos?.length > 0 && <span>{m.equipos.join(' vs ')}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
