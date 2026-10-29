ALTER TABLE "settlement" ADD COLUMN "expense_id" text;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "settlement_expense_idx" ON "settlement" USING btree ("expense_id");