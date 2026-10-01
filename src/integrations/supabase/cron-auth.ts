// Authenticate scheduled translation requests.
// Vercel Cron should send the configured CRON_SECRET as a Bearer token.
export async function authenticateCronRequest(
  request: Request,
): Promise<Response | null> {
  const configuredSecret = process.env['CRON_SECRET']
  if (!configuredSecret) {
    return new Response('Cron is not configured', { status: 503 })
  }

  const match = /^Bearer ([^\s,]+)$/.exec(
    request.headers.get('authorization') ?? '',
  )
  const token = match?.[1]
  if (!token) return new Response('Unauthorized', { status: 401 })

  const { createHash, timingSafeEqual } = await import('node:crypto')
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
  const providedDigest = digest(token)
  const expectedDigest = digest(configuredSecret)

  if (!timingSafeEqual(providedDigest, expectedDigest)) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}
