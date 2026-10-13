CREATE TABLE "atendeia_users_recuperacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"versao_usuario" integer NOT NULL,
	"expira_em" timestamp (3) with time zone NOT NULL,
	"usado_em" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atendeia_users_recuperacoes" ADD CONSTRAINT "atendeia_users_recuperacoes_user_id_atendeia_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."atendeia_users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "atendeia_users_recuperacoes" ADD CONSTRAINT "atendeia_users_recuperacoes_modified_by_atendeia_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."atendeia_users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "atendeia_recuperacao_hash" ON "atendeia_users_recuperacoes" USING btree ("token_hash");