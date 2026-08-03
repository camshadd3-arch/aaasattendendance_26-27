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

export const updateAttendancePoints = createServerFn({ method: 'POST' })
  .inputValidator((data: { attendanceId: number; pointsAwarded: number }) => {
    if (!Number.isInteger(data.attendanceId) || data.attendanceId < 1) {
      throw new Error('Invalid attendance record.')
    }
    if (!Number.isInteger(data.pointsAwarded) || data.pointsAwarded < 0) {
      throw new Error('Points must be a whole number.')
    }
    return data
  })
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(attendance)
      .set({ pointsAwarded: data.pointsAwarded })
      .where(eq(attendance.id, data.attendanceId))
      .returning({ id: attendance.id })

    if (!updated) throw new Error('Attendance record not found.')
    return { success: true }
  })

export const deleteAttendanceEntry = createServerFn({ method: 'POST' })
  .inputValidator((data: { attendanceId: number }) => {
    if (!Number.isInteger(data.attendanceId) || data.attendanceId < 1) {
      throw new Error('Invalid attendance record.')
    }
    return data
  })
  .handler(async ({ data }) => {
    const [deleted] = await db
      .delete(attendance)
      .where(eq(attendance.id, data.attendanceId))
      .returning({ id: attendance.id })

    if (!deleted) throw new Error('Attendance record not found.')
    return { success: true }
  })

export const addBonusPointsForMember = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { memberId: number; pointsAwarded: number; detail: string; type?: string }) => {
      if (!Number.isInteger(data.memberId) || data.memberId < 1) {
        throw new Error('Invalid member.')
      }
      if (!Number.isInteger(data.pointsAwarded) || data.pointsAwarded < 1) {
        throw new Error('Points must be a whole number greater than 0.')
      }
      const detail = data.detail.trim()
      if (detail.length < 2) throw new Error('Add a short detail for the bonus.')
      return { ...data, detail }
    },
  )
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(eq(members.id, data.memberId)).limit(1)
    if (!member) throw new Error('Member not found.')

    const [created] = await db
      .insert(bonusPoints)
      .values({
        memberId: data.memberId,
        type: data.type || 'manual_adjustment',
        detail: data.detail,
        pointsAwarded: data.pointsAwarded,
      })
      .returning({ id: bonusPoints.id })

    if (!created) throw new Error('Unable to add bonus points.')
    return { success: true }
  })
  export const archiveEvent = createServerFn({ method: 'POST' })
  .inputValidator((data: { eventId: number }) => {
    if (!Number.isInteger(data.eventId) || data.eventId < 1) {
      throw new Error('Invalid event.')
    }
    return data
  })
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(events)
      .set({
        active: false,
    })
      .where(eq(events.id, data.eventId))
      .returning({ id: events.id })

    if (!updated) {
      throw new Error('Event not found.')
    }

    return { success: true }
  })
  export const getAllEvents = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(events).orderBy(asc(events.eventDate))
})

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator((data: { eventId: number; name: string; category: string; points: number; description?: string }) => {
    if (!Number.isInteger(data.eventId) || data.eventId < 1) {
      throw new Error('Invalid event.')
    }

    const name = data.name.trim()
    const category = data.category.trim()
    const description = data.description?.trim() || ''

    if (name.length < 2) throw new Error('Event name is too short.')
    if (!category) throw new Error('Choose a category.')
    if (!Number.isInteger(data.points) || data.points < 0) {
      throw new Error('Points must be a whole number.')
    }

    return { ...data, name, category, description }
  })
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(events)
      .set({
        name: data.name,
        category: data.category,
        points: data.points,
        description: data.description,
      })
      .where(eq(events.id, data.eventId))
      .returning({ id: events.id })

    if (!updated) throw new Error('Event not found.')
    return { success: true }
  })

  export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      name: string
      eventDate: string
      category: string
      points: number
      description?: string
    }) => {
      const name = data.name.trim()
      const eventDate = data.eventDate.trim()
      const category = data.category.trim()
      const description = data.description?.trim() || ''

      if (name.length < 2) throw new Error('Event name is too short.')
      if (!eventDate) throw new Error('Choose a date.')
      if (!category) throw new Error('Choose a category.')
      if (!Number.isInteger(data.points) || data.points < 0) {
        throw new Error('Points must be a whole number.')
      }

      return { ...data, name, eventDate, category, description }
    },
  )
  .handler(async ({ data }) => {
    const slug = data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const [created] = await db
      .insert(events)
      .values({
        slug,
        name: data.name,
        eventDate: data.eventDate,
        category: data.category,
        points: data.points,
        description: data.description,
        active: true,
      })
      .returning({ id: events.id })

    if (!created) throw new Error('Unable to create event.')
    return { success: true }
  })

  export const deleteMember = createServerFn({ method: 'POST' })
  .inputValidator((data: { memberId: number }) => {
    if (!Number.isInteger(data.memberId) || data.memberId < 1) {
      throw new Error('Invalid member.')
    }
    return data
  })
  .handler(async ({ data }) => {
    await db.delete(attendance).where(eq(attendance.memberId, data.memberId))
    await db.delete(bonusPoints).where(eq(bonusPoints.memberId, data.memberId))

    const [deleted] = await db
      .delete(members)
      .where(eq(members.id, data.memberId))
      .returning({ id: members.id })

    if (!deleted) throw new Error('Member not found.')
    return { success: true }
  })