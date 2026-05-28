// src/common/decorators/gateway-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export interface GatewayUser {
  id: string;
  role: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GatewayUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return {
      id: request.headers["x-user-id"] as string,
      role: request.headers["x-user-role"] as string,
      email: request.headers["x-user-email"] as string,
    };
  },
);
