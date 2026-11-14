import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight, Calendar, Clock } from 'lucide-react-native';
import { MedicationWithCycle } from '@/services/medicationService';
import { formatDateDisplay } from '@/utils/dateUtils';
import { PillIcon } from './PillIcon';

export interface MedicationCardProps {
  medication: MedicationWithCycle;
  onPress: (id: number) => void;
}

const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  ativo: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    label: 'Ativo',
  },
  inativo: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Inativo',
  },
  arquivado: {
    bg: 'bg-slate-200',
    text: 'text-slate-700',
    label: 'Arquivado',
  },
};

export function MedicationCard({ medication, onPress }: MedicationCardProps) {
  const badge = STATUS_BADGE[medication.status] ?? STATUS_BADGE.ativo;
  const cycle = medication.activeCycle ?? medication.allCycles[0] ?? null;

  let timesList: string[] = [];
  if (cycle?.scheduledTimes) {
    try {
      timesList = JSON.parse(cycle.scheduledTimes);
    } catch {
      timesList = [];
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(medication.id)}
      className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 flex-row items-center"
    >
      <View className="mr-3.5">
        {medication.boxPhotoBase64 ? (
          <View className="relative">
            <Image
              source={{ uri: medication.boxPhotoBase64 }}
              className="w-14 h-14 rounded-xl border border-slate-200"
            />
            <View className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-200">
              <PillIcon
                shape={medication.pillShape}
                primaryColor={medication.pillColorPrimary}
                secondaryColor={medication.pillColorSecondary}
                size={20}
              />
            </View>
          </View>
        ) : (
          <View className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center">
            <PillIcon
              shape={medication.pillShape}
              primaryColor={medication.pillColorPrimary}
              secondaryColor={medication.pillColorSecondary}
              size={38}
            />
          </View>
        )}
      </View>

      <View className="flex-1 pr-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-base font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
            {medication.commercialName}
          </Text>
          <View className={`px-2.5 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-[11px] font-bold ${badge.text}`}>
              {badge.label}
            </Text>
          </View>
        </View>

        <Text className="text-xs text-slate-600 mb-1.5" numberOfLines={1}>
          {medication.activeIngredient} • {medication.concentration} (
          {medication.type})
        </Text>

        {cycle && (
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <View className="flex-row items-center">
              <Clock size={12} color="#64748B" />
              <Text className="text-xs text-slate-600 ml-1">
                {cycle.doseAmount} ({timesList.join(', ')})
              </Text>
            </View>

            <View className="flex-row items-center">
              <Calendar size={12} color="#64748B" />
              <Text className="text-xs text-slate-500 ml-1">
                Início: {formatDateDisplay(cycle.startDate)}
                {cycle.endDate ? ` • Fim: ${formatDateDisplay(cycle.endDate)}` : ''}
              </Text>
            </View>
          </View>
        )}
      </View>

      <ChevronRight size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}
