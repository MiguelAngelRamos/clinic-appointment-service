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
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpClient, HttpResponse } from "./http-client";

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

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>(
      "app.doctorServiceUrl",
    );
  }

  // verifyDoctorExists — llama a GET /doctors/:doctorId
  // Verifica que el médico existe y está activo
  async verifyDoctorExists(doctorId: string): Promise<DoctorResponse> {
    let response: HttpResponse<DoctorResponse>;
    try {
      response = await this.httpClient.get<DoctorResponse>(
        `${this.baseUrl}/doctors/${doctorId}`,
        {
          timeoutMs: 5000,
          headers: {
            "x-user-id": "appointment-service",
            "x-user-role": "admin",
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error al contactar doctor-service [GET /doctors/${doctorId}]: ` +
          `${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        "El servicio de médicos no está disponible. Intenta de nuevo.",
      );
    }
    if (response.status === 404) {
      throw new NotFoundException(
        `El médico ${doctorId} no existe o no está activo`,
      );
    }
    if (!response.ok) {
      this.logger.error(
        `Error al contactar doctor-service [GET /doctors/${doctorId}]: ` +
          `HTTP ${response.status}`,
      );
      throw new ServiceUnavailableException(
        "El servicio de médicos no está disponible. Intenta de nuevo.",
      );
    }
    return response.data;
  }
}
