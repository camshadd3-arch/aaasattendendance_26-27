import { createServerFn } from '@tanstack/react-start'
async function getAdminSessionStore() {
  const { useAdminSession } = await import('@/utils/session.server')
  return useAdminSession()
}
function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getConfiguredAdminEmails() {
  return (process.env.AAAS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
}

function getAdminPassword() {
  const password = process.env.AAAS_ADMIN_PASSWORD
  if (!password) {
    throw new Error('AAAS_ADMIN_PASSWORD is not configured in Netlify.')
  }
  return password
}

function assertAuthConfig() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.')
  }

  if (getConfiguredAdminEmails().length === 0) {
    throw new Error('AAAS_ADMIN_EMAILS is not configured in Netlify.')
  }
}

export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getAdminSessionStore()
  const email = session.data.adminEmail
  return email ? { authenticated: true, email } : { authenticated: false }
})

export const loginAdmin = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string }) => {
    const email = normalizeEmail(data.email)
    const password = data.password

    if (!email.includes('@') || email.length > 160) {
      throw new Error('Enter a valid admin email address.')
    }
    if (!password || password.length < 1) {
      throw new Error('Enter the admin password.')
    }

    return { email, password }
  })
  .handler(async ({ data }) => {
    assertAuthConfig()

    const allowedEmails = getConfiguredAdminEmails()
    const expectedPassword = getAdminPassword()

    if (!allowedEmails.includes(data.email) || data.password !== expectedPassword) {
      throw new Error('Invalid admin email or password.')
    }

    const session = await getAdminSessionStore()
    await session.update({ adminEmail: data.email })

    return { authenticated: true, email: data.email }
  })

export const logoutAdmin = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getAdminSessionStore()
  await session.clear()
  return { authenticated: false }
})

export async function requireAdmin() {
  assertAuthConfig()

  const session = await getAdminSessionStore()
  const email = session.data.adminEmail

  if (!email || !getConfiguredAdminEmails().includes(normalizeEmail(email))) {
    throw new Error('You must be signed in as an AAAS admin to perform this action.')
  }

  return email
}
