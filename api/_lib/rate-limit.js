import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

const LIMIT = 5
const WINDOW_SECONDS = 60 * 60
const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
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

export async function consumeVoiceTurn(req, now = Date.now()) {
  const hour = Math.floor(now / 3_600_000)
  const fingerprint = createHash('sha256').update(clientAddress(req)).digest('hex').slice(0, 32)
  const key = `world-regions:voice:${fingerprint}:${hour}`
  const secondsUntilNextHour = Math.max(60, Math.ceil(((hour + 1) * 3_600_000 - now) / 1000))
  const [count, ttl] = await getRedis().eval(SCRIPT, [key], [String(Math.min(WINDOW_SECONDS, secondsUntilNextHour))])
  return {
    allowed: Number(count) <= LIMIT,
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - Number(count)),
    retryAfter: Math.max(1, Number(ttl) || secondsUntilNextHour),
  }
}

