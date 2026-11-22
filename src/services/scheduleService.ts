import { and, asc, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm';
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
  extractIsoDatePart,
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

/**
 * Doses pendentes de dias anteriores à data de hoje viram `nao_tomado`.
 * No próprio dia continuam `pendente`.
 */
export async function markOverdueDosesAsMissed(): Promise<void> {
  try {
    await db
      .update(doseLogs)
      .set({ status: 'nao_tomado' })
      .where(
        and(
          eq(doseLogs.status, 'pendente'),
          lt(doseLogs.scheduledAt, `${getLocalDateString()}T00:00:00`)
        )
      );
  } catch (error) {
    console.error('[ScheduleService] Erro ao marcar doses não tomadas:', error);
    throw error;
  }
}

async function hydrateDoseItems(
  logs: DoseLog[],
  onlyActiveOrResolved: boolean
): Promise<DailyDoseItem[]> {
  if (logs.length === 0) return [];

  const medIds = Array.from(new Set(logs.map((l) => l.medicationId)));
  const cycleIds = Array.from(new Set(logs.map((l) => l.treatmentCycleId)));

  const [medRows, cycleRows] = await Promise.all([
    db.select().from(medications).where(inArray(medications.id, medIds)),
    db
      .select()
      .from(treatmentCycles)
      .where(inArray(treatmentCycles.id, cycleIds)),
  ]);

  const medMap = new Map(medRows.map((m) => [m.id, m]));
  const cycleMap = new Map(cycleRows.map((c) => [c.id, c]));

  const items: DailyDoseItem[] = [];
  for (const log of logs) {
    const med = medMap.get(log.medicationId);
    const cycle = cycleMap.get(log.treatmentCycleId);
    if (!med || !cycle) continue;

    if (!onlyActiveOrResolved || med.status === 'ativo' || log.status !== 'pendente') {
      items.push({ doseLog: log, medication: med, cycle });
    }
  }

  return items;
}

export async function getDosesForDate(
  dateStr: string = getLocalDateString()
): Promise<DailyDoseItem[]> {
  try {
    await markOverdueDosesAsMissed();
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

    return await hydrateDoseItems(logs, true);
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

    if (extractIsoDatePart(log.scheduledAt) > getLocalDateString()) {
      throw new Error(
        'Não é possível marcar como tomado um medicamento agendado para uma data futura.'
      );
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

    const newTakenCount = takenLogs.length;

    const [cycle] = await db
      .select()
      .from(treatmentCycles)
      .where(eq(treatmentCycles.id, log.treatmentCycleId))
      .limit(1);

    const shouldReactivate =
      cycle &&
      !cycle.isActive &&
      (!cycle.targetOccurrences || newTakenCount < cycle.targetOccurrences);

    await db
      .update(treatmentCycles)
      .set({
        takenCount: newTakenCount,
        ...(shouldReactivate ? { isActive: true, endDate: null } : {}),
      })
      .where(eq(treatmentCycles.id, log.treatmentCycleId));

    if (shouldReactivate && cycle) {
      await db
        .update(medications)
        .set({ status: 'ativo', updatedAt: new Date().toISOString() })
        .where(eq(medications.id, cycle.medicationId));
    }
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
    await markOverdueDosesAsMissed();

    // Todas as doses até o fim de hoje (doses futuras ainda não aparecem)
    const combined = await db
      .select()
      .from(doseLogs)
      .where(lte(doseLogs.scheduledAt, `${getLocalDateString()}T23:59:59`))
      .orderBy(desc(doseLogs.scheduledAt))
      .limit(limit);

    return await hydrateDoseItems(combined, false);
  } catch (error) {
    console.error('[ScheduleService] Erro ao buscar histórico de doses:', error);
    throw error;
  }
}
