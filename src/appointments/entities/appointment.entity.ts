// src/appointments/entities/appointment.entity.ts
//
// Cita médica — datos propios del appointment-service.
// patientId y doctorId son referencias lógicas a otros servicios.
// Sin FK reales entre BDs — integridad por protocolo.
//
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum AppointmentStatus {
  PENDING = "pending", // creada, esperando confirmación
  CONFIRMED = "confirmed", // confirmada por el médico/admin
  CANCELLED = "cancelled", // cancelada por cualquier parte
  COMPLETED = "completed", // consulta realizada
}

@Entity("appointments")
export class Appointment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Referencia al perfil del paciente en patient-service
  @Index()
  @Column({ name: "patient_id", type: "uuid" })
  patientId!: string;

  // Referencia al perfil del médico en doctor-service
  @Index()
  @Column({ name: "doctor_id", type: "uuid" })
  doctorId!: string;

  // userId del paciente — para ownership checks sin llamar a patient-service
  @Index()
  @Column({ name: "patient_user_id", type: "uuid" })
  patientUserId!: string;

  // Fecha y hora de la cita
  @Column({ name: "scheduled_at", type: "timestamptz" })
  scheduledAt!: Date;

  // Duración en minutos — para calcular solapamientos en double-booking
  @Column({ name: "duration_minutes", type: "int", default: 30 })
  durationMinutes!: number;

  @Column({
    type: "enum",
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status!: AppointmentStatus;

  @Column({ type: "text", nullable: true })
  reason!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  // Motivo de cancelación — requerido cuando status = CANCELLED
  @Column({ name: "cancellation_reason", type: "text", nullable: true })
  cancellationReason!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
