import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { checkpointDatabase, DATABASE_NAME, db, expoDb } from '@/db/client';
import * as schema from '@/db/schema';
import {
  doseLogs,
  medications,
  treatmentCycles,
  userProfile,
  Medication,
} from '@/db/schema';
import { scheduleCycleNotifications } from './notificationService';
import { getBackupTimestamp } from '@/utils/dateUtils';

const TEMP_IMPORT_DB_NAME = 'temp_import_backup.db';

/**
 * Consolida o arquivo SQLite (.db) com todas as tabelas e imagens Base64
 * e abre o menu nativo de compartilhamento.
 */
export async function exportRawDatabaseFile(): Promise<void> {
  try {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      throw new Error(
        'O compartilhamento de arquivos não está disponível neste dispositivo.'
      );
    }

    checkpointDatabase();

    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('Diretório de documentos indisponível.');
    }

    const sqliteFileUri = `${docDir}SQLite/${DATABASE_NAME}`;
    const info = await FileSystem.getInfoAsync(sqliteFileUri);
    if (!info.exists) {
      throw new Error(
        'Arquivo físico do banco SQLite ainda não foi localizado.'
      );
    }

    const dateStamp = getBackupTimestamp();
    const cacheDir = FileSystem.cacheDirectory ?? docDir;
    const exportCopyUri = `${cacheDir}controle-remedios-${dateStamp}.db`;

    await FileSystem.copyAsync({
      from: sqliteFileUri,
      to: exportCopyUri,
    });

    await Sharing.shareAsync(exportCopyUri, {
      mimeType: 'application/x-sqlite3',
      dialogTitle: 'Exportar Banco SQLite (.db)',
      UTI: 'public.database',
    });
  } catch (error) {
    console.error('[BackupService] Erro ao exportar arquivo .db:', error);
    throw error;
  }
}

/**
 * Importa e restaura um arquivo SQLite (.db) de backup (incluindo fotos em Base64,
 * ciclos e histórico de tomadas) e reagenda os lembretes ativos.
 */
export async function importDatabaseFile(): Promise<{
  medicationsCount: number;
  dosesCount: number;
} | null> {
  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
    });

    if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
      return null;
    }

    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('Diretório de documentos indisponível.');
    }

    const sqliteDir = `${docDir}SQLite/`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

    const tempDbUri = `${sqliteDir}${TEMP_IMPORT_DB_NAME}`;
    await FileSystem.deleteAsync(tempDbUri, { idempotent: true });

    await FileSystem.copyAsync({
      from: pickerResult.assets[0].uri,
      to: tempDbUri,
    });

    let users: schema.UserProfile[] = [];
    let meds: schema.Medication[] = [];
    let cycles: schema.TreatmentCycle[] = [];
    let logs: schema.DoseLog[] = [];

    const tempExpoDb = SQLite.openDatabaseSync(TEMP_IMPORT_DB_NAME);
    try {
      const tables = tempExpoDb.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = new Set(tables.map((t) => t.name));
      const requiredTables = [
        'user_profile',
        'medications',
        'treatment_cycles',
        'dose_logs',
      ];

      for (const table of requiredTables) {
        if (!tableNames.has(table)) {
          throw new Error(
            'O arquivo selecionado não é um banco SQLite (.db) válido do Controle de Remédios.'
          );
        }
      }

      const tempDb = drizzle(tempExpoDb, { schema });
      [users, meds, cycles, logs] = await Promise.all([
        tempDb.select().from(userProfile),
        tempDb.select().from(medications),
        tempDb.select().from(treatmentCycles),
        tempDb.select().from(doseLogs),
      ]);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Controle de Remédios')) {
        throw err;
      }
      throw new Error(
        'O arquivo selecionado não é um banco SQLite (.db) válido do Controle de Remédios.'
      );
    } finally {
      try {
        tempExpoDb.closeSync();
      } catch {
        // Ignora erro caso já esteja fechado
      }
      try {
        SQLite.deleteDatabaseSync(TEMP_IMPORT_DB_NAME);
      } catch {
        await FileSystem.deleteAsync(tempDbUri, { idempotent: true });
      }
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    expoDb.withTransactionSync(() => {
      expoDb.execSync(`
        DELETE FROM dose_logs;
        DELETE FROM treatment_cycles;
        DELETE FROM medications;
        DELETE FROM user_profile;
      `);
    });

    if (users.length > 0) {
      await db.insert(userProfile).values(users);
    }

    if (meds.length > 0) {
      await db.insert(medications).values(meds);
    }

    if (cycles.length > 0) {
      await db.insert(treatmentCycles).values(cycles);
    }

    if (logs.length > 0) {
      await db.insert(doseLogs).values(logs);
    }

    checkpointDatabase();

    // Reagenda as notificações locais para todos os medicamentos e ciclos ativos restaurados
    const medMap = new Map<number, Medication>();
    for (const m of meds) {
      medMap.set(m.id, m);
    }

    for (const cycle of cycles) {
      const parentMed = medMap.get(cycle.medicationId);
      if (!parentMed || parentMed.status !== 'ativo' || !cycle.isActive) {
        continue;
      }

      const scheduledTimes: string[] = JSON.parse(
        cycle.scheduledTimes || '["08:00"]'
      );
      const daysOfWeek: number[] = JSON.parse(
        cycle.daysOfWeek || '[0,1,2,3,4,5,6]'
      );

      const pendingCycleSlots = logs
        .filter(
          (l) => l.treatmentCycleId === cycle.id && l.status === 'pendente'
        )
        .map((l) => l.scheduledAt);

      const notifIds = await scheduleCycleNotifications({
        medicationId: parentMed.id,
        cycleId: cycle.id,
        commercialName: parentMed.commercialName,
        concentration: parentMed.concentration,
        doseAmount: cycle.doseAmount,
        recurrenceType: cycle.recurrenceType,
        scheduledTimes,
        daysOfWeek,
        occurrenceSlots: pendingCycleSlots,
      });

      await db
        .update(treatmentCycles)
        .set({ notificationIds: JSON.stringify(notifIds) })
        .where(eq(treatmentCycles.id, cycle.id));
    }

    return {
      medicationsCount: meds.length,
      dosesCount: logs.length,
    };
  } catch (error) {
    console.error('[BackupService] Erro ao importar backup .db:', error);
    throw error;
  }
}
