import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { Clock, SkipForward, BellPlus } from 'lucide-react-native';
import { DailyDoseItem } from '@/services/scheduleService';
import {
  formatDateTimeDisplay,
  formatTimeDisplay,
  isScheduledTimeReached,
} from '@/utils/dateUtils';
import { PillIcon } from './PillIcon';

export interface DoseCardProps {
  item: DailyDoseItem;
  onPress: (item: DailyDoseItem) => void;
  onSkip: (doseLogId: number) => void;
  onSnooze: (doseLogId: number) => void;
}

const SWIPE_THRESHOLD = 85;

export function DoseCard({
  item,
  onPress,
  onSkip,
  onSnooze,
}: DoseCardProps) {
  const { doseLog, medication, cycle } = item;
  const scheduledTime = formatTimeDisplay(doseLog.scheduledAt);
  const isTaken = doseLog.status === 'tomado';
  const isSkipped = doseLog.status === 'pulado';
  const isPending = doseLog.status === 'pendente';

  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!isPending) return false;
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          return absDx > 12 && absDx > absDy * 1.5;
        },
        onPanResponderMove: (_, gestureState) => {
          const clamped = Math.max(-140, Math.min(140, gestureState.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_, gestureState) => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();

          if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
            if (!isScheduledTimeReached(doseLog.scheduledAt)) {
              Alert.alert(
                'Horário Agendado',
                `Só é possível pular ou adiar este medicamento após o horário agendado (${formatDateTimeDisplay(doseLog.scheduledAt)}).`
              );
              return;
            }

            if (gestureState.dx > SWIPE_THRESHOLD) {
              onSkip(doseLog.id);
            } else if (gestureState.dx < -SWIPE_THRESHOLD) {
              onSnooze(doseLog.id);
            }
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [isPending, doseLog.id, doseLog.scheduledAt, onSkip, onSnooze, translateX]
  );

  return (
    <View className="mb-3 rounded-2xl overflow-hidden relative">
      {/* Fundo das ações de arrastar (Esquerda = +15m, Direita = Pular) */}
      {isPending && (
        <View className="absolute inset-0 flex-row items-center justify-between rounded-2xl overflow-hidden">
          <View className="h-full w-1/2 bg-amber-500 flex-row items-center pl-5">
            <SkipForward size={18} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white ml-1.5">
              Pular
            </Text>
          </View>
          <View className="h-full w-1/2 bg-blue-600 flex-row items-center justify-end pr-5">
            <BellPlus size={18} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white ml-1.5">
              Adiar +15m
            </Text>
          </View>
        </View>
      )}

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...(isPending ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPress(item)}
          className={`rounded-2xl p-4 border ${
            isTaken
              ? 'bg-emerald-50 border-emerald-200'
              : isSkipped
              ? 'bg-slate-100 border-slate-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="mr-3 items-center justify-center">
                {medication.boxPhotoBase64 ? (
                  <View className="relative">
                    <Image
                      source={{ uri: medication.boxPhotoBase64 }}
                      className="w-12 h-12 rounded-xl border border-slate-200"
                    />
                    <View className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-200">
                      <PillIcon
                        shape={medication.pillShape}
                        primaryColor={medication.pillColorPrimary}
                        secondaryColor={medication.pillColorSecondary}
                        size={18}
                      />
                    </View>
                  </View>
                ) : (
                  <View className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center">
                    <PillIcon
                      shape={medication.pillShape}
                      primaryColor={medication.pillColorPrimary}
                      secondaryColor={medication.pillColorSecondary}
                      size={34}
                    />
                  </View>
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <View className="flex-row items-center bg-blue-50 px-2 py-0.5 rounded-md">
                    <Clock size={12} color="#2563EB" />
                    <Text className="text-xs font-bold text-blue-700 ml-1">
                      {scheduledTime}
                    </Text>
                  </View>
                  {cycle.targetOccurrences ? (
                    <Text className="text-[11px] font-medium text-slate-500">
                      {cycle.takenCount}/{cycle.targetOccurrences} doses
                    </Text>
                  ) : null}
                </View>

                <Text className="text-base font-bold text-slate-900 mt-1">
                  {medication.commercialName}{' '}
                  <Text className="text-sm font-medium text-slate-600">
                    ({medication.concentration})
                  </Text>
                </Text>

                <Text className="text-xs text-slate-600">
                  {medication.activeIngredient} • Tomar{' '}
                  <Text className="font-semibold text-slate-800">
                    {cycle.doseAmount}
                  </Text>
                </Text>

                {isTaken && doseLog.takenAt && (
                  <Text className="text-xs font-semibold text-emerald-700 mt-1">
                    ✓ Tomado em {formatDateTimeDisplay(doseLog.takenAt)}
                  </Text>
                )}

                {isSkipped && (
                  <Text className="text-xs font-semibold text-amber-700 mt-1">
                    Dose pulada (toque para editar ou desfazer)
                  </Text>
                )}

                {isPending && doseLog.snoozedUntil && (
                  <Text className="text-xs font-medium text-blue-600 mt-1">
                    Lembrete adiado até {formatTimeDisplay(doseLog.snoozedUntil)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
