// src/common/http/http-client.ts
//
// Cliente HTTP basado en fetch nativo de Node 22.
// Reemplaza axios para eliminar la dependencia de terceros.
// Encapsula timeout (AbortController) y manejo de errores.
//
import { Injectable, Logger } from "@nestjs/common";

export interface HttpRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface HttpResponse<T> {
  status: number;
  ok: boolean;
  data: T;
}

@Injectable()
export class HttpClient {
  private readonly logger = new Logger(HttpClient.name);

  async get<T>(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const timeoutMs = options.timeoutMs ?? 5000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...options.headers },
        signal: controller.signal,
      });

      // fetch no parsea automáticamente — lo hacemos aquí
      const data = (await response.json().catch(() => null)) as T;

      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
