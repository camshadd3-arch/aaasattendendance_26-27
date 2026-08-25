import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  addBonusPointsForMember,
  archiveEvent,
  deleteAttendanceEntry,
  getAllEvents,
  getMemberDashboard,
  lookupMember,
  updateAttendancePoints,
  updateEvent,
deleteMember,
} from '@/server/points.functions'
import { EventManager } from '@/components/EventManager'
import { getAdminSession, loginAdmin, logoutAdmin } from '@/server/admin-auth.functions'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

type MemberRow = Awaited<ReturnType<typeof getMemberDashboard>>[number]
type MemberDetails = NonNullable<Awaited<ReturnType<typeof lookupMember>>>
type EventRow = Awaited<ReturnType<typeof getAllEvents>>[number]

function formatDate(value?: string | Date | null) {
  if (!value) return '-'

  let date: Date

  if (value instanceof Date) {
    date = value
  } else {
    const text = String(value).trim()

    if (!text) return '-'

    // Date-only database values need a local midday time to avoid
    // shifting to the previous day in some time zones.
    date = /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? new Date(`${text}T12:00:00`)
      : new Date(text)
  }

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function AdminPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')

const [events, setEvents] = useState<EventRow[]>([])
const [eventsLoading, setEventsLoading] = useState(true)
const [eventsError, setEventsError] = useState('')

const [search, setSearch] = useState('')

  const attendance = selectedMember?.attendance ?? []
  const bonuses = selectedMember?.bonuses ?? []

  async function loadMembers() {
    setLoading(true)
    setError('')
    try {
      const result = await getMemberDashboard()
      setMembers(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members.')
    } finally {
      setLoading(false)
    }
  }

  async function loadEvents() {
  setEventsLoading(true)
  setEventsError('')
  try {
    const result = await getAllEvents()
    setEvents(result)
  } catch (err) {
    setEventsError(err instanceof Error ? err.message : 'Failed to load events.')
  } finally {
    setEventsLoading(false)
  }
}

  async function loadMemberDetails(email: string) {
    setDetailsLoading(true)
    setDetailsError('')
    try {
      const result = await lookupMember({ data: { email } })
      if (!result) throw new Error('No member record found for that email.')
      setSelectedMember(result)
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Failed to load member details.')
      setSelectedMember(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    async function checkAdminSession() {
      setAuthLoading(true)
      try {
        const session = await getAdminSession()
        setAuthenticated(session.authenticated)
        if (session.authenticated) {
          setAdminEmail(session.email)
          await Promise.all([loadMembers(), loadEvents()])
        }
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Unable to verify admin access.')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAdminSession()
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    try {
      const result = await loginAdmin({
        data: {
          email: loginEmail,
          password: loginPassword,
        },
      })
      setAuthenticated(result.authenticated)
      setAdminEmail(result.email)
      setLoginPassword('')
      await Promise.all([loadMembers(), loadEvents()])
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleLogout() {
    await logoutAdmin()
    setAuthenticated(false)
    setAdminEmail('')
    setSelectedMember(null)
    setSelectedEmail(null)
    setMembers([])
    setEvents([])
  }

  async function openMember(member: MemberRow) {
    setSelectedEmail(member.email)
    await loadMemberDetails(member.email)
  }

  async function refreshSelectedMember() {
    if (!selectedEmail) return
    await loadMembers()
    await loadMemberDetails(selectedEmail)
  }

  async function handleEditAttendance(attendanceId: number, currentPoints: number) {
    const raw = window.prompt('Enter the new attendance points:', String(currentPoints))
    if (raw === null) return

    const pointsAwarded = Number(raw)
    if (!Number.isInteger(pointsAwarded) || pointsAwarded < 0) {
      setDetailsError('Attendance points must be a whole number 0 or greater.')
      return
    }

    setDetailsError('')
    try {
      await updateAttendancePoints({ data: { attendanceId, pointsAwarded } })
      await refreshSelectedMember()
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Unable to update attendance points.')
    }
  }

  async function handleDeleteAttendance(attendanceId: number) {
    const confirmed = window.confirm('Delete this attendance record? This cannot be undone.')
    if (!confirmed) return

    setDetailsError('')
    try {
      await deleteAttendanceEntry({ data: { attendanceId } })
      await refreshSelectedMember()
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Unable to delete attendance record.')
    }
  }

  async function handleAddBonus() {
    if (!selectedMember) return

    const detail = window.prompt('Enter a short description for this bonus:')
    if (detail === null) return

    const pointsRaw = window.prompt('How many bonus points?', '5')
    if (pointsRaw === null) return

    const pointsAwarded = Number(pointsRaw)
    if (!Number.isInteger(pointsAwarded) || pointsAwarded < 1) {
      setDetailsError('Bonus points must be a whole number greater than 0.')
      return
    }

    setDetailsError('')
    try {
      await addBonusPointsForMember({
        data: {
          memberId: selectedMember.member.id,
          pointsAwarded,
          detail: detail.trim(),
        },
      })
      await refreshSelectedMember()
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Unable to add bonus points.')
    }
  }

async function handleDeleteMember() {
  if (!selectedMember) return

  const typed = window.prompt(
    `Type the member's full name to confirm deleting ${selectedMember.member.name}:`
  )

  if (typed !== selectedMember.member.name) return

  try {
    await deleteMember({ data: { memberId: selectedMember.member.id } })
    await loadMembers()
    setSelectedMember(null)
    setSelectedEmail(null)
  } catch (err) {
    setDetailsError(err instanceof Error ? err.message : 'Unable to delete member.')
  }
}

  const totalMembers = members.length
  const totalPoints = members.reduce((sum, member) => sum + member.totalPoints, 0)

  const filteredMembers = members.filter((member) => {
  const query = search.trim().toLowerCase()
  if (!query) return true

  return [
    member.name,
    member.email,
    member.membershipType,
    member.rewardTier,
    member.socialHandle ?? '',
  ].some((value) => value.toLowerCase().includes(query))
})

  if (authLoading) {
    return (
      <main style={authPage}>
        <section style={loginCard}>
          <p style={loginEyebrow}>AAAS / EXECUTIVE ACCESS</p>
          <h1 style={title}>Admin Dashboard</h1>
          <p style={subtitle}>Verifying your admin session...</p>
        </section>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main style={authPage}>
        <section style={loginCard}>
          <p style={loginEyebrow}>AAAS / EXECUTIVE ACCESS</p>
          <h1 style={title}>Admin Dashboard</h1>
          <p style={loginIntro}>Sign in with an approved AAAS admin account to manage attendance, points, members, and events.</p>

          <form onSubmit={handleLogin} style={loginForm}>
            <label style={loginLabel}>
              Admin Email
              <input
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@school.edu"
                style={loginInput}
                required
              />
            </label>

            <label style={loginLabel}>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter admin password"
                style={loginInput}
                required
              />
            </label>

            {loginError && <p style={loginErrorStyle}>{loginError}</p>}

            <button type="submit" disabled={loginLoading} style={loginButton}>
              {loginLoading ? 'Signing in...' : 'Sign in to AAAS Admin'}
            </button>
          </form>

          <p style={loginNote}>Admin access is limited to emails configured by the Membership Chair/AAAS leadership.</p>
        </section>
      </main>
    )
  }

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <p style={loginEyebrow}>SIGNED IN AS {adminEmail}</p>
          <h1 style={title}>AAAS Admin Dashboard</h1>
          <p style={subtitle}>View all members in one place.</p>
        </div>

        <div style={headerActions}>
          <div style={stats}>
            <StatCard label="Members" value={String(totalMembers)} />
            <StatCard label="Total points" value={String(totalPoints)} />
          </div>
          <button type="button" onClick={handleLogout} style={secondaryButton}>
            Sign out
          </button>
        </div>
      </section>

      {loading && <p style={message}>Loading members...</p>}
      {error && <p style={{ ...message, color: 'crimson' }}>{error}</p>}

      {!loading && !error && (
        <section style={layout}>
          <div style={tableCard}>
            <div style={{ padding: '16px 18px 0' }}>
  <input
    type="text"
    placeholder="Search members by name, email, tier, or handle..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      width: '100%',
      padding: '12px 14px',
      border: '1px solid #cbbda8',
      borderRadius: 12,
      fontSize: 16,
      outline: 'none',
      boxSizing: 'border-box',
    }}
  />
</div>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Membership</th>
                    <th style={th}>Total Points</th>
                    <th style={th}>Attendance</th>
                    <th style={th}>Tier</th>
                  </tr>
                </thead>
                <tbody>
                 {filteredMembers.map((member) => {
                    const isSelected = selectedEmail === member.email
                    return (
                      <tr
                        key={member.id}
                        onClick={() => openMember(member)}
                        style={{
                          ...row,
                          background: isSelected ? '#f5f0e6' : 'transparent',
                        }}
                      >
                        <td style={td}><strong>{member.name}</strong></td>
                        <td style={td}>{member.email}</td>
                        <td style={td}>{member.membershipType}</td>
                        <td style={td}>{member.totalPoints}</td>
                        <td style={td}>{member.attendanceCount}</td>
                        <td style={td}>{member.rewardTier}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {filteredMembers.length === 0 && (
  <p style={{ padding: '16px 18px' }}>No members match your search.</p>
)}
              </table>
            </div>
          </div>

          <aside style={detailCard}>
            <h2 style={detailTitle}>Member details</h2>

            {!selectedMember && !detailsLoading && !detailsError && (
              <p style={message}>Click a member to see attendance history and bonus points.</p>
            )}

            {detailsLoading && <p style={message}>Loading member details...</p>}

            {detailsError && <p style={{ ...message, color: 'crimson' }}>{detailsError}</p>}

            {selectedMember && (
              <div style={{ display: 'grid', gap: 20 }}>
                <div style={summaryBox}>
                  <div>
                    <h3 style={memberName}>{selectedMember.member.name}</h3>
                    <p style={muted}>{selectedMember.member.email}</p>
                  </div>

                  <div style={badge}>{selectedMember.rewardTier}</div>
                </div>

                <button type="button" onClick={handleAddBonus} style={primaryButton}>
                  + Add bonus points
                </button>

                <button type="button" onClick={handleDeleteMember} style={dangerButton}>
  Delete member
</button>

                <div style={miniGrid}>
                  <MiniStat label="Total points" value={String(selectedMember.totalPoints)} />
                  <MiniStat label="Attendance points" value={String(selectedMember.attendanceTotal)} />
                  <MiniStat label="Bonus points" value={String(selectedMember.bonusTotal)} />
                  <MiniStat label="Events attended" value={String((selectedMember.attendance ?? []).length)} />
                </div>

                <div style={infoGrid}>
                  <InfoLine label="Membership" value={selectedMember.member.membershipType} />
                  <InfoLine label="Paid" value={selectedMember.member.membershipPaid ? 'Yes' : 'No'} />
                  <InfoLine label="Zeffy" value={selectedMember.member.zeffyCompleted ? 'Yes' : 'No'} />
                  <InfoLine label="Handle" value={selectedMember.member.socialHandle || '-'} />
                  <InfoLine
                    label="Close Friends"
                    value={selectedMember.closeFriendsEligible ? 'Unlocked' : 'Locked'}
                  />
                </div>

                <div>
                  <h4 style={sectionHeading}>Attendance history</h4>
                  {(selectedMember?.attendance ?? []).length === 0 ? (
                    <p style={muted}>No attendance recorded yet.</p>
                  ) : (
                    <div style={list}>
                      {(selectedMember?.attendance ?? []).map((item) => (
                        <div key={item.id} style={listItem}>
                          <div>
                            <strong>{item.name}</strong>
                            <p style={mutedSmall}>
                              {formatDate(item.date)} · {item.category}
                            </p>
                          </div>

                          <div style={rowActions}>
                            <strong>+{item.points}</strong>
                            <button
                              type="button"
                              onClick={() => handleEditAttendance(item.id, item.points)}
                              style={secondaryButton}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttendance(item.id)}
                              style={dangerButton}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={sectionHeading}>Bonus points</h4>
                  {(selectedMember?.bonuses ?? []).length === 0 ? (
                    <p style={muted}>No bonus points recorded yet.</p>
                  ) : (
                    <div style={list}>
                      {(selectedMember?.bonuses ?? []).map((item) => (
                        <div key={item.id} style={listItem}>
                          <div>
                            <strong>{item.detail || item.type}</strong>
                            <p style={mutedSmall}>{formatDate(item.createdAt)}</p>
                          </div>
                          <strong>+{item.pointsAwarded}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      <EventManager />
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <span style={mutedSmall}>{label}</span>
      <strong style={statValue}>{value}</strong>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStat}>
      <span style={mutedSmall}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoLine}>
      <span style={mutedSmall}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const authPage: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#171717',
  color: '#f5f0e6',
  fontFamily: 'system-ui, sans-serif',
}

const loginCard: CSSProperties = {
  width: 'min(100%, 520px)',
  padding: 36,
  border: '1px solid #625e56',
  borderRadius: 24,
  background: '#fffaf0',
  color: '#171717',
  boxShadow: '12px 12px 0 #d7ff4f',
}

const loginEyebrow: CSSProperties = {
  margin: '0 0 10px',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const loginIntro: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  margin: '18px 0 0',
  color: '#5c574e',
}

const loginForm: CSSProperties = {
  display: 'grid',
  gap: 16,
  marginTop: 28,
}

const loginLabel: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const loginInput: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  padding: '0 14px',
  border: '1px solid #171717',
  borderRadius: 12,
  background: '#f5f0e6',
  fontSize: 16,
}

const loginButton: CSSProperties = {
  minHeight: 50,
  border: 'none',
  borderRadius: 12,
  background: '#171717',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const loginErrorStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: 10,
  background: '#ffd2c4',
  color: '#8b1c1c',
  fontSize: 13,
}

const loginNote: CSSProperties = {
  margin: '20px 0 0',
  fontSize: 12,
  lineHeight: 1.5,
  color: '#6f6a61',
}

const page: CSSProperties = {
  minHeight: '100vh',
  background: '#f5f0e6',
  padding: '32px',
  color: '#171717',
  fontFamily: 'system-ui, sans-serif',
}

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: 24,
  marginBottom: 28,
  flexWrap: 'wrap',
}

const title: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(2rem, 4vw, 4rem)',
  lineHeight: 1,
  margin: 0,
}

const subtitle: CSSProperties = {
  fontSize: 22,
  marginTop: 18,
  marginBottom: 0,
}

const headerActions: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  gap: 12,
  flexWrap: 'wrap',
}

const stats: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const statCard: CSSProperties = {
  minWidth: 140,
  padding: '14px 16px',
  border: '1px solid #d7cfc0',
  borderRadius: 14,
  background: '#fffaf0',
  display: 'grid',
  gap: 6,
}

const statValue: CSSProperties = {
  fontSize: 28,
}

const layout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)',
  gap: 20,
  alignItems: 'start',
}

const tableCard: CSSProperties = {
  border: '1px solid #d7cfc0',
  borderRadius: 18,
  background: '#fffaf0',
  overflow: 'hidden',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '16px 18px',
  borderBottom: '1px solid #d7cfc0',
  fontSize: 16,
}

const td: CSSProperties = {
  padding: '16px 18px',
  borderBottom: '1px solid #ece3d3',
  verticalAlign: 'top',
}

const row: CSSProperties = {
  cursor: 'pointer',
}

const detailCard: CSSProperties = {
  border: '1px solid #d7cfc0',
  borderRadius: 18,
  background: '#fffaf0',
  padding: 20,
  display: 'grid',
  gap: 16,
}

const detailTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
}

const summaryBox: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'start',
}

const memberName: CSSProperties = {
  margin: 0,
  fontSize: 24,
}

const badge: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#171717',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
}

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 14px',
  background: '#171717',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  border: '1px solid #cbbda8',
  borderRadius: 10,
  padding: '8px 10px',
  background: '#fff',
  cursor: 'pointer',
}

const dangerButton: CSSProperties = {
  border: '1px solid #d8a7a7',
  borderRadius: 10,
  padding: '8px 10px',
  background: '#fff5f5',
  color: '#8b1c1c',
  cursor: 'pointer',
}

const rowActions: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'end',
}

const miniGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const miniStat: CSSProperties = {
  border: '1px solid #e0d6c6',
  borderRadius: 14,
  padding: 12,
  display: 'grid',
  gap: 6,
  background: '#fff',
}

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const infoLine: CSSProperties = {
  border: '1px solid #e0d6c6',
  borderRadius: 14,
  padding: 12,
  display: 'grid',
  gap: 6,
  background: '#fff',
}

const sectionHeading: CSSProperties = {
  margin: '0 0 10px',
  fontSize: 18,
}

const list: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const listItem: CSSProperties = {
  border: '1px solid #e0d6c6',
  borderRadius: 14,
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  background: '#fff',
}

const message: CSSProperties = {
  margin: 0,
  fontSize: 16,
}

const muted: CSSProperties = {
  margin: 0,
  color: '#6b6257',
}

const mutedSmall: CSSProperties = {
  margin: 0,
  color: '#6b6257',
  fontSize: 13,
}