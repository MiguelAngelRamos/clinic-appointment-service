// src/appointments/dto/create-appointment.dto.ts
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  // ID del perfil del médico en doctor-service
  @IsUUID('4')
  doctorId!: string;

  // Fecha y hora de la cita — ISO 8601 con timezone
  @IsDateString()
  scheduledAt!: string;

  // Duración entre 15 y 120 minutos
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(120)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
