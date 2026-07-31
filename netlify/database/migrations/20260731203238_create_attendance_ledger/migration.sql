CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY,
	"member_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"points_awarded" integer NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonus_points" (
	"id" serial PRIMARY KEY,
	"member_id" integer NOT NULL,
	"type" text NOT NULL,
	"detail" text NOT NULL,
	"points_awarded" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"event_date" date NOT NULL,
	"category" text NOT NULL,
	"points" integer NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"membership_type" text DEFAULT 'basic' NOT NULL,
	"membership_paid" boolean DEFAULT false NOT NULL,
	"zeffy_completed" boolean DEFAULT false NOT NULL,
	"social_handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_member_event_unique" ON "attendance" ("member_id","event_id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bonus_points" ADD CONSTRAINT "bonus_points_member_id_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "events" ("slug", "name", "event_date", "category", "points", "description") VALUES
('aaas-101', 'AAAS 101', '2026-09-01', 'soul', 15, 'A welcoming space to connect, grow, and learn how to make the most of AAAS.'),
('fashion-show-interest', 'Fashion Show Interest', '2026-09-08', 'culture', 10, 'Meet the team, learn how to participate, and help shape a premier AAAS tradition.'),
('pageant-interest', 'BUSC Pageant Interest', '2026-10-06', 'culture', 10, 'Explore pageant roles and participation opportunities. Members receive event points at check-in.'),
('manhunt', 'Manhunt', '2026-10-20', 'legacy', 5, 'A large community tradition that brings members together for a high-energy evening.'),
('presentation-night', 'Presentation Night', '2026-11-17', 'soul', 15, 'A member-centered evening for sharing ideas, confidence, and creativity.'),
('internship-101', 'Internship 101: Secure Your Future', '2026-11-30', 'soul', 15, 'Career preparation, resources, and practical support for the next opportunity.'),
('sunset-yoga', 'Sunset Yoga', '2026-12-02', 'soul', 15, 'A restorative space for movement, community, and end-of-semester wellness.'),
('make-your-mark', 'Make Your Mark', '2026-12-03', 'soul', 15, 'A reflective close to the semester focused on impact, purpose, and growth.');
