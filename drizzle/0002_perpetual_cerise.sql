CREATE INDEX "immersion_sessions_started_at_idx" ON "immersion_sessions" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "library_entries_media_item_idx" ON "library_entries" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "session_kudos_user_idx" ON "session_kudos" USING btree ("user_id");