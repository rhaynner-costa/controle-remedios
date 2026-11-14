import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  doseLogs,
  medications,
  treatmentCycles,
  DoseLog,
  Medication,
  TreatmentCycle,
} from '@/db/schema';
import {
  buildScheduledIso,
  getLocalDateString,
  getLocalDateTimeIso,
  isScheduledTimeReached,
} from '@/utils/dateUtils';
import { archiveMedication } from './medicationService';
import { scheduleSnoozeNotification } from './notificationService';

export interface DailyDoseItem {
  doseLog: DoseLog;
  medication: Medication;
  cycle: TreatmentCycle;
}

/**
 * Garante que todos os slots de doses previstas para a data informada (YYYY-MM-DD)
 * existam em `dose_logs` para todos os medicamentos ativos.
 */
export async function syncDailyDosesForDate(
  dateStr: string = getLocalDateString()
): Promise<void> {
  try {
    const activeMeds = await db
      .select()
      .from(medications)
      .where(eq(medications.status, 'ativo'));

    const targetDateObj = new Date(`${dateStr}T12:00:00`);
    const weekday = targetDateObj.getDay();
    const nowIso = new Date().toISOString();

    for (const med of activeMeds) {
      const activeCycles = await db
        .select()
        .from(treatmentCycles)
        .where(
          and(
            eq(treatmentCycles.medicationId, med.id),
            eq(treatmentCycles.isActive, true)
          )
        );

      for (const cycle of activeCycles) {
        if (dateStr < cycle.startDate) continue;
        if (cycle.endDate && dateStr > cycle.endDate) continue;

        const allCycleLogs = await db
          .select()
          .from(doseLogs)
          .where(eq(doseLogs.treatmentCycleId, cycle.id));

        if (
          !cycle.isContinuous &&
          cycle.targetOccurrences &&
          allCycleLogs.length >= cycle.targetOccurrences
        ) {
          continue;
        }

        const daysOfWeek: number[] = JSON.parse(
          cycle.daysOfWeek || '[0,1,2,3,4,5,6]'
        );
        if (!daysOfWeek.includes(weekday)) continue;

        const scheduledTimes: string[] = JSON.parse(
          cycle.scheduledTimes || '["08:00"]'
        );

        let currentCount = allCycleLogs.length;

        for (const timeStr of scheduledTimes) {
          if (
            !cycle.isContinuous &&
            cycle.targetOccurrences &&
            currentCount >= cycle.targetOccurrences
          ) {
            break;
          }

          const scheduledAt = buildScheduledIso(dateStr, timeStr);

          const existing = await db
            .select()
            .from(doseLogs)
            .where(
              and(
                eq(doseLogs.treatmentCycleId, cycle.id),
                eq(doseLogs.scheduledAt, scheduledAt)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            await db.insert(doseLogs).values({
              treatmentCycleId: cycle.id,
              medicationId: med.id,
              scheduledAt,
              status: 'pendente',
              takenAt: null,
              snoozedUntil: null,
              notes: null,
              createdAt: nowIso,
            });
            currentCount += 1;
          }
        }
      }
    }
  } catch (error) {
    console.error('[ScheduleService] Erro ao sincronizar doses do dia:', error);
    throw error;
  }
}

export async function getDosesForDate(
  dateStr: string = getLocalDateString()
): Promise<DailyDoseItem[]> {
  try {
    await syncDailyDosesForDate(dateStr);

    const startBound = `${dateStr}T00:00:00`;
    const endBound = `${dateStr}T23:59:59`;

    const logs = await db
      .select()
      .from(doseLogs)
      .where(
        and(
          gte(doseLogs.scheduledAt, startBound),
          lte(doseLogs.scheduledAt, endBound)
        )
      )
      .orderBy(asc(doseLogs.scheduledAt));

    const items: DailyDoseItem[] = [];
    for (const log of logs) {
      const [med] = await db
        .select()
        .from(medications)
        .where(eq(medications.id, log.medicationId))
        .limit(1);

      const [cycle] = await db
        .select()
        .from(treatmentCycles)
        .where(eq(treatmentCycles.id, log.treatmentCycleId))
        .limit(1);

      if (!med || !cycle) continue;

      // Exibe na agenda do dia se o medicamento está ativo ou se a dose já foi tomada/pulada
      if (med.status === 'ativo' || log.status !== 'pendente') {
        items.push({ doseLog: log, medication: med, cycle });
      }
    }

    return items;
  } catch (error) {
    console.error('[ScheduleService] Erro ao buscar doses da data:', error);
    throw error;
  }
}

export interface MarkDoseTakenResult {
  autoArchived: boolean;
  takenCount: number;
  targetOccurrences: number | null;
}

/**
 * Marca uma dose como tomada, salva o horário real (`taken_at`), atualiza o contador
 * de ocorrências do ciclo e arquiva automaticamente o medicamento caso atinja a última dose.
 */
export async function markDoseAsTaken(
  doseLogId: number,
  customTakenAtIso?: string
): Promise<MarkDoseTakenResult> {
  try {
    const takenIso = customTakenAtIso || getLocalDateTimeIso();
    const [log] = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.id, doseLogId))
      .limit(1);

    if (!log) {
      throw new Error('Registro de dose não encontrado.');
    }

    await db
      .update(doseLogs)
      .set({
        status: 'tomado',
        takenAt: takenIso,
        snoozedUntil: null,
      })
      .where(eq(doseLogs.id, doseLogId));

    const takenLogs = await db
      .select()
      .from(doseLogs)
      .where(
        and(
          eq(doseLogs.treatmentCycleId, log.treatmentCycleId),
          eq(doseLogs.status, 'tomado')
        )
      );

    const newTakenCount = takenLogs.length;

    await db
      .update(treatmentCycles)
      .set({ takenCount: newTakenCount })
      .where(eq(treatmentCycles.id, log.treatmentCycleId));

    const [cycle] = await db
      .select()
      .from(treatmentCycles)
      .where(eq(treatmentCycles.id, log.treatmentCycleId))
      .limit(1);

    let autoArchived = false;
    if (
      cycle &&
      !cycle.isContinuous &&
      cycle.targetOccurrences &&
      newTakenCount >= cycle.targetOccurrences
    ) {
      await archiveMedication(cycle.medicationId);
      autoArchived = true;
    }

    return {
      autoArchived,
      takenCount: newTakenCount,
      targetOccurrences: cycle?.targetOccurrences ?? null,
    };
  } catch (error) {
    console.error('[ScheduleService] Erro ao marcar dose como tomada:', error);
    throw error;
  }
}

export async function markDoseAsSkipped(doseLogId: number): Promise<void> {
  try {
    const [log] = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.id, doseLogId))
      .limit(1);

    if (!log) throw new Error('Dose não encontrada.');
    if (!isScheduledTimeReached(log.scheduledAt)) {
      throw new Error(
        'Só é possível pular o medicamento após a data e hora de agendamento.'
      );
    }

    await db
      .update(doseLogs)
      .set({
        status: 'pulado',
        takenAt: null,
        snoozedUntil: null,
      })
      .where(eq(doseLogs.id, doseLogId));
  } catch (error) {
    console.error('[ScheduleService] Erro ao marcar dose como pulada:', error);
    throw error;
  }
}

export async function revertDoseToPending(doseLogId: number): Promise<void> {
  try {
    const [log] = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.id, doseLogId))
      .limit(1);

    if (!log) return;

    await db
      .update(doseLogs)
      .set({
        status: 'pendente',
        takenAt: null,
        snoozedUntil: null,
      })
      .where(eq(doseLogs.id, doseLogId));

    const takenLogs = await db
      .select()
      .from(doseLogs)
      .where(
        and(
          eq(doseLogs.treatmentCycleId, log.treatmentCycleId),
          eq(doseLogs.status, 'tomado')
        )
      );

    await db
      .update(treatmentCycles)
      .set({ takenCount: takenLogs.length })
      .where(eq(treatmentCycles.id, log.treatmentCycleId));
  } catch (error) {
    console.error('[ScheduleService] Erro ao reverter status da dose:', error);
    throw error;
  }
}

export async function snoozeDose15Minutes(doseLogId: number): Promise<void> {
  try {
    const [log] = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.id, doseLogId))
      .limit(1);

    if (!log) throw new Error('Dose não encontrada.');
    if (!isScheduledTimeReached(log.scheduledAt)) {
      throw new Error(
        'Só é possível adiar o lembrete após a data e hora de agendamento.'
      );
    }

    const [med] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, log.medicationId))
      .limit(1);

    const [cycle] = await db
      .select()
      .from(treatmentCycles)
      .where(eq(treatmentCycles.id, log.treatmentCycleId))
      .limit(1);

    if (!med || !cycle) throw new Error('Medicamento ou ciclo não encontrado.');

    const snoozeDate = new Date(Date.now() + 15 * 60 * 1000);
    await db
      .update(doseLogs)
      .set({ snoozedUntil: snoozeDate.toISOString() })
      .where(eq(doseLogs.id, doseLogId));

    await scheduleSnoozeNotification({
      medicationId: med.id,
      cycleId: cycle.id,
      doseLogId: log.id,
      commercialName: med.commercialName,
      doseAmount: cycle.doseAmount,
      minutes: 15,
    });
  } catch (error) {
    console.error('[ScheduleService] Erro ao adiar dose:', error);
    throw error;
  }
}

export async function getDoseHistory(limit: number = 100): Promise<DailyDoseItem[]> {
  try {
    const logs = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.status, 'tomado'))
      .orderBy(desc(doseLogs.takenAt))
      .limit(limit);

    const skippedLogs = await db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.status, 'pulado'))
      .orderBy(desc(doseLogs.scheduledAt))
      .limit(limit);

    const combined = [...logs, ...skippedLogs].sort((a, b) => {
      const dateA = a.takenAt || a.scheduledAt;
      const dateB = b.takenAt || b.scheduledAt;
      return dateB.localeCompare(dateA);
    });

    const items: DailyDoseItem[] = [];
    for (const log of combined.slice(0, limit)) {
      const [med] = await db
        .select()
        .from(medications)
        .where(eq(medications.id, log.medicationId))
        .limit(1);

      const [cycle] = await db
        .select()
        .from(treatmentCycles)
        .where(eq(treatmentCycles.id, log.treatmentCycleId))
        .limit(1);

      if (med && cycle) {
        items.push({ doseLog: log, medication: med, cycle });
      }
    }

    return items;
  } catch (error) {
    console.error('[ScheduleService] Erro ao buscar histórico de doses:', error);
    throw error;
  }
}
