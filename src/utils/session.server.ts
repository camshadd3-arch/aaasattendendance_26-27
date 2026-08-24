import { useSession } from '@tanstack/react-start/server'

type AdminSessionData = {
  adminEmail?: string
}

export function useAdminSession() {
  return useSession<AdminSessionData>({
    name: 'aaas-admin-session',
    password: process.env.SESSION_SECRET!,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    },
  })
}
