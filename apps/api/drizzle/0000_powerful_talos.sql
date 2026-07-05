CREATE TYPE "public"."admin_page_permission" AS ENUM('groups', 'employees', 'quotas', 'products', 'intents', 'orders', 'reviews', 'operator_accounts');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."intent_status" AS ENUM('pending_follow_up', 'communicating', 'converted_to_order', 'withdrawn_by_employee', 'closed');--> statement-breakpoint
CREATE TYPE "public"."operator_account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."operator_role" AS ENUM('leader', 'staff');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_confirmation', 'confirmed', 'waiting_for_service', 'in_service', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('travel', 'insurance', 'medical', 'health_management', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_visibility_scope" AS ENUM('all_groups', 'specified_groups');--> statement-breakpoint
CREATE TYPE "public"."quota_transaction_type" AS ENUM('grant', 'deduction', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending_review', 'published', 'hidden');--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"group_id" text NOT NULL,
	"department" text,
	"employee_number" text,
	"position" text,
	"status" "employee_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"cooperation_start_date" date NOT NULL,
	"cooperation_end_date" date,
	"status" "group_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "operator_role" NOT NULL,
	"status" "operator_account_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_page_permissions" (
	"operator_account_id" text NOT NULL,
	"permission" "admin_page_permission" NOT NULL,
	CONSTRAINT "operator_page_permissions_pk" PRIMARY KEY("operator_account_id","permission")
);
--> statement-breakpoint
CREATE TABLE "personal_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"product_id" text NOT NULL,
	"expected_travel_date" date NOT NULL,
	"expected_stay_days" integer NOT NULL,
	"companion_count" integer,
	"preferred_transport" text,
	"needs_pickup" boolean,
	"accommodation_preference" text,
	"additional_notes" text,
	"convenient_contact_time" text,
	"status" "intent_status" NOT NULL,
	"assignee_account_id" text,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"source_intent_id" text,
	"source_product_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"group_id" text NOT NULL,
	"product_snapshot" jsonb NOT NULL,
	"departure_date" date,
	"return_date" date,
	"transport" text,
	"accommodation" text,
	"pickup_service" text,
	"service_plan" text NOT NULL,
	"planned_quota_deduction" integer DEFAULT 0 NOT NULL,
	"deducted_quota" integer DEFAULT 0 NOT NULL,
	"refunded_quota" integer DEFAULT 0 NOT NULL,
	"final_consumed_quota" integer DEFAULT 0 NOT NULL,
	"status" "order_status" NOT NULL,
	"assignee_account_id" text,
	"internal_note" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_orders_refund_not_above_deduction" CHECK ("personal_orders"."refunded_quota" <= "personal_orders"."deducted_quota"),
	CONSTRAINT "personal_orders_final_consumed_formula" CHECK ("personal_orders"."final_consumed_quota" = "personal_orders"."deducted_quota" - "personal_orders"."refunded_quota")
);
--> statement-breakpoint
CREATE TABLE "product_visible_groups" (
	"product_id" text NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "product_visible_groups_pk" PRIMARY KEY("product_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "quota_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"total_granted" integer DEFAULT 0 NOT NULL,
	"total_deducted" integer DEFAULT 0 NOT NULL,
	"total_refunded" integer DEFAULT 0 NOT NULL,
	"total_adjusted" integer DEFAULT 0 NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_accounts_available_nonnegative" CHECK ("quota_accounts"."available_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quota_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"type" "quota_transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"related_order_id" text,
	"reason" text NOT NULL,
	"internal_note" text,
	"operator" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "product_type" NOT NULL,
	"summary" text NOT NULL,
	"cover_image" text NOT NULL,
	"gallery" jsonb,
	"quota_reference" jsonb,
	"service_description" text NOT NULL,
	"notes" text NOT NULL,
	"visibility_scope" "product_visibility_scope" NOT NULL,
	"status" "product_status" NOT NULL,
	"sort_order" integer,
	"recommended" boolean,
	"travel_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"product_id" text NOT NULL,
	"rating" integer NOT NULL,
	"content" text NOT NULL,
	"status" "review_status" NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_by_account_id" text,
	"moderated_at" timestamp with time zone,
	CONSTRAINT "service_reviews_rating_range" CHECK ("service_reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"operator_account_id" text,
	"employee_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_exactly_one_subject" CHECK (num_nonnulls("sessions"."operator_account_id", "sessions"."employee_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_page_permissions" ADD CONSTRAINT "operator_page_permissions_operator_account_id_operator_accounts_id_fk" FOREIGN KEY ("operator_account_id") REFERENCES "public"."operator_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD CONSTRAINT "personal_intents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD CONSTRAINT "personal_intents_product_id_service_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."service_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD CONSTRAINT "personal_intents_assignee_account_id_operator_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "public"."operator_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD CONSTRAINT "personal_orders_source_intent_id_personal_intents_id_fk" FOREIGN KEY ("source_intent_id") REFERENCES "public"."personal_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD CONSTRAINT "personal_orders_source_product_id_service_products_id_fk" FOREIGN KEY ("source_product_id") REFERENCES "public"."service_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD CONSTRAINT "personal_orders_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD CONSTRAINT "personal_orders_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD CONSTRAINT "personal_orders_assignee_account_id_operator_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "public"."operator_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_visible_groups" ADD CONSTRAINT "product_visible_groups_product_id_service_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."service_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_visible_groups" ADD CONSTRAINT "product_visible_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_accounts" ADD CONSTRAINT "quota_accounts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_transactions" ADD CONSTRAINT "quota_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_transactions" ADD CONSTRAINT "quota_transactions_related_order_id_personal_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."personal_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_order_id_personal_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."personal_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_product_id_service_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."service_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_moderated_by_account_id_operator_accounts_id_fk" FOREIGN KEY ("moderated_by_account_id") REFERENCES "public"."operator_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_operator_account_id_operator_accounts_id_fk" FOREIGN KEY ("operator_account_id") REFERENCES "public"."operator_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_phone_unique" ON "employees" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "employees_group_id_index" ON "employees" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_name_unique" ON "groups" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "operator_accounts_username_unique" ON "operator_accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "personal_intents_employee_index" ON "personal_intents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "personal_intents_product_index" ON "personal_intents" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_orders_order_number_unique" ON "personal_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "personal_orders_employee_index" ON "personal_orders" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "personal_orders_group_index" ON "personal_orders" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_orders_source_intent_unique" ON "personal_orders" USING btree ("source_intent_id") WHERE "personal_orders"."source_intent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "quota_accounts_employee_unique" ON "quota_accounts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "quota_transactions_employee_index" ON "quota_transactions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "quota_transactions_order_index" ON "quota_transactions" USING btree ("related_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_products_name_unique" ON "service_products" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "service_reviews_order_unique" ON "service_reviews" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_operator_account_index" ON "sessions" USING btree ("operator_account_id");--> statement-breakpoint
CREATE INDEX "sessions_employee_index" ON "sessions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_index" ON "sessions" USING btree ("expires_at");