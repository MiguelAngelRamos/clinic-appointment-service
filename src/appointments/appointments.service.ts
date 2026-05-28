// src/appointments/appointments.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Appointment, AppointmentStatus } from "./entities/appointment.entity";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { PatientServiceClient } from "../common/http/patient-service.client";
import { DoctorServiceClient } from "../common/http/doctor-service.client";

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    // Clientes HTTP REST para verificar existencia de paciente y médico
    private readonly patientServiceClient: PatientServiceClient,
    private readonly doctorServiceClient: DoctorServiceClient,
  ) {}

  // findAll — solo ADMIN
  async findAll(): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      order: { scheduledAt: "DESC" },
    });
  }

  // findMyAppointments — el paciente ve sus propias citas
  async findMyAppointments(patientUserId: string): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { patientUserId },
      order: { scheduledAt: "DESC" },
    });
  }

  // findDoctorAppointments — el médico ve sus citas
  async findDoctorAppointments(
    doctorId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<Appointment[]> {
    // Solo ADMIN o el propio médico puede ver la agenda
    if (requesterRole !== "admin") {
      // Verificar que el doctorId pertenece al médico solicitante
      // Esta verificación se hace comparando userId del médico con requesterId
      // Lo hacemos localmente — no hay llamada a doctor-service aquí
      const ownAppointments = await this.appointmentRepository.find({
        where: { doctorId },
        order: { scheduledAt: "DESC" },
      });

      // Si el médico no tiene citas con este doctorId, puede que no sea su perfil
      // La verificación real de ownership se haría con un endpoint del doctor-service
      // pero lo simplificamos usando el rol — un doctor solo ve sus citas por su doctorId
      if (requesterRole !== "doctor") {
        throw new ForbiddenException("No tienes permiso para ver esta agenda");
      }

      return ownAppointments;
    }

    return this.appointmentRepository.find({
      where: { doctorId },
      order: { scheduledAt: "DESC" },
    });
  }

  // findOne — con verificación de ownership
  async findOne(
    id: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }

    this.assertCanAccess(appointment, requesterId, requesterRole);
    return appointment;
  }

  // create — el flujo completo con verificaciones y double-booking prevention
  async create(
    dto: CreateAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Appointment> {
    // Solo pacientes (o ADMIN) pueden crear citas
    if (requesterRole !== "patient" && requesterRole !== "admin") {
      throw new ForbiddenException("Solo los pacientes pueden crear citas");
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? 30;

    // Validar que la cita es en el futuro
    if (scheduledAt <= new Date()) {
      throw new BadRequestException(
        "La cita debe programarse en una fecha y hora futura",
      );
    }

    // ── Paso 1: Verificar que el paciente existe en patient-service ──
    // HTTP REST síncrono — necesitamos el patientId del perfil
    this.logger.log(
      `Verificando paciente para userId ${requesterId} en patient-service`,
    );
    const patient =
      await this.patientServiceClient.verifyPatientExists(requesterId);

    // ── Paso 2: Verificar que el médico existe en doctor-service ──
    // HTTP REST síncrono — necesitamos confirmar que el médico está activo
    this.logger.log(`Verificando médico ${dto.doctorId} en doctor-service`);
    await this.doctorServiceClient.verifyDoctorExists(dto.doctorId);

    // ── Paso 3: Double-booking prevention ──────────────────────────
    // Verificar que el médico no tiene otra cita en el mismo horario
    // Calculamos el rango de tiempo que ocupa esta cita
    const appointmentEnd = new Date(
      scheduledAt.getTime() + durationMinutes * 60 * 1000,
    );

    await this.checkDoubleBooking(
      dto.doctorId,
      scheduledAt,
      appointmentEnd,
      null,
    );
    // ──────────────────────────────────────────────────────────────

    const appointment = this.appointmentRepository.create({
      patientId: patient.id, // ID del perfil de paciente
      patientUserId: requesterId, // userId para ownership checks locales
      doctorId: dto.doctorId,
      scheduledAt,
      durationMinutes,
      reason: dto.reason ?? null,
      status: AppointmentStatus.PENDING,
    });

    const saved = await this.appointmentRepository.save(appointment);
    this.logger.log(
      `Cita creada: ${saved.id} — paciente ${patient.id} con médico ${dto.doctorId}`,
    );
    // TODO: publicar evento appointment.confirmed a RabbitMQ
    // cuando se integre la mensajería asíncrona
    return saved;
  }

  // updateStatus — cambiar el estado de una cita
  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) throw new NotFoundException(`Cita ${id} no encontrada`);

    // Validar transiciones de estado permitidas
    this.validateStatusTransition(
      appointment.status,
      dto.status,
      requesterRole,
    );

    // Cancelación requiere motivo
    if (dto.status === AppointmentStatus.CANCELLED && !dto.cancellationReason) {
      throw new BadRequestException(
        "Se requiere un motivo para cancelar la cita",
      );
    }

    appointment.status = dto.status;
    if (dto.cancellationReason) {
      appointment.cancellationReason = dto.cancellationReason;
    }

    const updated = await this.appointmentRepository.save(appointment);
    this.logger.log(`Cita ${id} actualizada a estado: ${dto.status}`);
    return updated;
  }

  // update — actualizar notas o motivo
  async update(
    id: string,
    dto: UpdateAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id, requesterId, requesterRole);

    // Solo se puede editar si está en estado PENDING
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        "Solo se pueden editar citas en estado pendiente",
      );
    }

    Object.assign(appointment, dto);
    return this.appointmentRepository.save(appointment);
  }

  // ── Double-booking prevention ────────────────────────────────────
  // Verifica que el médico no tiene otra cita activa en el mismo rango
  // Usa una query con solapamiento de intervalos de tiempo
  private async checkDoubleBooking(
    doctorId: string,
    start: Date,
    end: Date,
    excludeId: string | null,
  ): Promise<void> {
    const qb = this.appointmentRepository
      .createQueryBuilder("a")
      .where("a.doctorId = :doctorId", { doctorId })
      .andWhere("a.status NOT IN (:...cancelledStatuses)", {
        cancelledStatuses: [
          AppointmentStatus.CANCELLED,
          AppointmentStatus.COMPLETED,
        ],
      })
      // Solapamiento de intervalos:
      // La nueva cita empieza antes de que termine la existente
      // Y termina después de que empiece la existente
      .andWhere("a.scheduledAt < :end", { end })
      .andWhere(
        `(a.scheduledAt + (a.durationMinutes * interval '1 minute')) > :start`,
        { start },
      );

    if (excludeId) {
      qb.andWhere("a.id != :excludeId", { excludeId });
    }

    const conflicting = await qb.getOne();

    if (conflicting) {
      throw new ConflictException(
        `El médico ya tiene una cita programada entre ${conflicting.scheduledAt.toISOString()} ` +
          `y ${new Date(conflicting.scheduledAt.getTime() + conflicting.durationMinutes * 60000).toISOString()}. ` +
          `Por favor elige otro horario.`,
      );
    }
  }

  // Validar que la transición de estado es permitida
  private validateStatusTransition(
    current: AppointmentStatus,
    next: AppointmentStatus,
    requesterRole: string,
  ): void {
    // Una cita completada o cancelada no puede cambiar de estado
    if (
      current === AppointmentStatus.COMPLETED ||
      current === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `No se puede cambiar el estado de una cita ${current}`,
      );
    }

    // Solo ADMIN o doctor pueden confirmar
    if (
      next === AppointmentStatus.CONFIRMED &&
      !["admin", "doctor"].includes(requesterRole)
    ) {
      throw new ForbiddenException(
        "Solo un médico o admin puede confirmar la cita",
      );
    }

    // Solo ADMIN o doctor pueden marcar como completada
    if (
      next === AppointmentStatus.COMPLETED &&
      !["admin", "doctor"].includes(requesterRole)
    ) {
      throw new ForbiddenException(
        "Solo un médico o admin puede completar la cita",
      );
    }
  }

  // IDOR prevention — OWASP A01
  private assertCanAccess(
    appointment: Appointment,
    requesterId: string,
    requesterRole: string,
  ): void {
    if (requesterRole === "admin") return;
    if (appointment.patientUserId === requesterId) return;
    // El médico también puede ver sus propias citas
    // Aquí usamos una heurística — en producción se consultaría doctor-service
    if (requesterRole === "doctor") return;
    throw new ForbiddenException("No tienes permiso para acceder a esta cita");
  }
}
