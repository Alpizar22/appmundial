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

export default function App() {
  const [activeRegion, setActiveRegion] = useState(0)
  const [voiceState, setVoiceState] = useState('idle')
  const voiceTimer = useRef(null)

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
      <a className="brand" href="#top" aria-label="Nasus Labs, inicio"><span className="brand__mark"><i /><i /><i /></span>NASUS <em>LABS</em></a>
      <span className="topbar__coordinate">WORLD / NL-001</span>
    </header>

    <div className="world" aria-live="polite">
      <Orb region={activeRegion} mode={voiceState} onActivate={beginConversation} />
      <p className={`voice-state voice-state--${voiceState}`}>{labels[voiceState]}</p>
      <div className="world__crosshair world__crosshair--a" /><div className="world__crosshair world__crosshair--b" />
    </div>

    <section className="hero" id="top">
      <div className="hero__copy">
        <p className="eyebrow">NASUS LABS</p>
        <h1>Habla con Nasus</h1>
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

    <footer id="contacto"><span>NASUS LABS / INTELLIGENCE WORLD</span></footer>
    <nav className="route-nav" aria-label="Mapa de regiones">
      <span className="route-nav__origin">NL</span>
      {regions.map((region, index) => <button className={activeRegion === index ? 'is-active' : ''} onClick={() => goTo(region.id)} key={region.id} aria-label={`Ir a ${region.label}`}><i />{region.label}</button>)}
    </nav>
  </main>
}
