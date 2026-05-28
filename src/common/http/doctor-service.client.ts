// src/common/http/doctor-service.client.ts
//
// Cliente HTTP REST para verificar existencia de médico.
// appointment-service necesita confirmar que el médico existe
// y está activo ANTES de crear la cita.
//
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface DoctorResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  isActive: boolean;
}

@Injectable()
export class DoctorServiceClient {
  private readonly logger = new Logger(DoctorServiceClient.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>(
      'app.doctorServiceUrl',
    );
  }

  // verifyDoctorExists — llama a GET /doctors/:doctorId
  // Verifica que el médico existe y está activo
  async verifyDoctorExists(doctorId: string): Promise<DoctorResponse> {
    try {
      const response = await axios.get<DoctorResponse>(
        `${this.baseUrl}/doctors/${doctorId}`,
        {
          timeout: 5000,
          headers: {
            'x-user-id': 'appointment-service',
            'x-user-role': 'admin',
          },
        },
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 404) {
        throw new NotFoundException(
          `El médico ${doctorId} no existe o no está activo`,
        );
      }

      this.logger.error(
        `Error al contactar doctor-service [GET /doctors/${doctorId}]: ` +
          `${axiosError.message}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de médicos no está disponible. Intenta de nuevo.',
      );
    }
  }
}
