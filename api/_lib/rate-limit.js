import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

const WINDOW_SECONDS = 60 * 60
const SCRIPT = `
local count = redis.call('INCRBY', KEYS[1], ARGV[2])
if count == tonumber(ARGV[2]) then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`

let redis

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('voice_rate_limit_not_configured')
  return (redis ??= new Redis({ url, token }))
}

function clientAddress(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown'
}

// `scope` separa los cubos por endpoint. `amount` es cuanto se le suma al cubo por esta
// llamada y `limit` el techo de ese cubo — para la sesion Realtime ambos se miden en
// segundos reservados (ver REALTIME_SESSION_SECONDS/REALTIME_SECONDS_LIMIT_PER_HOUR en
// voice-config.js), no en numero de requests: una sesion de voz cuesta segun cuanto dura,
// asi que el limite tiene que reflejar esa duracion reservada, no cuantas veces se llamo
// al endpoint. Si algun otro endpoint vuelve a usar este limitador por conteo simple de
// requests, puede seguir pasando amount=1 y su propio limit, tal como antes.
export async function consumeVoiceTurn(req, now = Date.now(), scope = 'voice', amount = 1, limit = 5) {
  const hour = Math.floor(now / 3_600_000)
  const fingerprint = createHash('sha256').update(clientAddress(req)).digest('hex').slice(0, 32)
  const key = `world-regions:${scope}:${fingerprint}:${hour}`
  const secondsUntilNextHour = Math.max(60, Math.ceil(((hour + 1) * 3_600_000 - now) / 1000))
  const [count, ttl] = await getRedis().eval(SCRIPT, [key], [String(Math.min(WINDOW_SECONDS, secondsUntilNextHour)), String(amount)])
  return {
    allowed: Number(count) <= limit,
    limit,
    remaining: Math.max(0, limit - Number(count)),
    retryAfter: Math.max(1, Number(ttl) || secondsUntilNextHour),
  }
}
