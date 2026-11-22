// Logo de Nasus: lápiz entre corchetes de código + NASUS en bloque (mismo que nasus.lat).
// Todo son paths: se ve idéntico en cualquier dispositivo.
const GOLD = '#c4a882', GOLD_L = '#ecdcb9', GOLD_D = '#a88b5c', CYAN = '#00f2ff'
const BLOCK = {
  N: 'M0 0H24L56 52V0H80V100H56L24 48V100H0Z',
  A: 'M0 100V28L14 0H66L80 28V100H56V72H24V100ZM26 24V48H54V24Z',
  S: 'M0 0H80V22H24V39H80V100H0V78H56V61H0Z',
  U: 'M0 0H24V72H56V0H80V92L72 100H8L0 92Z',
}

export default function Logo() {
  return <>
    <svg className="brand__logo" viewBox="184 139 432 302" fill="none" aria-hidden="true">
      <defs><linearGradient id="logo-pencil" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={GOLD_D} /><stop offset=".5" stopColor={GOLD} /><stop offset="1" stopColor={GOLD_L} /></linearGradient></defs>
      <g fill="none" stroke={CYAN} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"><polyline points="267,215 205,290 267,365" /><polyline points="533,215 595,290 533,365" /></g>
      <g transform="translate(400 290) rotate(25)">
        <path d="M-39 -128 a39 11 0 0 1 78 0 V60 H-39Z" fill="url(#logo-pencil)" />
        <ellipse cx="0" cy="-128" rx="39" ry="11" fill={GOLD_L} /><ellipse cx="0" cy="-128" rx="26" ry="6.5" fill={GOLD_D} />
        <path d="M-39 60 H39 L0 138Z" fill="#f3e9d2" /><path d="M0 60 H39 L0 138Z" fill="#d9c79f" opacity=".7" /><path d="M-14 110 H14 L0 138Z" fill={CYAN} />
      </g>
    </svg>
    <svg className="brand__word" viewBox="0 0 456 100" fill="currentColor" role="img" aria-label="Nasus">
      {'NASUS'.split('').map((ch, i) => <path key={i} transform={`translate(${i * 94} 0)`} d={BLOCK[ch]} />)}
    </svg>
  </>
}
