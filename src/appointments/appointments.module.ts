// src/appointments/appointments.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { PatientServiceClient } from "../common/http/patient-service.client";
import { DoctorServiceClient } from "../common/http/doctor-service.client";
import { HttpClient } from "../common/http/http-client";

@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    HttpClient,
    PatientServiceClient, // llama a patient-service
    DoctorServiceClient, // llama a doctor-service
  ],
})
export class AppointmentsModule {}
