# AGENTS.md

Guía para Codex en este repositorio.

## Comandos

```bash
npm run dev       # Vite con HMR
npm run build     # Build de producción
npm run lint      # ESLint
npm run preview   # Sirve dist/ (añade --host para probar desde el teléfono)
```

## Qué es

**NASUS — World Regions.** Sitio de una sola página para NASUS: un orbe interactivo
dibujado en Canvas 2D que el visitante recorre con scroll, atravesando cinco sub-mundos
(IA, Automatización, WhatsApp, Web, Datos). Incluye un asistente de voz real que se
activa al tocar el orbe.

**Stack**: React 19 + Vite 8, sin router (una sola vista), PWA con vite-plugin-pwa,
Vercel Analytics, y una función serverless en Vercel para el asistente.

No hay base de datos, ni autenticación, ni rutas. El proyecto anterior (whatif-lat) fue
eliminado por completo en `7c92bc4`.

## Arquitectura

```
src/main.jsx                              punto de entrada
src/App.jsx                               shell: hero, 5 secciones, nav, paneles
src/index.css                             estilos (archivo único, muy compacto)
src/components/Orb.jsx                    ciclo de vida del canvas: rAF, scroll, punteros
src/components/orb/nasusOrbEngine.js      el renderer completo
src/components/orb/regions/
    regionAnchors.js                      REGION_ANCHORS + proyección
    iaSubworld.js  automationSubworld.js  dataSubworld.js
src/voice/voiceMachine.js                 máquina de estados aislada
src/voice/useVoiceAssistant.js            WebRTC, medidores de nivel, señales
api/realtime-session.js                   emite el token efímero de OpenAI Realtime
api/_lib/                                 rate-limit, voice-config
```

**Ojo**: solo tres sub-mundos viven en `regions/`. WhatsApp y Web están implementados
dentro de `nasusOrbEngine.js` como `paintWhatsappWorld` y `paintWebWorld`.

## El renderer

`renderNasusOrb(ctx, model, opts)` dibuja un frame completo. Por frame:

1. `regionalStateAt(progress)` → región activa y pesos de las cinco
2. `cameraAt` + los cinco bloques de transición orbital ajustan `view`
3. `stepSimulation` integra la física de nodos sobre la esfera unitaria
4. `projectNodes` proyecta a pantalla y aplica la deformación elástica de voz
5. `proximityEdges` + `smoothEdges` construyen la malla con opacidad suavizada
6. se pinta: halo, ondas globales, aristas, pulsos, nodos, retículas, sub-mundo activo

`model` es un array de nodos con propiedades adjuntas (`springs`, `edgeStates`,
`anchors`, cachés de WhatsApp y Web). `createOrbModel(count)` lo construye.

### Invariantes que no se rompen

- Los nodos viven **siempre sobre la esfera unitaria**. `stepSimulation` reproyecta al
  final de cada paso; cualquier fuerza nueva debe pasar por ahí.
- `REGION_ANCHORS` son posiciones normalizadas fijas (`|v| = 1`), pensadas para que la
  cámara no derive entre sesiones. No se tocan sin motivo explícito.
- La deformación elástica de voz modifica `radialScale` al proyectar, **no** las
  posiciones físicas base.

### Validar cambios de física o renderer

Comprobar que los cinco anchors siguen normalizados, que todos los nodos siguen sobre la
esfera tras simular, y que las cinco regiones siguen pintando en móvil y escritorio. El
motor se puede cargar en Node con un `ctx` simulado: no necesita navegador, y así se
mide coste de JS y operaciones de pintado sin depender de un dispositivo.

## Scroll → cámara

`progress` va de 0 a 5: los picos de región caen en los enteros 0..4, y 5 es el cierre.

`trackScroll` en `Orb.jsx` **interpola entre las posiciones reales de las secciones
`[data-region]` en el DOM**, remedidas en cada resize. No usa múltiplos fijos de
`innerHeight`: eso asumía que el alto CSS del hero (`svh`) y el de las regiones (`vh`)
coincidían, lo que solo se cumple en escritorio — en móvil la barra de URL los separa y
la cámara llegaba a su encuadre antes que el texto.

`regionalFocus` es un segundo eje, independiente de `progress`: vale 0 en el hero y 1 al
llegar a la primera región. Varios ajustes de encuadre se ponderan con él.

## Móvil

El corte es `width < 700`. Escritorio es `width >= 1100`; entre ambos hay una franja
intermedia. Buena parte del trabajo reciente consistió en corregir un patrón repetido:
**valores en píxeles absolutos dentro de composiciones relativas al viewport**.

La regla de oro: si una medida se compara contra el tamaño del orbe o del viewport, tiene
que escalar con él. `base = min(width, height) * .49 * zoom` es la altura en escritorio y
el **ancho** en un teléfono, así que los zoom regionales que caben en uno desbordan en el
otro; `whatsappFit`, `webFit` y `heroFit` amortiguan eso solo bajo 700px.

Al tocar cualquier constante de móvil, verificar que escritorio no cambia: casi todas las
ramas están escritas para que el factor valga exactamente 1 en viewports grandes.

DPR interno: tope de 1.75 en móvil, 1.6 en la franja intermedia, 2 en escritorio. El
canvas se sincroniza con su caja vía `ResizeObserver`, no solo con `window.resize`.

## Asistente de voz

Voz-a-voz nativo: **WebRTC directo entre el navegador y OpenAI Realtime**, sin servidor
intermedio de audio (antes del 2026-08-31 era una cadena ElevenLabs STT → Claude sin
streaming → ElevenLabs TTS, todo por HTTP bloqueante — se migró para eliminar el silencio
muerto de 4-8s que generaba esa cadena). `api/realtime-session.js` es el único hop por
conversación: solo emite un token efímero; todo lo demás (VAD, turno, la respuesta del
modelo, su audio hablado) vive en la sesión en vivo navegador↔OpenAI.

Flujo: tocar el orbe → consentimiento (una vez, en `localStorage`) → `POST
/api/realtime-session` (token efímero) → `getUserMedia` → `RTCPeerConnection` (pista del
mic + data channel `oai-events`) → intercambio SDP contra `/v1/realtime/calls` → sesión en
vivo. La detección de fin de turno es del lado de OpenAI (`REALTIME_TURN_DETECTION` en
`voice-config.js`), no del cliente.

`voiceMachine.js` mantiene los estados aislados del renderer. `useVoiceAssistant`
devuelve `signals` como un **ref mutado en sitio**, no estado de React: el orbe lo lee
cada frame sin provocar re-render. `inputLevel`/`outputLevel` se miden con `AnalyserNode`
igual que antes (mic y pista remota de WebRTC respectivamente) — ya no deciden el fin de
turno, solo alimentan la deformación visual.

En iOS el `AudioContext` se desbloquea dentro del gesto de clic, **antes de cualquier
`await`**. Mover ese desbloqueo después de un `await` rompe el audio en Safari.

En reposo el asistente no consume nada: la conexión WebRTC, los `AnalyserNode` y sus
bucles de rAF se crean en `start()` y se destruyen al parar. La sesión se cierra sola al
terminar la respuesta (un intercambio por toque).

## Variables de entorno

Todas **exclusivamente del lado del servidor**. Nunca con prefijo `VITE_`, nunca en el
bundle del cliente.

```
OPENAI_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Opcionales, con default en `api/_lib/voice-config.js` si se omiten:

```
OPENAI_REALTIME_MODEL             # default 'gpt-realtime'
OPENAI_REALTIME_VOICE             # default 'verse'
REALTIME_SESSION_SECONDS          # default 180 — techo de duración por sesión (expires_after)
REALTIME_SECONDS_LIMIT_PER_HOUR   # default 900 — presupuesto de segundos reservados por IP/hora
```

`api/realtime-session.js` **falla cerrado a propósito**: sin credenciales de Upstash el
limitador lanza y el endpoint responde 503 antes de mintear el token. Eso es intencional,
no un bug.

Límite: no es un conteo de requests, es un presupuesto de segundos reservados por hora y
por IP (hasheada) — cada sesión cobra `REALTIME_SESSION_SECONDS` contra ese presupuesto,
porque el costo real de una sesión Realtime depende de cuánto dura, no de si el endpoint
se llamó una vez.
