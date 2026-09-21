ALTER TYPE "product_type" ADD VALUE 'hotel';--> statement-breakpoint
ALTER TYPE "admin_page_permission" ADD VALUE 'hotels';--> statement-breakpoint
ALTER TABLE "service_products" ADD COLUMN "hotel_details" jsonb;--> statement-breakpoint
CREATE TABLE "product_linked_hotels" (
  "product_id" text NOT NULL,
  "hotel_product_id" text NOT NULL,
  CONSTRAINT "product_linked_hotels_pk" PRIMARY KEY("product_id","hotel_product_id")
);--> statement-breakpoint
CREATE TABLE "hotel_room_types" (
  "id" text PRIMARY KEY NOT NULL,
  "hotel_product_id" text NOT NULL,
  "name" text NOT NULL,
  "bed_type" text,
  "capacity" integer NOT NULL,
  "breakfast" text,
  "area" text,
  "description" text,
  "status" "product_status" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "hotel_room_daily_inventories" (
  "id" text PRIMARY KEY NOT NULL,
  "room_type_id" text NOT NULL,
  "date" date NOT NULL,
  "quota_price" integer NOT NULL,
  "total_inventory" integer NOT NULL,
  "used_inventory" integer DEFAULT 0 NOT NULL,
  "is_available" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "hotel_room_inventory_nonnegative" CHECK ("hotel_room_daily_inventories"."total_inventory" >= 0),
  CONSTRAINT "hotel_room_used_nonnegative" CHECK ("hotel_room_daily_inventories"."used_inventory" >= 0),
  CONSTRAINT "hotel_room_used_not_above_total" CHECK ("hotel_room_daily_inventories"."used_inventory" <= "hotel_room_daily_inventories"."total_inventory")
);--> statement-breakpoint
ALTER TABLE "product_linked_hotels" ADD CONSTRAINT "product_linked_hotels_product_id_service_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."service_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_linked_hotels" ADD CONSTRAINT "product_linked_hotels_hotel_product_id_service_products_id_fk" FOREIGN KEY ("hotel_product_id") REFERENCES "public"."service_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_room_types" ADD CONSTRAINT "hotel_room_types_hotel_product_id_service_products_id_fk" FOREIGN KEY ("hotel_product_id") REFERENCES "public"."service_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_room_daily_inventories" ADD CONSTRAINT "hotel_room_daily_inventories_room_type_id_hotel_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."hotel_room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hotel_room_types_hotel_index" ON "hotel_room_types" USING btree ("hotel_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_room_daily_inventory_unique" ON "hotel_room_daily_inventories" USING btree ("room_type_id","date");--> statement-breakpoint
ALTER TABLE "personal_intents" ADD COLUMN "preferred_hotel_product_id" text;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD COLUMN "preferred_hotel_room_type_id" text;--> statement-breakpoint
ALTER TABLE "personal_orders" ADD COLUMN "hotel_accommodation" jsonb;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD CONSTRAINT "personal_intents_preferred_hotel_product_id_service_products_id_fk" FOREIGN KEY ("preferred_hotel_product_id") REFERENCES "public"."service_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_intents" ADD CONSTRAINT "personal_intents_preferred_hotel_room_type_id_hotel_room_types_id_fk" FOREIGN KEY ("preferred_hotel_room_type_id") REFERENCES "public"."hotel_room_types"("id") ON DELETE set null ON UPDATE no action;
