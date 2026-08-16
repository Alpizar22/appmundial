import { useEffect, useRef, useState } from 'react'
import Orb from './components/Orb'

const regions = [
  { id: 'ia', number: '01', label: 'IA', coordinate: 'N 19.22° · RED NEURAL' },
  { id: 'automatizacion', number: '02', label: 'Automatización', coordinate: 'E 42.08° · FLUJOS' },
  { id: 'whatsapp', number: '03', label: 'WhatsApp', coordinate: 'S 08.14° · SEÑALES' },
  { id: 'web', number: '04', label: 'Web', coordinate: 'W 73.01° · ESTRUCTURAS' },
  { id: 'datos', number: '05', label: 'Datos', coordinate: 'N 31.90° · CARTOGRAFÍA' },
]
const labels = { idle: '', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Hablando…' }
const caseStudies = [
  { number: '01', title: 'THEIA', subtitle: 'E-commerce + fulfillment conectado.', description: 'Tienda funcional con catálogo, variantes, pagos y operación de fulfillment integrados.', tags: 'Next.js · Supabase · Printful · Mercado Pago' },
  { number: '02', title: 'NASUS ASSISTANT', subtitle: 'IA conversacional + voz.', description: 'Asistente capaz de responder por texto y voz e integrarse con servicios mediante APIs.', tags: 'AI · Voice · APIs · ElevenLabs' },
  { number: '03', title: 'CEEMISPA', subtitle: 'Experiencia web a medida.', description: 'Sitio desarrollado con enfoque en presencia digital, claridad y conversión.', tags: 'Web · UX · Desarrollo a medida' },
]

export default function App() {
  const [activeRegion, setActiveRegion] = useState(0)
  const [voiceState, setVoiceState] = useState('idle')
  const voiceTimer = useRef(null)
  const panelRef = useRef(null)
  const [casesOpen, setCasesOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-region]')]
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (current) setActiveRegion(Number(current.target.dataset.region))
    }, { rootMargin: '-42% 0px -42%', threshold: 0 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  useEffect(() => () => window.clearTimeout(voiceTimer.current), [])
  useEffect(() => {
    if (!casesOpen && !contactOpen) return undefined
    const previous = document.activeElement
    const panel = panelRef.current
    const focusable = () => [...panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
    panel.querySelector('button')?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setCasesOpen(false); setContactOpen(false) }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.() }
  }, [casesOpen, contactOpen])

  const beginConversation = () => {
    window.clearTimeout(voiceTimer.current)
    if (voiceState !== 'idle') return setVoiceState('idle')
    setVoiceState('listening')
    voiceTimer.current = window.setTimeout(() => {
      setVoiceState('thinking')
      voiceTimer.current = window.setTimeout(() => {
        setVoiceState('speaking')
        voiceTimer.current = window.setTimeout(() => setVoiceState('idle'), 4200)
      }, 1800)
    }, 3200)
  }
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return <main className={voiceState === 'idle' ? 'experience' : 'experience is-speaking'}>
    <div className="noise" />
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Nasus, inicio"><span className="brand__mark"><i /><i /><i /></span>NASUS</a>
      <div className="topbar__actions"><span className="topbar__coordinate">WORLD / NL-001</span><button type="button" className="contact-trigger" onClick={() => setContactOpen(true)}>CONTACTO <i>↗</i></button></div>
    </header>

    <div className="world" aria-live="polite">
      <Orb region={activeRegion} mode={voiceState} onActivate={beginConversation} onOpenCases={() => setCasesOpen(true)} />
      <p className={`voice-state voice-state--${voiceState}`}>{labels[voiceState]}</p>
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
        <div className="cases-panel__metrics" aria-label="Capacidades verificables"><div><strong>3</strong><span>PROYECTOS</span></div><div><strong>5</strong><span>ÁREAS DEL MUNDO</span></div><p>IA · WEB · AUTOMATIZACIÓN · DATOS · COMUNICACIÓN</p></div>
        <p className="cases-panel__question">¿Tienes algo parecido en mente?</p>
        <a className="cases-panel__cta" href="#contacto" onClick={() => setCasesOpen(false)}>Hablar sobre un proyecto <i>→</i></a>
      </aside>
    </div>}

    {contactOpen && <div className="cases-overlay contact-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactOpen(false) }}>
      <aside ref={panelRef} className="cases-panel contact-panel" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <button type="button" className="cases-panel__close" onClick={() => setContactOpen(false)} aria-label="Cerrar contacto">×</button>
        <p className="eyebrow">CONTACTO</p>
        <h2 id="contact-title">¿Tienes algo en mente?</h2>
        <p className="contact-panel__intro">Cuéntanos qué quieres construir.</p>
        <div className="contact-panel__actions">
          <button type="button" className="contact-panel__primary" onClick={() => { setContactOpen(false); beginConversation() }}>Hablar con Nasus <i>→</i></button>
          <button type="button" className="contact-panel__secondary" aria-disabled="true">Enviar mensaje <span>PRÓXIMAMENTE</span></button>
        </div>
        <div className="contact-panel__channels"><span>CANAL / 01</span><p>Arquitectura preparada para WhatsApp, correo, formulario y agenda.</p></div>
      </aside>
    </div>}

    <section className="hero" id="top">
      <div className="hero__copy">
        <p className="eyebrow">NASUS</p>
        <h1>Habla con<br />Nasus</h1>
        <p>Interactúa con inteligencia viva.</p>
        <button className="talk-button" onClick={beginConversation}>{voiceState === 'idle' ? 'Hablar con Nasus' : 'Terminar'}<i /></button>
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

    <footer id="contacto"><span>NASUS / INTELLIGENCE WORLD</span></footer>
    <nav className="route-nav" aria-label="Mapa de regiones">
      <span className="route-nav__origin">NL</span>
      {regions.map((region, index) => <button className={activeRegion === index ? 'is-active' : ''} onClick={() => goTo(region.id)} key={region.id} aria-label={`Ir a ${region.label}`}><i />{region.label}</button>)}
    </nav>
  </main>
}
