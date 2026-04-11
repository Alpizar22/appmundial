import confetti from 'canvas-confetti'

const colors = ['#c41e3a', '#f8fafc', '#0a3161', '#1e4d8c', '#93c5fd']

export function celebrateAlbumComplete() {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    confetti({ colors, particleCount: 22, spread: 65, ticks: 70, gravity: 1.1 })
    return
  }

  const fire = (opts) => confetti({ colors, ticks: 220, gravity: 1.05, ...opts })

  fire({ particleCount: 130, spread: 88, startVelocity: 48, origin: { y: 0.58, x: 0.5 } })

  window.setTimeout(() => {
    fire({ particleCount: 55, angle: 55, spread: 52, origin: { x: 0, y: 0.65 } })
    fire({ particleCount: 55, angle: 125, spread: 52, origin: { x: 1, y: 0.65 } })
  }, 220)

  window.setTimeout(() => {
    fire({ particleCount: 90, spread: 100, scalar: 0.9, origin: { y: 0.35 } })
  }, 450)
}
