import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PillShape } from '@/db/schema';
import { PillIcon } from './PillIcon';

export const SHAPE_OPTIONS: { value: PillShape; label: string }[] = [
  { value: 'round', label: 'Redondo' },
  { value: 'scored', label: 'Sulcado' },
  { value: 'oval', label: 'Oval' },
  { value: 'oblong', label: 'Oblongo' },
  { value: 'capsule', label: 'Cápsula' },
  { value: 'triangle', label: 'Triangular' },
  { value: 'octagon', label: 'Octogonal' },
  { value: 'bottle', label: 'Frasco/Gotas' },
];

export const PILL_COLORS: { hex: string; name: string }[] = [
  { hex: '#FFFFFF', name: 'Branco' },
  { hex: '#EF4444', name: 'Vermelho' },
  { hex: '#F97316', name: 'Laranja' },
  { hex: '#FACC15', name: 'Amarelo' },
  { hex: '#22C55E', name: 'Verde' },
  { hex: '#06B6D4', name: 'Azul Claro' },
  { hex: '#2563EB', name: 'Azul' },
  { hex: '#8B5CF6', name: 'Roxo' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#A16207', name: 'Marrom' },
  { hex: '#94A3B8', name: 'Cinza' },
  { hex: '#1E293B', name: 'Preto' },
];

export interface PillAppearancePickerProps {
  shape: PillShape;
  primaryColor: string;
  secondaryColor: string;
  onChangeShape: (shape: PillShape) => void;
  onChangePrimaryColor: (color: string) => void;
  onChangeSecondaryColor: (color: string) => void;
}

export function PillAppearancePicker({
  shape,
  primaryColor,
  secondaryColor,
  onChangeShape,
  onChangePrimaryColor,
  onChangeSecondaryColor,
}: PillAppearancePickerProps) {
  const showSecondaryColor = shape === 'capsule' || shape === 'bottle';

  return (
    <View className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
      <View className="mb-4 pb-3 border-b border-slate-200">
        <Text className="text-sm font-semibold text-slate-800">
          Aparência do Medicamento
        </Text>
        <Text className="text-xs text-slate-500">
          Selecione o formato e a cor conforme o comprimido ou frasco
        </Text>
      </View>

      <Text className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
        Formato
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {SHAPE_OPTIONS.map((item) => {
          const isSelected = shape === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => onChangeShape(item.value)}
              className={`flex-row items-center px-3 py-2 rounded-xl border ${
                isSelected
                  ? 'bg-blue-50 border-blue-600'
                  : 'bg-white border-slate-200'
              }`}
            >
              <PillIcon
                shape={item.value}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                size={24}
              />
              <Text
                className={`ml-1.5 text-xs font-medium ${
                  isSelected ? 'text-blue-700 font-bold' : 'text-slate-700'
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
        {showSecondaryColor ? 'Cor Principal (Metade 1)' : 'Cor do Comprimido'}
      </Text>
      <View className="flex-row flex-wrap gap-2.5 mb-3">
        {PILL_COLORS.map((c) => {
          const isSelected = primaryColor === c.hex;
          return (
            <TouchableOpacity
              key={`primary-${c.hex}`}
              onPress={() => onChangePrimaryColor(c.hex)}
              accessibilityLabel={`Cor principal ${c.name}`}
              className={`w-9 h-9 rounded-full items-center justify-center border-2 ${
                isSelected ? 'border-blue-600 scale-110' : 'border-slate-300'
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {isSelected && (
                <View className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {showSecondaryColor && (
        <>
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 mt-1">
            Cor Secundária (Metade 2 / Tampa)
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {PILL_COLORS.map((c) => {
              const isSelected = secondaryColor === c.hex;
              return (
                <TouchableOpacity
                  key={`secondary-${c.hex}`}
                  onPress={() => onChangeSecondaryColor(c.hex)}
                  accessibilityLabel={`Cor secundária ${c.name}`}
                  className={`w-9 h-9 rounded-full items-center justify-center border-2 ${
                    isSelected ? 'border-blue-600 scale-110' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {isSelected && (
                    <View className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
