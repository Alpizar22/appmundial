import { useEffect, useRef, useState } from 'react'
import Orb from './components/Orb'
import { useVoiceAssistant } from './voice/useVoiceAssistant'
import { voiceStateLabel } from './voice/voiceMachine'

// El label/coordinate de cada region es copy libre; el `id` y la posicion en
// este array NO lo son: nasusOrbEngine.js ata comportamiento (region===1,
// region===3, region===4) y REGION_ANCHORS.{ia,automation,whatsapp,web,data}
// al indice numerico de esta lista. Reordenar desincroniza el label mostrado
// del terreno/camara 3D que realmente se renderiza para ese indice.
const regions = [
  { id: 'ia', number: '01', label: 'CRM Agentic', coordinate: 'N 19.22° · ESTADO VIVO' },
  { id: 'automatizacion', number: '02', label: 'Automatización', coordinate: 'E 42.08° · FLUJOS' },
  { id: 'whatsapp', number: '03', label: 'WhatsApp', coordinate: 'S 08.14° · AGENTE VIVO' },
  { id: 'web', number: '04', label: 'Web', coordinate: 'W 73.01° · ESTRUCTURAS' },
  { id: 'datos', number: '05', label: 'Datos', coordinate: 'N 31.90° · CARTOGRAFÍA' },
]
// 52 + 1 + 3329142391. El 1 tras el codigo de pais es la forma heredada para moviles
// mexicanos y sigue siendo la que resuelve de forma mas fiable en wa.me.
const WHATSAPP_URL = 'https://wa.me/5213329142391?text=' + encodeURIComponent('Hola Nasus, vengo del sitio y quiero platicar sobre un proyecto.')
const caseStudies = [
  { number: '01', title: 'THEIA', subtitle: 'E-commerce + fulfillment conectado.', description: 'Tienda funcional con catálogo, variantes, pagos y operación de fulfillment integrados.', tags: 'Next.js · Supabase · Printful · Mercado Pago' },
  { number: '02', title: 'NASUS ASSISTANT', subtitle: 'IA conversacional + voz.', description: 'Asistente capaz de responder por texto y voz e integrarse con servicios mediante APIs.', tags: 'AI · Voice · APIs · ElevenLabs' },
  { number: '03', title: 'CEEMISPA', subtitle: 'Experiencia web a medida.', description: 'Sitio desarrollado con enfoque en presencia digital, claridad y conversión.', tags: 'Web · UX · Desarrollo a medida' },
]

export default function App() {
  const [activeRegion, setActiveRegion] = useState(0)
  const { session: voiceSession, signals: voiceSignals, microphoneActive, start: beginConversation, stop: stopConversation } = useVoiceAssistant()
  const voiceState = voiceSession.status
  const panelRef = useRef(null)
  const [casesOpen, setCasesOpen] = useState(false)
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false)
  const [voiceConsentGiven, setVoiceConsentGiven] = useState(() => localStorage.getItem('nasus-voice-consent') === 'accepted')

  useEffect(() => {
    if (performance.getEntriesByName('UI_INTERACTIVE', 'mark').length) return
    performance.mark('UI_INTERACTIVE')
    performance.measure('UI_INTERACTIVE_DURATION', { start: 0, end: 'UI_INTERACTIVE' })
  }, [])

  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-region]')]
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (current) setActiveRegion(Number(current.target.dataset.region))
    }, { rootMargin: '-42% 0px -42%', threshold: 0 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!casesOpen && !voiceConsentOpen) return undefined
    const previous = document.activeElement
    const panel = panelRef.current
    const focusable = () => [...panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
    panel.querySelector('button')?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setCasesOpen(false); setVoiceConsentOpen(false) }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.() }
  }, [casesOpen, voiceConsentOpen])

  const requestConversation = () => {
    if (!voiceConsentGiven && voiceState === 'idle') return setVoiceConsentOpen(true)
    beginConversation()
  }
  const acceptVoiceConsent = () => {
    localStorage.setItem('nasus-voice-consent', 'accepted')
    setVoiceConsentGiven(true)
    setVoiceConsentOpen(false)
    beginConversation()
  }

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return <main className={voiceState === 'idle' ? 'experience' : 'experience is-speaking'}>
    <div className="noise" />
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Nasus, inicio"><span className="brand__mark"><i /><i /><i /></span>NASUS</a>
      <div className="topbar__actions"><span className="topbar__coordinate">WORLD / NL-001</span><a className="contact-trigger" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">CONTACTO <i>↗</i></a></div>
    </header>

    <div className="world" aria-live="polite">
      <Orb region={activeRegion} mode={voiceState} voiceSignals={voiceSignals} onActivate={requestConversation} onOpenCases={() => setCasesOpen(true)} />
      <p className={`voice-state voice-state--${voiceState}`} role="status">{voiceStateLabel(voiceSession)}</p>
      {microphoneActive && <div className="microphone-indicator" role="status"><i />MICRÓFONO ACTIVO <button type="button" onClick={stopConversation}>DETENER</button></div>}
      <div className="world__crosshair world__crosshair--a" /><div className="world__crosshair world__crosshair--b" />
    </div>

    {casesOpen && <div className="cases-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCasesOpen(false) }}>
      <aside ref={panelRef} className="cases-panel" role="dialog" aria-modal="true" aria-labelledby="cases-title">
        <button type="button" className="cases-panel__close" onClick={() => setCasesOpen(false)} aria-label="Cerrar casos reales">×</button>
        <p className="eyebrow">CASOS REALES</p>
        <h2 id="cases-title">Trabajo aplicado en sistemas reales.</h2>
        <div className="cases-panel__projects">
          {caseStudies.map(project => <article key={project.number}><span>{project.number}</span><h3>{project.title}</h3><strong>{project.subtitle}</strong><p>{project.description}</p><small>{project.tags}</small></article>)}
        </div>
        <div className="cases-panel__metrics" aria-label="Capacidades verificables"><div><strong>3</strong><span>PROYECTOS</span></div><div><strong>5</strong><span>ÁREAS DEL MUNDO</span></div><p>CRM · WEB · AUTOMATIZACIÓN · DATOS · COMUNICACIÓN</p></div>
        <p className="cases-panel__question">¿Tienes algo parecido en mente?</p>
        <a className="cases-panel__cta" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setCasesOpen(false)}>Hablar sobre un proyecto <i>→</i></a>
      </aside>
    </div>}

    {voiceConsentOpen && <div className="cases-overlay voice-consent-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setVoiceConsentOpen(false) }}>
      <aside ref={panelRef} className="voice-consent" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title">
        <button type="button" className="cases-panel__close" onClick={() => setVoiceConsentOpen(false)} aria-label="Cerrar aviso de voz">×</button>
        <p className="eyebrow">ASISTENTE DE VOZ</p>
        <h2 id="voice-consent-title">Tu voz activa la experiencia.</h2>
        <p>Usaremos el reconocimiento de voz de tu navegador. La transcripción se procesa con inteligencia artificial para generar una respuesta y convertirla en audio.</p>
        <small>El navegador solicitará permiso antes de abrir el micrófono. Podrás detenerlo en cualquier momento.</small>
        <button type="button" className="voice-consent__accept" onClick={acceptVoiceConsent}>CONTINUAR Y ACTIVAR <i>→</i></button>
        <span className="voice-consent__privacy">POLÍTICA DE PRIVACIDAD · CONTENIDO PENDIENTE</span>
      </aside>
    </div>}

    <section className="hero" id="top">
      <div className="hero__copy">
        <p className="eyebrow">NASUS</p>
        <h1>Habla con<br />Nasus</h1>
        <p>Interactúa con inteligencia viva.</p>
        <button className="talk-button" onClick={requestConversation}>{voiceState === 'idle' ? 'Hablar con Nasus' : 'Terminar'}<i /></button>
      </div>
      <span className="scroll-cue">SCROLL <i /></span>
    </section>

    <div className="journey">
      {regions.map((region, index) => <section className="region" id={region.id} data-region={index} key={region.id}>
        <div className={`region-label ${activeRegion === index ? 'is-active' : ''}`}>
          <span>{region.coordinate}</span><h2>{region.label}</h2><i>{region.number} / 05</i>
        </div>
      </section>)}
    </div>

    <footer id="contacto"><span>NASUS / INTELLIGENCE WORLD</span><a className="contact-trigger" style={{ marginLeft: 16 }} href="https://nasus.lat" target="_blank" rel="noopener noreferrer">IR A NASUS.LAT <i>↗</i></a></footer>
    <nav className="route-nav" aria-label="Mapa de regiones">
      <span className="route-nav__origin">NL</span>
      {regions.map((region, index) => <button className={activeRegion === index ? 'is-active' : ''} onClick={() => goTo(region.id)} key={region.id} aria-label={`Ir a ${region.label}`}><i />{region.label}</button>)}
    </nav>
  </main>
}
