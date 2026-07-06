CREATE INDEX "employees_group_status_created_index" ON "employees" USING btree ("group_id","status","created_at");--> statement-breakpoint
CREATE INDEX "groups_status_created_index" ON "groups" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "personal_intents_status_created_index" ON "personal_intents" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "personal_orders_status_created_index" ON "personal_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quota_transactions_occurred_index" ON "quota_transactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "service_products_status_created_index" ON "service_products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "service_reviews_status_submitted_index" ON "service_reviews" USING btree ("status","submitted_at");