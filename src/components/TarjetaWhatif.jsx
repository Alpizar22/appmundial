import { useState } from 'react'
import { useLang } from '../context/LangContext'
import { incrementarCompartidas } from '../lib/api'

export default function TarjetaWhatif({ historia, url }) {
  const { t, lang } = useLang()
  const [copied, setCopied] = useState(false)

  const emoji = historia.momento?.imagen_emoji || '⚽'
  const momentoTitulo = lang === 'en'
    ? (historia.momento?.titulo_en || historia.momento?.titulo)
    : historia.momento?.titulo
  const variableTexto = historia.variable_custom
    || (lang === 'en' ? (historia.variable?.texto_en || historia.variable?.texto) : historia.variable?.texto)
  const preview = historia.narrativa.split(/\n+/).slice(0, 3).join(' ')

  const shareText = `${variableTexto}\n\n${preview}\n\n→ ${url}\n#whatiflat`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      incrementarCompartidas(historia.id)
    } catch { /* ignore */ }
  }

  async function handleShare() {
    const shareData = { title: variableTexto, text: preview, url }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        incrementarCompartidas(historia.id)
        return
      } catch { /* user cancelled */ }
    }
    handleCopy()
  }

  return (
    <div className="tarjeta-whatif">
      <div className="tarjeta-whatif__brand">whatif.lat</div>
      <div className="tarjeta-whatif__emoji" aria-hidden="true">{emoji}</div>
      <div className="tarjeta-whatif__momento">{momentoTitulo}</div>
      <h2 className="tarjeta-whatif__variable">{variableTexto}</h2>
      <p className="tarjeta-whatif__preview">{preview}</p>
      <div className="tarjeta-whatif__actions">
        <button type="button" className="btn btn--primary" onClick={handleCopy}>
          {copied ? t('tarjeta_copiado') : t('tarjeta_copiar')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleShare}>
          {t('tarjeta_compartir')}
        </button>
      </div>
    </div>
  )
}
