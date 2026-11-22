import React from 'react';
import { View, Text } from 'react-native';
import { DoseLog } from '@/db/schema';
import { isScheduledTimeReached } from '@/utils/dateUtils';

export type DoseVisualStatus =
  | 'tomado'
  | 'pendente'
  | 'nao_tomado'
  | 'agendado';

// Mesmo padrão de badge do status do tratamento (MedicationCard)
const STATUS_STYLE: Record<
  DoseVisualStatus,
  { card: string; bg: string; text: string; label: string }
> = {
  tomado: {
    card: 'bg-emerald-50 border-emerald-200',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    label: 'Tomado',
  },
  pendente: {
    card: 'bg-amber-50 border-amber-200',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Pendente',
  },
  nao_tomado: {
    card: 'bg-orange-50 border-orange-200',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'Não tomado',
  },
  agendado: {
    card: 'bg-white border-slate-200',
    bg: '',
    text: '',
    label: '',
  },
};

/**
 * Tomado → tomado | pulado/nao_tomado → nao_tomado |
 * pendente após o horário → pendente | pendente antes do horário → agendado.
 */
export function getDoseVisualStatus(
  doseLog: Pick<DoseLog, 'status' | 'scheduledAt'>
): DoseVisualStatus {
  if (doseLog.status === 'tomado') return 'tomado';
  if (doseLog.status === 'pulado' || doseLog.status === 'nao_tomado') {
    return 'nao_tomado';
  }
  return isScheduledTimeReached(doseLog.scheduledAt) ? 'pendente' : 'agendado';
}

export function getDoseCardClass(status: DoseVisualStatus): string {
  return STATUS_STYLE[status].card;
}

export function DoseStatusBadge({
  status,
  testID,
}: {
  status: DoseVisualStatus;
  testID: string;
}) {
  if (status === 'agendado') return null;
  const style = STATUS_STYLE[status];

  return (
    <View className={`px-2.5 py-0.5 rounded-full ${style.bg}`}>
      <Text testID={testID} className={`text-[11px] font-bold ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
