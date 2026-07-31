import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  membershipType: text('membership_type').notNull().default('basic'),
  membershipPaid: boolean('membership_paid').notNull().default(false),
  zeffyCompleted: boolean('zeffy_completed').notNull().default(false),
  socialHandle: text('social_handle'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  eventDate: date('event_date', { mode: 'string' }).notNull(),
  category: text('category').notNull(),
  points: integer('points').notNull(),
  description: text('description').notNull(),
  active: boolean('active').notNull().default(true),
})

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    pointsAwarded: integer('points_awarded').notNull(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('attendance_member_event_unique').on(
      table.memberId,
      table.eventId,
    ),
  ],
)

export const bonusPoints = pgTable('bonus_points', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  detail: text('detail').notNull(),
  pointsAwarded: integer('points_awarded').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
