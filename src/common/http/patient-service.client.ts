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
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpClient, HttpResponse } from "./http-client";

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

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>(
      "app.patientServiceUrl",
    );
  }

  // verifyPatientExists — llama a GET /patients/user/:userId
  // Verifica que el paciente tiene perfil activo antes de crear la cita
  async verifyPatientExists(userId: string): Promise<PatientResponse> {
    let response: HttpResponse<PatientResponse>;
    try {
      response = await this.httpClient.get<PatientResponse>(
        `${this.baseUrl}/patients/user/${userId}`,
        {
          timeoutMs: 5000,
          // Pasar el userId como header X-User-Id para que patient-service
          // pueda verificar el ownership del perfil
          headers: {
            "x-user-id": userId,
            "x-user-role": "patient",
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error al contactar patient-service [GET /patients/user/${userId}]: ` +
          `${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        "El servicio de pacientes no está disponible. Intenta de nuevo.",
      );
    }
    if (response.status === 404) {
      throw new NotFoundException(
        `No existe perfil de paciente para el usuario ${userId}`,
      );
    }
    if (!response.ok) {
      this.logger.error(
        `Error al contactar patient-service [GET /patients/user/${userId}]: ` +
          `HTTP ${response.status}`,
      );
      throw new ServiceUnavailableException(
        "El servicio de pacientes no está disponible. Intenta de nuevo.",
      );
    }
    return response.data;
  }
}
