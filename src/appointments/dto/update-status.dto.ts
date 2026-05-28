// src/appointments/dto/update-status.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;

  // Obligatorio cuando status = CANCELLED
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
