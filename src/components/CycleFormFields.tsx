import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

export interface CycleFormState {
  doseAmount: string;
  scheduledTimes: string[];
  targetOccurrences: string;
}

export interface CycleFormFieldsProps {
  value: CycleFormState;
  onChange: (next: CycleFormState) => void;
}

export function CycleFormFields({ value, onChange }: CycleFormFieldsProps) {
  const [newTimeHour, setNewTimeHour] = useState('');
  const [newTimeMinute, setNewTimeMinute] = useState('');

  const updateField = <K extends keyof CycleFormState>(
    key: K,
    fieldValue: CycleFormState[K]
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const handleAddFixedTime = () => {
    if (!newTimeHour.trim() && !newTimeMinute.trim()) {
      Alert.alert('Horário', 'Informe a hora e o minuto para adicionar.');
      return;
    }

    const h = Math.min(23, Math.max(0, parseInt(newTimeHour || '0', 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(newTimeMinute || '0', 10) || 0));
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (!value.scheduledTimes.includes(formatted)) {
      updateField(
        'scheduledTimes',
        [...value.scheduledTimes, formatted].sort()
      );
    }

    setNewTimeHour('');
    setNewTimeMinute('');
  };

  const handleRemoveFixedTime = (timeToRemove: string) => {
    updateField(
      'scheduledTimes',
      value.scheduledTimes.filter((t) => t !== timeToRemove)
    );
  };

  const handleBlurHour = () => {
    if (!newTimeHour.trim()) return;
    const h = Math.min(23, Math.max(0, parseInt(newTimeHour, 10) || 0));
    setNewTimeHour(String(h).padStart(2, '0'));
  };

  const handleBlurMinute = () => {
    if (!newTimeMinute.trim()) return;
    const m = Math.min(59, Math.max(0, parseInt(newTimeMinute, 10) || 0));
    setNewTimeMinute(String(m).padStart(2, '0'));
  };

  const daysNum = Math.max(
    0,
    parseInt(value.targetOccurrences || '0', 10) || 0
  );
  const totalDoses = daysNum * value.scheduledTimes.length;

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <Text className="text-base font-bold text-slate-900 mb-3">
        Forma de Tomar (Posologia)
      </Text>

      {/* Quantidade por dose */}
      <Text className="text-xs font-semibold text-slate-600 uppercase mb-1.5">
        Dosagem por tomada *
      </Text>
      <TextInput
        testID="cycle-input-dose-amount"
        value={value.doseAmount}
        onChangeText={(t) => updateField('doseAmount', t)}
        placeholder="Ex: 1 comprimido, 20 gotas, 10 ml"
        className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-4"
      />

      {/* Horários Fixos */}
      <Text className="text-xs font-semibold text-slate-600 uppercase mb-1.5">
        Horários Fixos (Hora : Minuto) *
      </Text>
      <View className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4">
        <View className="flex-row items-center gap-2">
          <TextInput
            testID="cycle-input-hour"
            value={newTimeHour}
            onChangeText={(t) =>
              setNewTimeHour(t.replace(/\D/g, '').slice(0, 2))
            }
            onBlur={handleBlurHour}
            selectTextOnFocus
            placeholder="08"
            keyboardType="number-pad"
            maxLength={2}
            className="w-14 bg-white border border-slate-300 rounded-lg py-1.5 text-center font-bold text-slate-900"
          />
          <Text className="font-bold text-slate-700">:</Text>
          <TextInput
            testID="cycle-input-minute"
            value={newTimeMinute}
            onChangeText={(t) =>
              setNewTimeMinute(t.replace(/\D/g, '').slice(0, 2))
            }
            onBlur={handleBlurMinute}
            selectTextOnFocus
            placeholder="00"
            keyboardType="number-pad"
            maxLength={2}
            className="w-14 bg-white border border-slate-300 rounded-lg py-1.5 text-center font-bold text-slate-900"
          />
          <TouchableOpacity
            testID="cycle-btn-add-time"
            onPress={handleAddFixedTime}
            className="flex-row items-center bg-blue-600 px-3 py-2 rounded-lg"
          >
            <Plus size={14} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white ml-1">
              Adicionar horário
            </Text>
          </TouchableOpacity>
        </View>

        {value.scheduledTimes.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">
            {value.scheduledTimes.map((time) => (
              <View
                key={time}
                className="flex-row items-center bg-white border border-slate-300 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-sm font-bold text-slate-800 mr-2">
                  {time}
                </Text>
                <TouchableOpacity
                  testID={`cycle-btn-remove-time-${time}`}
                  onPress={() => handleRemoveFixedTime(time)}
                >
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Número de Ocorrências (Dias) */}
      <Text className="text-xs font-semibold text-slate-600 uppercase mb-1.5">
        Número de Ocorrências (Dias) *
      </Text>
      <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <TextInput
          testID="cycle-input-target-occurrences"
          value={value.targetOccurrences}
          onChangeText={(t) =>
            updateField('targetOccurrences', t.replace(/\D/g, ''))
          }
          selectTextOnFocus
          keyboardType="number-pad"
          placeholder="Ex: 3"
          className="bg-white border border-emerald-300 rounded-lg px-3 py-2 font-bold text-slate-900"
        />
        {daysNum > 0 && value.scheduledTimes.length > 0 && (
          <Text
            testID="cycle-summary-occurrences"
            className="text-[11px] text-emerald-800 mt-1.5"
          >
            Serão gerados exatamente{' '}
            <Text className="font-bold">
              {totalDoses} {totalDoses === 1 ? 'agendamento' : 'agendamentos'}
            </Text>{' '}
            ({daysNum} {daysNum === 1 ? 'dia' : 'dias'} ×{' '}
            {value.scheduledTimes.length}{' '}
            {value.scheduledTimes.length === 1 ? 'horário/dia' : 'horários/dia'}
            : {value.scheduledTimes.join(' • ')}).
          </Text>
        )}
      </View>
    </View>
  );
}
