# CLAUDE.md

Guía para Claude Code en este repositorio.

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
src/voice/useVoiceAssistant.js            micrófono, reproducción, señales
api/assistant.js                          endpoint del asistente
api/_lib/                                 elevenlabs, rate-limit, sanitize, voice-config
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

Flujo: tocar el orbe → consentimiento (una vez, en `localStorage`) → `getUserMedia` +
reconocimiento del navegador → `POST /api/assistant` → Claude responde → ElevenLabs
sintetiza → se reproduce midiendo el nivel de salida.

`voiceMachine.js` mantiene los estados aislados del renderer. `useVoiceAssistant`
devuelve `signals` como un **ref mutado en sitio**, no estado de React: el orbe lo lee
cada frame sin provocar re-render.

En iOS el `AudioContext` se desbloquea dentro del gesto de clic, **antes de cualquier
`await`**. Mover ese desbloqueo después de un `await` rompe el audio en Safari.

En reposo el asistente no consume nada: los `AnalyserNode` y sus bucles de rAF se crean
en `start()` y se destruyen al parar.

## Variables de entorno

Todas **exclusivamente del lado del servidor**. Nunca con prefijo `VITE_`, nunca en el
bundle del cliente.

```
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

`api/assistant.js` **falla cerrado a propósito**: sin credenciales de Upstash el
limitador lanza y el endpoint responde 503 antes de llamar a Anthropic. Eso es
intencional, no un bug. Sin ElevenLabs degrada a 200 con `warning: 'tts_unavailable'`.

Límite: cinco conversaciones por hora y por IP, con la IP hasheada.
