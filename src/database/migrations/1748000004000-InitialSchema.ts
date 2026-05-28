// src/database/migrations/1748000004000-InitialSchema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1748000004000 implements MigrationInterface {
  name = 'InitialSchema1748000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "public"."appointments_status_enum"
        AS ENUM('pending', 'confirmed', 'cancelled', 'completed')
    `);

    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id"                  UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "patient_id"          UUID        NOT NULL,
        "doctor_id"           UUID        NOT NULL,
        "patient_user_id"     UUID        NOT NULL,
        "scheduled_at"        TIMESTAMPTZ NOT NULL,
        "duration_minutes"    INT         NOT NULL DEFAULT 30,
        "status"              "public"."appointments_status_enum" NOT NULL DEFAULT 'pending',
        "reason"              TEXT,
        "notes"               TEXT,
        "cancellation_reason" TEXT,
        "created_at"          TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appointments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_appt_patient_id"      ON "appointments" ("patient_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_appt_doctor_id"       ON "appointments" ("doctor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_appt_patient_user_id" ON "appointments" ("patient_user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_appt_scheduled_at"    ON "appointments" ("scheduled_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_appt_status"          ON "appointments" ("status")`);

    // Índice compuesto para la query de double-booking
    // Optimiza: WHERE doctor_id = X AND scheduled_at < Y AND status NOT IN (...)
    await queryRunner.query(`
      CREATE INDEX "IDX_appt_doctor_scheduled"
        ON "appointments" ("doctor_id", "scheduled_at")
        WHERE status NOT IN ('cancelled', 'completed')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_appt_doctor_scheduled"`);
    await queryRunner.query(`DROP INDEX "IDX_appt_status"`);
    await queryRunner.query(`DROP INDEX "IDX_appt_scheduled_at"`);
    await queryRunner.query(`DROP INDEX "IDX_appt_patient_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_appt_doctor_id"`);
    await queryRunner.query(`DROP INDEX "IDX_appt_patient_id"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
  }
}
