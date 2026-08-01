import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type CSSProperties } from 'react'
import { getAllMembers } from '@/server/points.functions'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

type MemberRow = Awaited<ReturnType<typeof getAllMembers>>[number]

function AdminPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllMembers()
      .then(setMembers)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load members.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>AAAS Admin Dashboard</h1>
      <p style={{ marginBottom: 24 }}>View all members in one place.</p>

      {loading && <p>Loading members...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Membership</th>
                <th style={th}>Paid</th>
                <th style={th}>Zeffy</th>
                <th style={th}>Handle</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td style={td}>{member.name}</td>
                  <td style={td}>{member.email}</td>
                  <td style={td}>{member.membershipType}</td>
                  <td style={td}>{member.membershipPaid ? 'Yes' : 'No'}</td>
                  <td style={td}>{member.zeffyCompleted ? 'Yes' : 'No'}</td>
                  <td style={td}>{member.socialHandle || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '2px solid #ccc',
}

const td: CSSProperties = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5e5e5',
}