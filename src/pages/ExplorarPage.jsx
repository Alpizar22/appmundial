import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useLang } from '../context/LangContext'
import { fetchHistoriasRecientes } from '../lib/api'

export default function ExplorarPage() {
  const { t, lang } = useLang()
  const [historias, setHistorias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchHistoriasRecientes(30)
      .then((data) => { if (!cancelled) setHistorias(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="explorar-page">
      <Helmet><title>{t('explorar_title')} — whatif.lat</title></Helmet>
      <h1>{t('explorar_title')}</h1>
      <p className="page-lead">{t('explorar_lead')}</p>

      {loading && <div className="screen-loading"><div className="screen-loading__spinner" /></div>}

      {!loading && historias.length === 0 && (
        <div className="empty-state">
          <p>{t('explorar_empty')}</p>
          <Link to="/" className="btn btn--primary">{t('nav_home')}</Link>
        </div>
      )}

      <ul className="historias-list">
        {historias.map((h) => {
          const varTexto = h.variable_custom
            || (lang === 'en' ? (h.variable?.texto_en || h.variable?.texto) : h.variable?.texto)
          const momTitulo = lang === 'en' ? (h.momento?.titulo_en || h.momento?.titulo) : h.momento?.titulo
          return (
            <li key={h.id} className="historias-list__item">
              <Link to={`/historia/${h.id}`}>
                <div className="historias-list__head">
                  <span className="historias-list__emoji" aria-hidden="true">{h.momento?.imagen_emoji || '⚽'}</span>
                  <span className="historias-list__momento">{momTitulo}</span>
                </div>
                <strong className="historias-list__variable">{varTexto}</strong>
                <p className="historias-list__preview">{h.narrativa.slice(0, 140)}…</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
