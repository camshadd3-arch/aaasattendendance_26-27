import { useEffect, useState } from 'react'
import {
  archiveEvent,
  getAllEvents,
  updateEvent,
} from '@/server/points.functions'

export function EventManager() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadEvents() {
    setLoading(true)
    try {
      const result = await getAllEvents()
      setEvents(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function handleArchive(eventId: number) {
    if (!confirm('Archive this event?')) return

    await archiveEvent({
      data: {
        eventId,
      },
    })

    await loadEvents()
  }

  async function handleEdit(event: any) {
    const name = prompt('Event name', event.name)
    if (!name) return

    const category = prompt('Category', event.category)
    if (!category) return

    const points = Number(prompt('Points', String(event.points)))
    if (Number.isNaN(points)) return

    const description = prompt(
      'Description',
      event.description ?? '',
    )

    await updateEvent({
      data: {
        eventId: event.id,
        name,
        category,
        points,
        description: description ?? '',
      },
    })

    await loadEvents()
  }

  if (loading) return <p>Loading events...</p>

  return (
    <div style={{ marginTop: 40 }}>
      <h2>Events</h2>

      {events.map((event) => (
        <div
          key={event.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 12,
            marginBottom: 8,
            border: '1px solid #ddd',
            borderRadius: 8,
          }}
        >
          <div>
            <strong>{event.name}</strong>
            <div>
              {event.category} • {event.points} pts
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleEdit(event)}>
              Edit
            </button>

            {event.active && (
              <button onClick={() => handleArchive(event.id)}>
                Archive
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}