import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  medications,
  treatmentCycles,
  doseLogs,
  Medication,
  MedicationStatus,
  MedicationType,
  PillShape,
  RecurrenceType,
  TreatmentCycle,
} from '@/db/schema';
import {
  cancelNotificationIds,
  scheduleCycleNotifications,
} from './notificationService';
import {
  buildScheduledIso,
  calculateTimesFromInterval,
  getLocalDateString,
} from '@/utils/dateUtils';

export interface CycleInput {
  doseAmount: string;
  recurrenceType?: RecurrenceType;
  intervalHours?: number;
  startTime?: string;
  scheduledTimes?: string[];
  daysOfWeek?: number[];
  isContinuous?: boolean;
  targetOccurrences?: number | null;
  durationDays?: number | null;
  startDate?: string;
}

export interface CreateMedicationInput {
  commercialName: string;
  activeIngredient: string;
  concentration: string;
  type: MedicationType;
  boxPhotoBase64?: string | null;
  pillShape: PillShape;
  pillColorPrimary: string;
  pillColorSecondary: string;
  cycle: CycleInput;
}

export interface MedicationWithCycle extends Medication {
  activeCycle: TreatmentCycle | null;
  allCycles: TreatmentCycle[];
}

function normalizeCycleSchedule(input: CycleInput): {
  scheduledTimes: string[];
  daysOfWeek: number[];
  targetOccurrences: number;
} {
  let scheduledTimes: string[] = [];

  if (input.recurrenceType === 'interval_hours') {
    const interval = input.intervalHours && input.intervalHours > 0 ? input.intervalHours : 8;
    const baseTime = input.startTime || '08:00';
    scheduledTimes = calculateTimesFromInterval(baseTime, interval);
  } else {
    scheduledTimes =
      input.scheduledTimes && input.scheduledTimes.length > 0
        ? [...input.scheduledTimes].sort()
        : ['08:00'];
  }

  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

  const targetOccurrences =
    input.targetOccurrences && input.targetOccurrences > 0
      ? input.targetOccurrences
      : scheduledTimes.length;

  return { scheduledTimes, daysOfWeek, targetOccurrences };
}

/**
 * Gera exatamente N horários agendados (YYYY-MM-DDTHH:mm:00) repetindo
 * os horários fixos informados a partir de startDate.
 */
function buildOccurrenceSlots(
  startDate: string,
  scheduledTimes: string[],
  targetOccurrences: number
): string[] {
  const slots: string[] = [];
  const [y, m, d] = startDate.split('-').map(Number);
  let dayOffset = 0;

  while (slots.length < targetOccurrences) {
    const currentDay = new Date(y, m - 1, d + dayOffset);
    const dateStr = getLocalDateString(currentDay);

    for (const timeStr of scheduledTimes) {
      if (slots.length >= targetOccurrences) break;
      slots.push(buildScheduledIso(dateStr, timeStr));
    }
    dayOffset += 1;
  }

  return slots;
}

export async function createMedicationWithCycle(
  input: CreateMedicationInput
): Promise<MedicationWithCycle> {
  const commercialName = input.commercialName.trim();
  const activeIngredient = input.activeIngredient.trim();
  const concentration = input.concentration.trim();

  if (!commercialName || !activeIngredient || !concentration) {
    throw new Error('Preencha nome comercial, princípio ativo e dosagem.');
  }

  try {
    const now = new Date().toISOString();
    const startDate = input.cycle.startDate || getLocalDateString();
    const { scheduledTimes, daysOfWeek, targetOccurrences } = normalizeCycleSchedule(
      input.cycle
    );

    const [createdMed] = await db
      .insert(medications)
      .values({
        commercialName,
        activeIngredient,
        concentration,
        type: input.type,
        status: 'ativo',
        boxPhotoBase64: input.boxPhotoBase64 || null,
        pillShape: input.pillShape,
        pillColorPrimary: input.pillColorPrimary,
        pillColorSecondary: input.pillColorSecondary,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [createdCycle] = await db
      .insert(treatmentCycles)
      .values({
        medicationId: createdMed.id,
        doseAmount: input.cycle.doseAmount.trim() || '1 dose',
        recurrenceType: 'fixed_times',
        intervalHours: null,
        scheduledTimes: JSON.stringify(scheduledTimes),
        daysOfWeek: JSON.stringify(daysOfWeek),
        isContinuous: false,
        targetOccurrences,
        durationDays: null,
        takenCount: 0,
        startDate,
        endDate: null,
        isActive: true,
        notificationIds: '[]',
        createdAt: now,
      })
      .returning();

    const slots = buildOccurrenceSlots(
      startDate,
      scheduledTimes,
      targetOccurrences
    );
    if (slots.length > 0) {
      await db.insert(doseLogs).values(
        slots.map((scheduledAt) => ({
          treatmentCycleId: createdCycle.id,
          medicationId: createdMed.id,
          scheduledAt,
          status: 'pendente' as const,
          takenAt: null,
          snoozedUntil: null,
          notes: null,
          createdAt: now,
        }))
      );
    }

    const notifIds = await scheduleCycleNotifications({
      medicationId: createdMed.id,
      cycleId: createdCycle.id,
      commercialName: createdMed.commercialName,
      concentration: createdMed.concentration,
      doseAmount: createdCycle.doseAmount,
      recurrenceType: createdCycle.recurrenceType,
      scheduledTimes,
      daysOfWeek,
      occurrenceSlots: slots,
    });

    if (notifIds.length > 0) {
      await db
        .update(treatmentCycles)
        .set({ notificationIds: JSON.stringify(notifIds) })
        .where(eq(treatmentCycles.id, createdCycle.id));
      createdCycle.notificationIds = JSON.stringify(notifIds);
    }

    return {
      ...createdMed,
      activeCycle: createdCycle,
      allCycles: [createdCycle],
    };
  } catch (error) {
    console.error('[MedicationService] Erro ao cadastrar medicamento:', error);
    throw error;
  }
}

export async function listMedicationsByStatus(
  status?: MedicationStatus
): Promise<MedicationWithCycle[]> {
  try {
    const meds = status
      ? await db
          .select()
          .from(medications)
          .where(eq(medications.status, status))
          .orderBy(desc(medications.updatedAt))
      : await db
          .select()
          .from(medications)
          .orderBy(desc(medications.updatedAt));

    const results: MedicationWithCycle[] = [];
    for (const med of meds) {
      const cycles = await db
        .select()
        .from(treatmentCycles)
        .where(eq(treatmentCycles.medicationId, med.id))
        .orderBy(desc(treatmentCycles.id));

      const activeCycle = cycles.find((c) => c.isActive) ?? cycles[0] ?? null;
      results.push({
        ...med,
        activeCycle,
        allCycles: cycles,
      });
    }

    return results;
  } catch (error) {
    console.error('[MedicationService] Erro ao listar medicamentos:', error);
    throw error;
  }
}

export async function getMedicationDetail(
  medicationId: number
): Promise<MedicationWithCycle | null> {
  try {
    const rows = await db
      .select()
      .from(medications)
      .where(eq(medications.id, medicationId))
      .limit(1);

    if (!rows[0]) return null;

    const cycles = await db
      .select()
      .from(treatmentCycles)
      .where(eq(treatmentCycles.medicationId, medicationId))
      .orderBy(desc(treatmentCycles.id));

    const activeCycle = cycles.find((c) => c.isActive) ?? null;

    return {
      ...rows[0],
      activeCycle,
      allCycles: cycles,
    };
  } catch (error) {
    console.error('[MedicationService] Erro ao buscar detalhes do medicamento:', error);
    throw error;
  }
}

/**
 * Arquiva o medicamento (exclusão lógica com data_fim registrada no ciclo),
 * encerrando lembretes, limpando doses futuras ainda pendentes e mantendo todo o histórico.
 */
export async function archiveMedication(medicationId: number): Promise<void> {
  try {
    const now = new Date().toISOString();
    const todayDate = getLocalDateString();
    const detail = await getMedicationDetail(medicationId);
    if (!detail) throw new Error('Medicamento não encontrado.');

    for (const cycle of detail.allCycles) {
      if (cycle.isActive) {
        const notifIds: string[] = JSON.parse(cycle.notificationIds || '[]');
        await cancelNotificationIds(notifIds);

        await db
          .delete(doseLogs)
          .where(
            and(
              eq(doseLogs.treatmentCycleId, cycle.id),
              eq(doseLogs.status, 'pendente')
            )
          );

        await db
          .update(treatmentCycles)
          .set({
            isActive: false,
            endDate: todayDate,
            notificationIds: '[]',
          })
          .where(eq(treatmentCycles.id, cycle.id));
      }
    }

    await db
      .update(medications)
      .set({ status: 'arquivado', updatedAt: now })
      .where(eq(medications.id, medicationId));
  } catch (error) {
    console.error('[MedicationService] Erro ao arquivar medicamento:', error);
    throw error;
  }
}

/**
 * Reativa um medicamento arquivado ou inativo criando um novo ciclo de tratamento
 * com nova data_inicio, preservando integralmente os ciclos e datas anteriores.
 */
export async function reactivateMedicationWithNewCycle(
  medicationId: number,
  cycleInput: CycleInput
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const todayDate = cycleInput.startDate || getLocalDateString();
    const detail = await getMedicationDetail(medicationId);
    if (!detail) throw new Error('Medicamento não encontrado.');

    // Encerra qualquer ciclo anterior que ainda esteja marcado como ativo
    for (const oldCycle of detail.allCycles) {
      if (oldCycle.isActive) {
        const notifIds: string[] = JSON.parse(oldCycle.notificationIds || '[]');
        await cancelNotificationIds(notifIds);

        await db
          .update(treatmentCycles)
          .set({
            isActive: false,
            endDate: oldCycle.endDate || todayDate,
            notificationIds: '[]',
          })
          .where(eq(treatmentCycles.id, oldCycle.id));
      }
    }

    const { scheduledTimes, daysOfWeek, targetOccurrences } =
      normalizeCycleSchedule(cycleInput);

    const [newCycle] = await db
      .insert(treatmentCycles)
      .values({
        medicationId: detail.id,
        doseAmount: cycleInput.doseAmount.trim() || '1 dose',
        recurrenceType: 'fixed_times',
        intervalHours: null,
        scheduledTimes: JSON.stringify(scheduledTimes),
        daysOfWeek: JSON.stringify(daysOfWeek),
        isContinuous: false,
        targetOccurrences,
        durationDays: null,
        takenCount: 0,
        startDate: todayDate,
        endDate: null,
        isActive: true,
        notificationIds: '[]',
        createdAt: now,
      })
      .returning();

    const slots = buildOccurrenceSlots(
      todayDate,
      scheduledTimes,
      targetOccurrences
    );
    if (slots.length > 0) {
      await db.insert(doseLogs).values(
        slots.map((scheduledAt) => ({
          treatmentCycleId: newCycle.id,
          medicationId: detail.id,
          scheduledAt,
          status: 'pendente' as const,
          takenAt: null,
          snoozedUntil: null,
          notes: null,
          createdAt: now,
        }))
      );
    }

    const notifIds = await scheduleCycleNotifications({
      medicationId: detail.id,
      cycleId: newCycle.id,
      commercialName: detail.commercialName,
      concentration: detail.concentration,
      doseAmount: newCycle.doseAmount,
      recurrenceType: newCycle.recurrenceType,
      scheduledTimes,
      daysOfWeek,
      occurrenceSlots: slots,
    });

    await db
      .update(treatmentCycles)
      .set({ notificationIds: JSON.stringify(notifIds) })
      .where(eq(treatmentCycles.id, newCycle.id));

    await db
      .update(medications)
      .set({ status: 'ativo', updatedAt: now })
      .where(eq(medications.id, medicationId));
  } catch (error) {
    console.error('[MedicationService] Erro ao reativar medicamento:', error);
    throw error;
  }
}

export async function updateMedicationBoxPhoto(
  medicationId: number,
  boxPhotoBase64: string | null
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await db
      .update(medications)
      .set({ boxPhotoBase64, updatedAt: now })
      .where(eq(medications.id, medicationId));
  } catch (error) {
    console.error('[MedicationService] Erro ao atualizar foto da caixa:', error);
    throw error;
  }
}
