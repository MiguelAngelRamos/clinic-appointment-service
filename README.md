# clinic-appointment-service

Microservicio de citas médicas de la **Clinic App**.

Responsabilidad única: gestionar citas, estados y prevención de double-booking.

## Comunicaciones HTTP REST

Este servicio es el que más dependencias tiene — necesita verificar dos servicios antes de crear una cita:

```
POST /appointments
       │
       ├── 1. GET http://patient-service:3003/patients/user/{userId}
       │         → verifica que el paciente existe
       │
       ├── 2. GET http://doctor-service:3004/doctors/{doctorId}
       │         → verifica que el médico existe y está activo
       │
       ├── 3. Double-booking check en appointment_db
       │         → verifica que el médico no tiene otra cita en ese horario
       │
       └── 4. Crear la cita en appointment_db
```

## Double-booking prevention

La query detecta solapamiento de intervalos de tiempo:

```sql
WHERE doctor_id = :doctorId
  AND scheduled_at < :end          -- la cita existente empieza antes de que termine la nueva
  AND (scheduled_at + duration_minutes * interval '1 minute') > :start  -- y termina después de que empiece
  AND status NOT IN ('cancelled', 'completed')
```

## Estados de una cita

```
pending → confirmed → completed
       ↘             ↗
        → cancelled →
```

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/appointments/health` | Público | Health check K8s |
| `GET` | `/appointments` | ADMIN | Todas las citas |
| `GET` | `/appointments/my` | Paciente | Mis citas |
| `GET` | `/appointments/doctor/:id` | Doctor/ADMIN | Agenda del médico |
| `GET` | `/appointments/:id` | Ownership | Ver una cita |
| `POST` | `/appointments` | Paciente | Crear cita |
| `PATCH` | `/appointments/:id` | Ownership | Editar notas |
| `PATCH` | `/appointments/:id/status` | Según rol | Cambiar estado |

## Kubernetes

```bash
kubectl create secret generic appt-postgres-secret \
  --namespace clinic \
  --from-literal=POSTGRES_USER=appt_svc_user \
  --from-literal=POSTGRES_PASSWORD=<PASSWORD> \
  --from-literal=POSTGRES_DB=appointment_db

kubectl apply -f k8s/appointment-service.yaml
kubectl get pods -n clinic -l app=appointment-service
```
