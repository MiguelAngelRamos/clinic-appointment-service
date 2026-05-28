// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3005', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // URLs de los servicios dependientes
  // En K8s: http://patient-service:3003 y http://doctor-service:3004
  patientServiceUrl: process.env.PATIENT_SERVICE_URL ?? 'http://localhost:3003',
  doctorServiceUrl: process.env.DOCTOR_SERVICE_URL ?? 'http://localhost:3004',
}));
