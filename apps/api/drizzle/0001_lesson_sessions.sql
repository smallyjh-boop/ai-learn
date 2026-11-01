CREATE TABLE IF NOT EXISTS "lesson_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"locale" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"step_seconds" integer[] NOT NULL,
	"first" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_sessions_lesson_idx" ON "lesson_sessions" USING btree ("lesson_id","created_at");