CREATE TABLE "group_settings" (
	"group_id" varchar(100) PRIMARY KEY NOT NULL,
	"auto_enabled" boolean DEFAULT false NOT NULL,
	"sensitivity" varchar(10) DEFAULT 'casual' NOT NULL,
	"auto_format" varchar(10) DEFAULT 'both' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
