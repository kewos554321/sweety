CREATE TABLE "companions" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_user_id" varchar(100) NOT NULL,
	"name" varchar(20) NOT NULL,
	"personality" text NOT NULL,
	"avatar" varchar(8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companions_line_user_id_name_unique" UNIQUE("line_user_id","name")
);
