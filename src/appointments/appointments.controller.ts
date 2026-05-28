// src/appointments/appointments.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { RolesGuard, Roles } from "../common/guards/roles.guard";
import {
  CurrentUser,
  GatewayUser,
} from "../common/decorators/gateway-user.decorator";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // GET /appointments/health
  @Get("health")
  health() {
    return { status: "ok", service: "clinic-appointment-service" };
  }

  // GET /appointments — solo ADMIN
  @UseGuards(RolesGuard)
  @Roles("admin")
  @Get()
  findAll() {
    return this.appointmentsService.findAll();
  }

  // GET /appointments/my — el paciente ve sus citas
  @Get("my")
  findMy(@CurrentUser() user: GatewayUser) {
    return this.appointmentsService.findMyAppointments(user.id);
  }

  // GET /appointments/doctor/:doctorId — agenda del médico
  @Get("doctor/:doctorId")
  findDoctorAppointments(
    @Param("doctorId", ParseUUIDPipe) doctorId: string,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.appointmentsService.findDoctorAppointments(
      doctorId,
      user.id,
      user.role,
    );
  }

  // GET /appointments/:id — ver una cita
  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.appointmentsService.findOne(id, user.id, user.role);
  }

  // POST /appointments — el paciente crea una cita
  // Verifica paciente en patient-service y médico en doctor-service
  // Previene double-booking del médico
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: GatewayUser) {
    return this.appointmentsService.create(dto, user.id, user.role);
  }

  // PATCH /appointments/:id — editar notas o motivo (solo PENDING)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.appointmentsService.update(id, dto, user.id, user.role);
  }

  // PATCH /appointments/:id/status — cambiar estado
  // Confirmar: doctor/admin | Cancelar: cualquiera | Completar: doctor/admin
  @Patch(":id/status")
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.appointmentsService.updateStatus(id, dto, user.id, user.role);
  }
}
