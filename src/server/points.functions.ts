import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { attendance, bonusPoints, events, members } from '../../db/schema.js'

type AttendanceInput = {
  eventId: number
  name: string
  email: string
  membershipType: 'basic' | 'premium'
  membershipPaid: boolean
  zeffyCompleted: boolean
  socialHandle?: string
  sharedSocial: boolean
  donationDollars: number
  donationProof?: string
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function validateEmailInput(data: { email: string }) {
  const email = normalizeEmail(data.email)
  if (!email.includes('@') || email.length > 160) {
    throw new Error('Enter a valid email address.')
  }
  return { email }
}

function validateAttendance(data: AttendanceInput) {
  const name = data.name.trim()
  const email = normalizeEmail(data.email)
  const socialHandle = data.socialHandle?.trim() || undefined
  const donationProof = data.donationProof?.trim() || undefined
  const donationDollars = Math.max(0, Math.floor(Number(data.donationDollars)))

  if (name.length < 2 || name.length > 100) throw new Error('Enter your full name.')
  if (!email.includes('@') || email.length > 160) throw new Error('Enter a valid email address.')
  if (!Number.isInteger(data.eventId) || data.eventId < 1) throw new Error('Choose an event.')
  if (data.sharedSocial && !socialHandle) throw new Error('Add your social handle to claim sharing points.')
  if (donationDollars > 0 && !donationProof) throw new Error('Add a receipt or payment reference for donation points.')
  if (donationDollars > 10000) throw new Error('Donation amount is outside the accepted range.')

  return { ...data, name, email, socialHandle, donationDollars, donationProof }
}

function getRewardTier(points: number) {
  if (points >= 150) return 'Gold'
  if (points >= 100) return 'Silver'
  if (points >= 50) return 'Bronze'
  return 'Rising Member'
}

export const getEvents = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(events).where(eq(events.active, true)).orderBy(asc(events.eventDate))
})

export const submitAttendance = createServerFn({ method: 'POST' })
  .inputValidator(validateAttendance)
  .handler(async ({ data }) => {
    const [event] = await db.select().from(events).where(eq(events.id, data.eventId)).limit(1)
    if (!event) throw new Error('That event is not available.')

    const [member] = await db
      .insert(members)
      .values({
        name: data.name,
        email: data.email,
        membershipType: data.membershipType,
        membershipPaid: data.membershipPaid,
        zeffyCompleted: data.zeffyCompleted,
        socialHandle: data.socialHandle,
      })
      .onConflictDoUpdate({
        target: members.email,
        set: {
          name: data.name,
          membershipType: data.membershipType,
          membershipPaid: data.membershipPaid,
          zeffyCompleted: data.zeffyCompleted,
          socialHandle: data.socialHandle,
          updatedAt: sql`now()`,
        },
      })
      .returning()

    if (!member) throw new Error('Unable to save your member profile.')

    const [duplicate] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.memberId, member.id), eq(attendance.eventId, event.id)))
      .limit(1)
    if (duplicate) throw new Error('You already checked in for this event.')

    await db.insert(attendance).values({
      memberId: member.id,
      eventId: event.id,
      pointsAwarded: event.points,
    })

    let bonus = 0
    if (data.sharedSocial && data.socialHandle) {
      bonus += 5
      await db.insert(bonusPoints).values({
        memberId: member.id,
        type: 'social_share',
        detail: `Event share verified by handle ${data.socialHandle}`,
        pointsAwarded: 5,
      })
    }

    if (data.donationDollars > 0 && data.donationProof) {
      const donationPoints = data.donationDollars * 5
      bonus += donationPoints
      await db.insert(bonusPoints).values({
        memberId: member.id,
        type: 'hhw_donation',
        detail: `$${data.donationDollars} donation — reference ${data.donationProof}`,
        pointsAwarded: donationPoints,
      })
    }

    return {
      success: true,
      earned: event.points + bonus,
      message: `${event.points + bonus} points added for ${event.name}.`,
    }
  })

export const lookupMember = createServerFn({ method: 'GET' })
  .inputValidator(validateEmailInput)
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(eq(members.email, data.email)).limit(1)
    if (!member) return null

    const attendanceRows = await db
      .select({
        id: attendance.id,
        name: events.name,
        category: events.category,
        date: events.eventDate,
        points: attendance.pointsAwarded,
        createdAt: attendance.checkedInAt,
      })
      .from(attendance)
      .innerJoin(events, eq(attendance.eventId, events.id))
      .where(eq(attendance.memberId, member.id))
      .orderBy(desc(attendance.checkedInAt))

    const bonusRows = await db
      .select()
      .from(bonusPoints)
      .where(eq(bonusPoints.memberId, member.id))
      .orderBy(desc(bonusPoints.createdAt))

    const attendanceTotal = attendanceRows.reduce((sum, row) => sum + row.points, 0)
    const bonusTotal = bonusRows.reduce((sum, row) => sum + row.pointsAwarded, 0)
    const totalPoints = attendanceTotal + bonusTotal

    return {
      member,
      attendance: attendanceRows,
      bonuses: bonusRows,
      attendanceTotal,
      bonusTotal,
      totalPoints,
      rewardTier: getRewardTier(totalPoints),
      closeFriendsEligible:
        member.membershipPaid &&
        member.zeffyCompleted &&
        (member.membershipType === 'premium' || totalPoints >= 50),
    }
  })

export const getAllMembers = createServerFn({ method: 'GET' }).handler(async () => {
  return db
    .select()
    .from(members)
    .orderBy(asc(members.name))
})

export const getMemberDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const memberRows = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      membershipType: members.membershipType,
      membershipPaid: members.membershipPaid,
      zeffyCompleted: members.zeffyCompleted,
      socialHandle: members.socialHandle,
    })
    .from(members)
    .orderBy(asc(members.name))

  const dashboard = await Promise.all(
    memberRows.map(async (member) => {
      const attendanceRows = await db
        .select({
          points: attendance.pointsAwarded,
        })
        .from(attendance)
        .where(eq(attendance.memberId, member.id))

      const bonusRows = await db
        .select({
          points: bonusPoints.pointsAwarded,
        })
        .from(bonusPoints)
        .where(eq(bonusPoints.memberId, member.id))

      const attendanceTotal = attendanceRows.reduce((sum, row) => sum + row.points, 0)
      const bonusTotal = bonusRows.reduce((sum, row) => sum + row.points, 0)
      const totalPoints = attendanceTotal + bonusTotal
      const attendanceCount = attendanceRows.length
      const rewardTier = getRewardTier(totalPoints)

      return {
        ...member,
        attendanceTotal,
        bonusTotal,
        totalPoints,
        attendanceCount,
        rewardTier,
      }
    }),
  )

  return dashboard
})