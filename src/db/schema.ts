import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const MEDICATION_TYPES = [
  'comprimido',
  'capsula',
  'liquido',
  'gotas',
  'pomada',
  'injetavel',
  'spray',
  'outro',
] as const;

export type MedicationType = (typeof MEDICATION_TYPES)[number];

export const MEDICATION_STATUSES = ['ativo', 'inativo', 'arquivado'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

export const PILL_SHAPES = [
  'round',
  'scored',
  'oval',
  'oblong',
  'capsule',
  'triangle',
  'octagon',
  'bottle',
] as const;

export type PillShape = (typeof PILL_SHAPES)[number];

export const RECURRENCE_TYPES = [
  'interval_hours',
  'fixed_times',
  'weekly_days',
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const DOSE_STATUSES = ['pendente', 'tomado', 'pulado', 'nao_tomado'] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

export const userProfile = sqliteTable('user_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  birthDate: text('birth_date'),
  healthNotes: text('health_notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  commercialName: text('commercial_name').notNull(),
  activeIngredient: text('active_ingredient').notNull(),
  concentration: text('concentration').notNull(),
  type: text('type').$type<MedicationType>().notNull(),
  status: text('status').$type<MedicationStatus>().notNull().default('ativo'),
  boxPhotoBase64: text('box_photo_base64'),
  pillShape: text('pill_shape').$type<PillShape>().notNull().default('round'),
  pillColorPrimary: text('pill_color_primary').notNull().default('#3B82F6'),
  pillColorSecondary: text('pill_color_secondary').notNull().default('#FFFFFF'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const treatmentCycles = sqliteTable('treatment_cycles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  doseAmount: text('dose_amount').notNull(),
  recurrenceType: text('recurrence_type').$type<RecurrenceType>().notNull(),
  intervalHours: integer('interval_hours'),
  scheduledTimes: text('scheduled_times').notNull(), // JSON array ex: ["08:00","16:00","00:00"]
  daysOfWeek: text('days_of_week').notNull(), // JSON array ex: [0,1,2,3,4,5,6]
  isContinuous: integer('is_continuous', { mode: 'boolean' })
    .notNull()
    .default(true),
  targetOccurrences: integer('target_occurrences'),
  durationDays: integer('duration_days'),
  takenCount: integer('taken_count').notNull().default(0),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notificationIds: text('notification_ids').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const doseLogs = sqliteTable('dose_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  treatmentCycleId: integer('treatment_cycle_id')
    .notNull()
    .references(() => treatmentCycles.id),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  scheduledAt: text('scheduled_at').notNull(), // YYYY-MM-DDTHH:mm:00
  status: text('status').$type<DoseStatus>().notNull().default('pendente'),
  takenAt: text('taken_at'),
  snoozedUntil: text('snoozed_until'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;

export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;

export type TreatmentCycle = typeof treatmentCycles.$inferSelect;
export type NewTreatmentCycle = typeof treatmentCycles.$inferInsert;

export type DoseLog = typeof doseLogs.$inferSelect;
export type NewDoseLog = typeof doseLogs.$inferInsert;
