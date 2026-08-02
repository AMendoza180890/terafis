"use server";

import { revalidatePath } from "next/cache";

import { writeAuditError, writeAuditLog } from "@/lib/audit/write";
import { requireCurrentStaff } from "@/lib/auth/current-staff";
import {
  decryptClinicalFields,
  encryptClinicalFields,
} from "@/lib/crypto/clinical-fields";
import { RoleCapabilities } from "@/lib/roles";
import {
  CreateClinicalEpisodeSchema,
  CreatePatientSchema,
  SearchPatientsSchema,
  UpdateClinicalEpisodeSchema,
  UpdatePatientContactSchema,
} from "@/lib/patients/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export type ClinicalEpisodeSummary = {
  id: string;
  titulo: string;
  estado: "activo" | "cerrado" | string;
  fechaApertura: string;
  fechaCierre: string | null;
  createdAt: string;
};

export async function createPatientAction(raw: unknown): Promise<ActionResult> {
  const parsed = CreatePatientSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "patient.create",
      tabla: "patients",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  const supabase = await createClient();
  const input = parsed.data;
  const hasOptIn =
    input.optInEmail || input.optInSms || input.optInWhatsapp || input.optInPush;

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: staff.clinicId,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email ?? null,
      fecha_nacimiento: input.fechaNacimiento ?? null,
      contacto_emergencia_nombre: input.contactoEmergenciaNombre ?? null,
      contacto_emergencia_telefono: input.contactoEmergenciaTelefono ?? null,
      ocupacion: input.ocupacion ?? null,
      referido_doctor_id: input.referidoDoctorId ?? null,
      opt_in_email: input.optInEmail,
      opt_in_sms: input.optInSms,
      opt_in_whatsapp: input.optInWhatsapp,
      opt_in_push: input.optInPush,
      opt_in_origen: hasOptIn ? "registro_manual" : null,
      opt_in_en: hasOptIn ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !patient) {
    const msg = error?.message ?? "No se pudo crear el paciente";
    await writeAuditError({
      staff,
      accion: "patient.create",
      tabla: "patients",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  const patientId = (patient as { id: string }).id;

  if (input.clinical && RoleCapabilities[staff.rol].verExpedienteClinico) {
    try {
      const encrypted = encryptClinicalFields({
        historial_medico: input.clinical.historialMedico ?? null,
        alergias: input.clinical.alergias ?? null,
        medicamentos: input.clinical.medicamentos ?? null,
        diagnosticos_previos: input.clinical.diagnosticosPrevios ?? null,
        anamnesis: input.clinical.anamnesis ?? null,
        exploracion_fisica: input.clinical.exploracionFisica ?? null,
        diagnostico_fisioterapeutico: input.clinical.diagnosticoFisioterapeutico ?? null,
        objetivo_tratamiento: input.clinical.objetivoTratamiento ?? null,
      });

      const { error: clinicalError } = await supabase.from("patient_clinical").insert({
        clinic_id: staff.clinicId,
        patient_id: patientId,
        titulo: input.clinical.titulo?.trim() || "Expediente inicial",
        estado: "activo",
        ...encrypted,
      });

      if (clinicalError) {
        return {
          ok: false,
          error: `Paciente creado, pero el expediente falló: ${clinicalError.message}`,
        };
      }

      await writeAuditLog({
        staff,
        accion: "patient_clinical.create",
        tabla: "patient_clinical",
        registroId: patientId,
        diff: {
          fields: Object.keys(encrypted).filter(
            (k) => encrypted[k as keyof typeof encrypted],
          ),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de cifrado";
      return { ok: false, error: `Paciente creado, expediente no cifrado: ${msg}` };
    }
  }

  if (input.consent) {
    await supabase.from("patient_consents").insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      tipo: input.consent.tipo,
      version_documento: input.consent.versionDocumento,
      texto_hash: input.consent.textoHash,
    });
  }

  await writeAuditLog({
    staff,
    accion: "patient.create",
    tabla: "patients",
    registroId: patientId,
    resultado: "exito",
    mensaje: "Paciente creado",
    diff: { nombre: input.nombre },
  });

  revalidatePath("/app/pacientes");
  return { ok: true, id: patientId };
}

export async function updatePatientContactAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdatePatientContactSchema.safeParse(raw);
  const staff = await requireCurrentStaff();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    await writeAuditError({
      staff,
      accion: "patient.update_contact",
      tabla: "patients",
      mensaje: msg,
    });
    return { ok: false, error: msg };
  }

  if (staff.rol === "terapeuta") {
    return { ok: false, error: "El terapeuta no edita datos de contacto" };
  }

  const input = parsed.data;
  const hasOptIn =
    input.optInEmail || input.optInSms || input.optInWhatsapp || input.optInPush;

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email ?? null,
      fecha_nacimiento: input.fechaNacimiento ?? null,
      contacto_emergencia_nombre: input.contactoEmergenciaNombre ?? null,
      contacto_emergencia_telefono: input.contactoEmergenciaTelefono ?? null,
      ocupacion: input.ocupacion ?? null,
      referido_doctor_id: input.referidoDoctorId ?? null,
      opt_in_email: input.optInEmail,
      opt_in_sms: input.optInSms,
      opt_in_whatsapp: input.optInWhatsapp,
      opt_in_push: input.optInPush,
      opt_in_origen: hasOptIn ? "registro_manual" : null,
      opt_in_en: hasOptIn ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.patientId);

  if (error) {
    await writeAuditError({
      staff,
      accion: "patient.update_contact",
      tabla: "patients",
      mensaje: error.message,
      diff: { patientId: input.patientId },
    });
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "patient.update_contact",
    tabla: "patients",
    registroId: input.patientId,
    resultado: "exito",
    mensaje: "Contacto de paciente actualizado",
    diff: { nombre: input.nombre },
  });

  revalidatePath("/app/pacientes");
  revalidatePath(`/app/pacientes/${input.patientId}`);
  return { ok: true, id: input.patientId };
}

export async function searchPatientsAction(raw: unknown) {
  const parsed = SearchPatientsSchema.safeParse(raw);
  await requireCurrentStaff();

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Búsqueda inválida",
    };
  }

  const q = parsed.data.q.replace(/[%_]/g, "\\$&");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, nombre, telefono, email")
    .is("deleted_at", null)
    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
    .order("nombre", { ascending: true })
    .limit(parsed.data.limit);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    patients: (data ?? []) as Array<{
      id: string;
      nombre: string;
      telefono: string;
      email: string | null;
    }>,
  };
}

export async function listPatientClinicalEpisodesAction(patientId: string) {
  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false as const, error: "Sin permiso" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_clinical")
    .select("id, titulo, estado, fecha_apertura, fecha_cierre, created_at")
    .eq("patient_id", patientId)
    .order("fecha_apertura", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const episodes: ClinicalEpisodeSummary[] = (
    (data ?? []) as Array<{
      id: string;
      titulo: string;
      estado: string;
      fecha_apertura: string;
      fecha_cierre: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    titulo: row.titulo || "Expediente clínico",
    estado: row.estado,
    fechaApertura: row.fecha_apertura,
    fechaCierre: row.fecha_cierre,
    createdAt: row.created_at,
  }));

  return { ok: true as const, episodes };
}

export async function createPatientClinicalEpisodeAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = CreateClinicalEpisodeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false, error: "Sin permiso para expediente clínico" };
  }
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Recepción no crea expedientes clínicos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_clinical")
    .insert({
      clinic_id: staff.clinicId,
      patient_id: parsed.data.patientId,
      titulo: parsed.data.titulo,
      estado: "activo",
    })
    .select("id")
    .single();

  if (error) {
    if (/titulo|estado|column|unique|patient_id/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Para crear varios expedientes aplique la migración 20260730300000_multi_expediente_clinico.sql en Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "No se pudo crear el expediente" };
  }

  const id = (data as { id: string }).id;
  await writeAuditLog({
    staff,
    accion: "patient_clinical.create",
    tabla: "patient_clinical",
    registroId: id,
    diff: { patientId: parsed.data.patientId, titulo: parsed.data.titulo },
  });

  revalidatePath(`/app/pacientes/${parsed.data.patientId}`);
  return { ok: true, id };
}

export async function updatePatientClinicalAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateClinicalEpisodeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos clínicos inválidos",
    };
  }

  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false, error: "Sin permiso para expediente clínico" };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("patient_clinical")
    .select("id")
    .eq("id", input.clinicalId)
    .eq("patient_id", input.patientId)
    .maybeSingle();

  if (readError || !existing) {
    return { ok: false, error: "Expediente no encontrado" };
  }

  const estadoProbe = await supabase
    .from("patient_clinical")
    .select("estado")
    .eq("id", input.clinicalId)
    .maybeSingle();

  if (
    !estadoProbe.error &&
    (estadoProbe.data as { estado?: string } | null)?.estado === "cerrado"
  ) {
    return {
      ok: false,
      error: "Este expediente está cerrado. Abra uno nuevo para continuar.",
    };
  }

  const encrypted = encryptClinicalFields({
    historial_medico: input.historialMedico ?? null,
    alergias: input.alergias ?? null,
    medicamentos: input.medicamentos ?? null,
    diagnosticos_previos: input.diagnosticosPrevios ?? null,
    anamnesis: input.anamnesis ?? null,
    exploracion_fisica: input.exploracionFisica ?? null,
    diagnostico_fisioterapeutico: input.diagnosticoFisioterapeutico ?? null,
    objetivo_tratamiento: input.objetivoTratamiento ?? null,
  });

  let { error } = await supabase
    .from("patient_clinical")
    .update({
      ...(input.titulo ? { titulo: input.titulo.trim() } : {}),
      ...encrypted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.clinicalId);

  if (error && /titulo|estado|column/i.test(error.message)) {
    ({ error } = await supabase
      .from("patient_clinical")
      .update({
        ...encrypted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.clinicalId));
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "patient_clinical.update",
    tabla: "patient_clinical",
    registroId: input.clinicalId,
    diff: { fields: ["clinical_fields"] },
  });

  revalidatePath(`/app/pacientes/${input.patientId}`);
  return { ok: true, id: input.clinicalId };
}

export async function closePatientClinicalEpisodeAction(
  patientId: string,
  clinicalId: string,
): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false, error: "Sin permiso" };
  }
  if (staff.rol === "recepcionista") {
    return { ok: false, error: "Recepción no cierra expedientes" };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("patient_clinical")
    .update({
      estado: "cerrado",
      fecha_cierre: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicalId)
    .eq("patient_id", patientId);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "patient_clinical.close",
    tabla: "patient_clinical",
    registroId: clinicalId,
    diff: { patientId },
  });

  revalidatePath(`/app/pacientes/${patientId}`);
  return { ok: true, id: clinicalId };
}

export async function getPatientClinicalAction(clinicalId: string) {
  const staff = await requireCurrentStaff();
  if (!RoleCapabilities[staff.rol].verExpedienteClinico) {
    return { ok: false as const, error: "Sin permiso" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_clinical")
    .select("*")
    .eq("id", clinicalId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  await writeAuditLog({
    staff,
    accion: "patient_clinical.read",
    tabla: "patient_clinical",
    registroId: clinicalId,
    diff: { read: true },
  });

  if (!data) {
    return { ok: true as const, clinical: null };
  }

  const row = data as Record<string, string | null>;
  try {
    const plain = decryptClinicalFields({
      historial_medico: row.historial_medico,
      alergias: row.alergias,
      medicamentos: row.medicamentos,
      diagnosticos_previos: row.diagnosticos_previos,
      anamnesis: row.anamnesis,
      exploracion_fisica: row.exploracion_fisica,
      diagnostico_fisioterapeutico: row.diagnostico_fisioterapeutico,
      objetivo_tratamiento: row.objetivo_tratamiento,
    });
    return {
      ok: true as const,
      clinical: {
        ...plain,
        id: row.id as string,
        patientId: row.patient_id as string,
        titulo: (row.titulo as string) || "Expediente clínico",
        estado: (row.estado as string) || "activo",
        fechaApertura: row.fecha_apertura as string,
        fechaCierre: row.fecha_cierre,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo descifrar el expediente";
    return { ok: false as const, error: msg };
  }
}

export async function softDeletePatientAction(patientId: string): Promise<ActionResult> {
  const staff = await requireCurrentStaff();
  if (staff.rol !== "admin") {
    return { ok: false, error: "Solo admin puede archivar pacientes" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", patientId);

  if (error) return { ok: false, error: error.message };

  await writeAuditLog({
    staff,
    accion: "patient.soft_delete",
    tabla: "patients",
    registroId: patientId,
  });

  revalidatePath("/app/pacientes");
  return { ok: true, id: patientId };
}
