import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'controle_remedios.db';

export const expoDb = SQLite.openDatabaseSync(DATABASE_NAME);

export const db = drizzle(expoDb, { schema });

export function checkpointDatabase(): void {
  try {
    expoDb.execSync('PRAGMA wal_checkpoint(FULL);');
  } catch (error) {
    console.warn('[DB] Aviso ao executar wal_checkpoint:', error);
  }
}

export function initializeDatabase(): void {
  try {
    expoDb.execSync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        birth_date TEXT,
        health_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        commercial_name TEXT NOT NULL,
        active_ingredient TEXT NOT NULL,
        concentration TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo',
        box_photo_base64 TEXT,
        pill_shape TEXT NOT NULL DEFAULT 'round',
        pill_color_primary TEXT NOT NULL DEFAULT '#3B82F6',
        pill_color_secondary TEXT NOT NULL DEFAULT '#FFFFFF',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS treatment_cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        medication_id INTEGER NOT NULL REFERENCES medications(id),
        dose_amount TEXT NOT NULL,
        recurrence_type TEXT NOT NULL,
        interval_hours INTEGER,
        scheduled_times TEXT NOT NULL,
        days_of_week TEXT NOT NULL,
        is_continuous INTEGER NOT NULL DEFAULT 1,
        target_occurrences INTEGER,
        duration_days INTEGER,
        taken_count INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        notification_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dose_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        treatment_cycle_id INTEGER NOT NULL REFERENCES treatment_cycles(id),
        medication_id INTEGER NOT NULL REFERENCES medications(id),
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        taken_at TEXT,
        snoozed_until TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);
      CREATE INDEX IF NOT EXISTS idx_cycles_medication ON treatment_cycles(medication_id, is_active);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dose_logs_unique_slot ON dose_logs(treatment_cycle_id, scheduled_at);
    `);
  } catch (error) {
    console.error('[DB] Falha ao inicializar tabelas SQLite:', error);
    throw error;
  }
}
