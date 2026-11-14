export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBackupTimestamp(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year}-${hours}-${minutes}`;
}

export function buildScheduledIso(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}

export function getLocalDateTimeIso(date: Date = new Date()): string {
  const dateStr = getLocalDateString(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr}T${hours}:${minutes}:00`;
}

export function isScheduledTimeReached(scheduledAtIso: string): boolean {
  const nowIso = getLocalDateTimeIso();
  return nowIso >= scheduledAtIso;
}

export function extractIsoDatePart(isoDateTime?: string | null): string {
  if (!isoDateTime) return getLocalDateString();
  if (isoDateTime.endsWith('Z')) {
    const dt = new Date(isoDateTime);
    if (!Number.isNaN(dt.getTime())) {
      return getLocalDateString(dt);
    }
  }
  return isoDateTime.split('T')[0];
}

export function formatBirthDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function parseBrDateToIso(brDate: string): string | null {
  const match = brDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
    return null;
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatTimeDisplay(isoOrTime: string): string {
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) {
    return isoOrTime;
  }
  if (!isoOrTime.endsWith('Z')) {
    const match = isoOrTime.match(/T(\d{2}:\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(isoOrTime);
  if (Number.isNaN(date.getTime())) {
    const match = isoOrTime.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : isoOrTime;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const clean = extractIsoDatePart(isoDate);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export function formatDateTimeDisplay(isoDateTime?: string | null): string {
  if (!isoDateTime) return '—';
  const datePart = formatDateDisplay(isoDateTime);
  const timePart = formatTimeDisplay(isoDateTime);
  return `${datePart} às ${timePart}`;
}

/**
 * Calcula todos os horários do dia no relógio (HH:mm) a partir de um horário base
 * e um intervalo em horas (ex: início 08:00 a cada 8h -> ["08:00", "16:00", "00:00"]).
 */
export function calculateTimesFromInterval(
  startTime: string,
  intervalHours: number
): string[] {
  const [rawHour, rawMinute] = startTime.split(':').map(Number);
  const startHour = Number.isFinite(rawHour) ? rawHour : 8;
  const startMinute = Number.isFinite(rawMinute) ? rawMinute : 0;

  if (intervalHours <= 0 || intervalHours >= 24) {
    return [
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
    ];
  }

  const times: string[] = [];
  const totalSlots = Math.max(1, Math.floor(24 / intervalHours));

  for (let i = 0; i < totalSlots; i++) {
    const hour = (startHour + i * intervalHours) % 24;
    const formatted = `${String(hour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
    if (!times.includes(formatted)) {
      times.push(formatted);
    }
  }

  return times.sort();
}

export const WEEKDAY_LABELS = [
  { day: 0, short: 'Dom', full: 'Domingo' },
  { day: 1, short: 'Seg', full: 'Segunda' },
  { day: 2, short: 'Ter', full: 'Terça' },
  { day: 3, short: 'Qua', full: 'Quarta' },
  { day: 4, short: 'Qui', full: 'Quinta' },
  { day: 5, short: 'Sex', full: 'Sexta' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
] as const;
