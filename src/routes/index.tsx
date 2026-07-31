import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gift,
  Instagram,
  LoaderCircle,
  LockKeyhole,
  Search,
  Sparkles,
  Star,
  TicketCheck,
  Users,
} from 'lucide-react'
import { getEvents, lookupMember, submitAttendance } from '@/server/points.functions'

export const Route = createFileRoute('/')({ component: Home })

type EventItem = Awaited<ReturnType<typeof getEvents>>[number]
type MemberResult = NonNullable<Awaited<ReturnType<typeof lookupMember>>>

const rewardTiers = [
  {
    name: 'Bronze',
    range: '50–99 points',
    className: 'bronze',
    perks: ['Instagram Close Friends', 'Member merch & prize box', 'Playlist curation access', 'Digital membership certificate'],
  },
  {
    name: 'Silver',
    range: '100–149 points',
    className: 'silver',
    perks: ['Everything in Bronze', 'Social media recognition', 'Career resource drop', 'Premium gifts & self-care kits'],
  },
  {
    name: 'Gold',
    range: '150+ points',
    className: 'gold',
    perks: ['Everything in Silver', 'Off-campus event access', 'Legacy Event fast pass', 'Wall of Fame recognition'],
  },
]

const categoryDetails = {
  legacy: { label: 'Legacy', points: 5, note: 'Big traditions. Whole community.' },
  culture: { label: 'Culture', points: 10, note: 'Expression, learning, and connection.' },
  soul: { label: 'Soul', points: 15, note: 'Growth, healing, and giving back.' },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  )
}

function Home() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [submitState, setSubmitState] = useState({ loading: false, message: '', error: '' })
  const [lookupState, setLookupState] = useState<{ loading: boolean; error: string; result: MemberResult | null }>(
    { loading: false, error: '', result: null },
  )

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(() => setSubmitState((state) => ({ ...state, error: 'Events are temporarily unavailable.' })))
      .finally(() => setEventsLoading(false))
  }, [])

  async function handleAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setSubmitState({ loading: true, message: '', error: '' })

    try {
      const result = await submitAttendance({
        data: {
          eventId: Number(formData.get('eventId')),
          name: String(formData.get('name') || ''),
          email: String(formData.get('email') || ''),
          membershipType: formData.get('membershipType') === 'premium' ? 'premium' : 'basic',
          membershipPaid: formData.get('membershipPaid') === 'on',
          zeffyCompleted: formData.get('zeffyCompleted') === 'on',
          socialHandle: String(formData.get('socialHandle') || ''),
          sharedSocial: formData.get('sharedSocial') === 'on',
          donationDollars: Number(formData.get('donationDollars') || 0),
          donationProof: String(formData.get('donationProof') || ''),
        },
      })
      setSubmitState({ loading: false, message: result.message, error: '' })
      form.reset()
    } catch (error) {
      setSubmitState({ loading: false, message: '', error: error instanceof Error ? error.message : 'Check-in failed.' })
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setLookupState({ loading: true, error: '', result: null })
    try {
      const result = await lookupMember({ data: { email: String(formData.get('lookupEmail') || '') } })
      setLookupState({ loading: false, error: result ? '' : 'No member record found for that email.', result })
    } catch (error) {
      setLookupState({ loading: false, result: null, error: error instanceof Error ? error.message : 'Lookup failed.' })
    }
  }

  const nextMilestone = useMemo(() => {
    const points = lookupState.result?.totalPoints ?? 0
    if (points < 50) return { label: 'Bronze', remaining: 50 - points, target: 50 }
    if (points < 100) return { label: 'Silver', remaining: 100 - points, target: 100 }
    if (points < 150) return { label: 'Gold', remaining: 150 - points, target: 150 }
    return { label: 'Gold status secured', remaining: 0, target: 150 }
  }, [lookupState.result])

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="AAAS Points home">
          <span className="brand-mark">A</span>
          <span><strong>AAAS</strong><small>Points Clubhouse</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#check-in">Check in</a>
          <a href="#my-points">My points</a>
          <a href="#rewards">Rewards</a>
        </nav>
        <a className="header-cta" href="#check-in">Earn points <ArrowRight size={16} /></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy reveal">
          <p className="eyebrow"><Sparkles size={15} /> Show up. Build community. Get rewarded.</p>
          <h1>Your presence<br />has <em>power.</em></h1>
          <p className="hero-lede">Every AAAS event brings you closer to exclusive experiences, recognition, and rewards made for our most engaged members.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#check-in">Check in to an event <ArrowRight size={18} /></a>
            <a className="text-link" href="#my-points">See my point total <ChevronRight size={17} /></a>
          </div>
        </div>
        <div className="point-stack reveal delay-one" aria-label="Point categories">
          {Object.entries(categoryDetails).map(([key, item], index) => (
            <article className={`point-card ${key}`} key={key} style={{ '--tilt': `${index % 2 ? 2 : -2}deg` } as CSSProperties}>
              <div><span>0{index + 1}</span><strong>{item.label}</strong><small>{item.note}</small></div>
              <b>+{item.points}<small>PTS</small></b>
            </article>
          ))}
        </div>
      </section>

      <section className="ticker" aria-label="Point earning reminder">
        <span>ATTEND</span><Star size={14} fill="currentColor" /><span>CONNECT</span><Star size={14} fill="currentColor" />
        <span>CONTRIBUTE</span><Star size={14} fill="currentColor" /><span>LEVEL UP</span><Star size={14} fill="currentColor" />
      </section>

      <section className="action-grid section-shell" id="check-in">
        <div className="section-heading">
          <p className="eyebrow dark">Member actions</p>
          <h2>Turn participation<br />into <em>privileges.</em></h2>
        </div>

        <article className="form-card attendance-card">
          <div className="card-number">01</div>
          <div className="card-heading"><TicketCheck /><div><p>Attendance form</p><h3>Claim event points</h3></div></div>
          <form onSubmit={handleAttendance}>
            <label>Event<select name="eventId" required defaultValue=""><option value="" disabled>Select today’s event</option>{events.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.points} points</option>)}</select></label>
            {eventsLoading && <p className="form-note"><LoaderCircle className="spin" size={15} /> Loading event calendar…</p>}
            <div className="field-pair"><label>Full name<input name="name" required placeholder="Jordan Carter" /></label><label>Email<input name="email" type="email" required placeholder="you@school.edu" /></label></div>
            <div className="field-pair"><label>Membership<select name="membershipType"><option value="basic">Basic · $15</option><option value="premium">Premium · $20</option></select></label><label>Instagram / social handle<input name="socialHandle" placeholder="@yourhandle" /></label></div>
            <div className="check-row"><label><input type="checkbox" name="membershipPaid" /><span><Check size={13} /> Membership paid</span></label><label><input type="checkbox" name="zeffyCompleted" /><span><Check size={13} /> Zeffy form complete</span></label></div>
            <div className="bonus-box">
              <p><Gift size={17} /> Add bonus opportunities</p>
              <label className="inline-check"><input type="checkbox" name="sharedSocial" /> I shared a photo/video from this event <b>+5</b></label>
              <div className="field-pair compact"><label>HHW donation dollars<input name="donationDollars" type="number" min="0" step="1" placeholder="0" /></label><label>Receipt / payment reference<input name="donationProof" placeholder="Receipt # or note" /></label></div>
            </div>
            <button className="submit-button" disabled={submitState.loading}>{submitState.loading ? <LoaderCircle className="spin" /> : <TicketCheck />} {submitState.loading ? 'Saving check-in…' : 'Submit attendance'}</button>
            {submitState.message && <p className="status success"><Check size={16} /> {submitState.message}</p>}
            {submitState.error && <p className="status error">{submitState.error}</p>}
          </form>
        </article>

        <article className="form-card lookup-card" id="my-points">
          <div className="card-number">02</div>
          <div className="card-heading"><Search /><div><p>Member portal</p><h3>Find my points</h3></div></div>
          <form className="lookup-form" onSubmit={handleLookup}><label>Email address<input type="email" name="lookupEmail" required placeholder="you@school.edu" /></label><button className="submit-button" disabled={lookupState.loading}>{lookupState.loading ? <LoaderCircle className="spin" /> : <Search />} Check my status</button></form>
          {lookupState.error && <div className="empty-state"><LockKeyhole /><p>{lookupState.error}</p><small>Use the same email submitted on attendance forms.</small></div>}
          {!lookupState.result && !lookupState.error && <div className="empty-state"><Award /><p>Your rewards live here.</p><small>Look up your member record to see attendance, bonus points, and unlocked privileges.</small></div>}
          {lookupState.result && <MemberSummary result={lookupState.result} nextMilestone={nextMilestone} />}
        </article>
      </section>

      <section className="events-section section-shell">
        <div className="section-heading inline"><div><p className="eyebrow dark">Fall 2026 calendar</p><h2>Every room is<br />an <em>opportunity.</em></h2></div><p>Complete the attendance form at every event to receive points. One verified check-in is awarded per member, per event.</p></div>
        <div className="event-list">{events.map((item, index) => { const detail = categoryDetails[item.category as keyof typeof categoryDetails]; return <article className="event-row" key={item.id}><span className="event-index">{String(index + 1).padStart(2, '0')}</span><time>{formatDate(item.eventDate)}</time><div><h3>{item.name}</h3><p>{item.description}</p></div><span className={`category-chip ${item.category}`}>{detail?.label ?? item.category}</span><b>+{item.points}</b></article> })}</div>
      </section>

      <section className="rewards-section" id="rewards">
        <div className="section-shell">
          <div className="section-heading rewards-heading"><div><p className="eyebrow">The reward ladder</p><h2>Community looks<br />good on <em>you.</em></h2></div><p>Rewards are distributed at select Culture and Soul Events, Hip-Hop Wednesday tabling, and members-only experiences.</p></div>
          <div className="reward-grid">{rewardTiers.map((tier, index) => <article className={`reward-card ${tier.className}`} key={tier.name}><div className="reward-icon">{index === 0 ? <Award /> : index === 1 ? <Star /> : <Crown />}</div><p>Tier {3 - index}</p><h3>{tier.name}</h3><strong>{tier.range}</strong><ul>{tier.perks.map((perk) => <li key={perk}><Check size={15} />{perk}</li>)}</ul></article>)}</div>
        </div>
      </section>

      <section className="bonus-section section-shell">
        <div className="bonus-title"><p className="eyebrow dark">Extra point opportunities</p><h2>Go beyond<br />the <em>check-in.</em></h2></div>
        <article><Instagram /><span><small>Share the moment</small><h3>Post an event photo or video</h3><p>Provide your social handle on the attendance form so participation can be connected to your record.</p></span><b>+5</b></article>
        <article><CircleDollarSign /><span><small>Hip-Hop Wednesday</small><h3>Support the fundraiser</h3><p>Provide a receipt or payment reference. Every full dollar donated earns five points.</p></span><b>5×</b></article>
      </section>

      <section className="membership-strip">
        <div><Users /><span><small>Basic membership · $15</small><strong>Official AAAS member access</strong></span></div>
        <div><Crown /><span><small>Premium membership · $20</small><strong>Shirt + one large-scale event each semester</strong></span></div>
        <div><Instagram /><span><small>Close Friends access</small><strong>Premium members or Bronze tier and above</strong></span></div>
      </section>

      <footer><div className="brand"><span className="brand-mark">A</span><span><strong>AAAS</strong><small>Points Clubhouse</small></span></div><p>Presence builds the culture.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  )
}

function MemberSummary({ result, nextMilestone }: { result: MemberResult; nextMilestone: { label: string; remaining: number; target: number } }) {
  const progress = Math.min(100, (result.totalPoints / nextMilestone.target) * 100)
  return <div className="member-summary"><div className="member-top"><div><small>Welcome back</small><h4>{result.member.name}</h4><span className={`member-tier ${result.rewardTier.toLowerCase().replace(' ', '-')}`}>{result.rewardTier}</span></div><div className="total-points"><strong>{result.totalPoints}</strong><span>total points</span></div></div><div className="progress-copy"><span>{nextMilestone.remaining > 0 ? `${nextMilestone.remaining} points to ${nextMilestone.label}` : nextMilestone.label}</span><b>{Math.round(progress)}%</b></div><div className="progress-track"><span style={{ transform: `scaleX(${progress / 100})` }} /></div><div className="member-metrics"><div><strong>{result.attendanceTotal}</strong><span>Event points</span></div><div><strong>{result.bonusTotal}</strong><span>Bonus points</span></div><div><strong>{result.attendance.length}</strong><span>Events attended</span></div></div><div className={`eligibility ${result.closeFriendsEligible ? 'unlocked' : ''}`}>{result.closeFriendsEligible ? <Check /> : <LockKeyhole />}<span><strong>Instagram Close Friends</strong><small>{result.closeFriendsEligible ? 'Access unlocked' : 'Unlock with Premium membership or Bronze status'}</small></span></div>{result.attendance.length > 0 && <div className="activity-list"><p>Recent activity</p>{result.attendance.slice(0, 3).map((item) => <div key={item.id}><span><CalendarDays />{item.name}</span><b>+{item.points}</b></div>)}</div>}</div>
}
