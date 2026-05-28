// src/common/http/patient-service.client.ts
//
// Cliente HTTP REST para verificar existencia de paciente.
// appointment-service necesita confirmar que el paciente existe
// ANTES de crear la cita — operación síncrona obligatoria.
//
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface PatientResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

@Injectable()
export class PatientServiceClient {
  private readonly logger = new Logger(PatientServiceClient.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>(
      'app.patientServiceUrl',
    );
  }

  // verifyPatientExists — llama a GET /patients/user/:userId
  // Verifica que el paciente tiene perfil activo antes de crear la cita
  async verifyPatientExists(userId: string): Promise<PatientResponse> {
    try {
      const response = await axios.get<PatientResponse>(
        `${this.baseUrl}/patients/user/${userId}`,
        {
          timeout: 5000,
          // Pasar el userId como header X-User-Id para que patient-service
          // pueda verificar el ownership del perfil
          headers: {
            'x-user-id': userId,
            'x-user-role': 'patient',
          },
        },
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 404) {
        throw new NotFoundException(
          `No existe perfil de paciente para el usuario ${userId}`,
        );
      }

      this.logger.error(
        `Error al contactar patient-service [GET /patients/user/${userId}]: ` +
          `${axiosError.message}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de pacientes no está disponible. Intenta de nuevo.',
      );
    }
  }
}
