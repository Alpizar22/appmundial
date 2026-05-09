import { useState } from 'react'
import { Helmet } from 'react-helmet-async'

const FAQS = [
  {
    q: '¿Cómo organizo mis cromos repetidos?',
    a: 'Ve a la sección "Repetidos" en el menú inferior. Ahí verás todos los cromos que tienes más de una copia. Puedes eliminar repetidos de uno en uno para mantener tu inventario actualizado y saber exactamente cuáles tienes disponibles para intercambiar.',
  },
  {
    q: '¿Cómo sé qué cartas me faltan para completar el álbum?',
    a: 'En "Mi colección" puedes ver los 980 cromos del álbum. Los que no tienes aparecen con cantidad 0. En el Dashboard también ves tu porcentaje de avance. Con SoccerSticker Pro obtienes estadísticas avanzadas: la carta más difícil de conseguir, cuántos sobres necesitarías y el progreso por selección.',
  },
  {
    q: '¿Cómo hago un intercambio con otro coleccionista?',
    a: 'Entra a "Intercambios", publica qué cromo ofreces y cuál necesitas. Otros usuarios verán tu oferta en el mapa. Cuando encuentres un intercambio compatible, inicia un chat desde la sección "Chat" (función Pro) para coordinar el intercambio directamente.',
  },
  {
    q: '¿Qué incluye SoccerSticker Pro y cuánto cuesta?',
    a: 'SoccerSticker Pro es un pago único de $2.99 USD (sin suscripción mensual). Incluye: 12 temas visuales exclusivos, 24 avatares emoji, título personalizado, badge Pro, dashboard con estadísticas avanzadas, chat en tiempo real con coleccionistas compatibles y soporte prioritario.',
  },
  {
    q: '¿Puedo usar SoccerSticker sin conexión a internet?',
    a: 'SoccerSticker es una Progressive Web App (PWA). Puedes instalarla en tu celular desde el navegador y acceder a tu colección sin internet. Los cambios se sincronizan automáticamente cuando recuperas la conexión.',
  },
  {
    q: '¿En qué idiomas está disponible la app?',
    a: 'SoccerSticker está disponible en español (México) e inglés. Puedes cambiar el idioma desde tu perfil en cualquier momento.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section className="faq-section">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <h2 className="faq-section__title">Preguntas frecuentes</h2>
      <div className="faq-list">
        {FAQS.map(({ q, a }, i) => (
          <div key={i} className={`faq-item${open === i ? ' faq-item--open' : ''}`}>
            <button
              className="faq-item__question"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span>{q}</span>
              <span className="faq-item__chevron" aria-hidden="true">
                {open === i ? '▲' : '▼'}
              </span>
            </button>
            {open === i && <p className="faq-item__answer">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
