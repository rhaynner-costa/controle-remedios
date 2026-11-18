import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Trash2, Check } from 'lucide-react-native';
import {
  MEDICATION_TYPES,
  MedicationType,
  PillShape,
} from '@/db/schema';
import {
  pickBoxPhotoFromCamera,
  pickBoxPhotoFromGallery,
} from '@/services/imageService';
import { createMedicationWithCycle } from '@/services/medicationService';
import { PillAppearancePicker } from '@/components/PillAppearancePicker';
import {
  CycleFormFields,
  CycleFormState,
} from '@/components/CycleFormFields';

const TYPE_LABELS: Record<MedicationType, string> = {
  comprimido: 'Comprimido',
  capsula: 'Cápsula',
  liquido: 'Líquido',
  gotas: 'Gotas',
  pomada: 'Pomada',
  injetavel: 'Injetável',
  spray: 'Spray',
  outro: 'Outro',
};

export default function NewMedicationScreen() {
  const router = useRouter();
  const [commercialName, setCommercialName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [concentration, setConcentration] = useState('');
  const [type, setType] = useState<MedicationType>('comprimido');
  const [boxPhotoBase64, setBoxPhotoBase64] = useState<string | null>(null);

  const [pillShape, setPillShape] = useState<PillShape>('round');
  const [pillColorPrimary, setPillColorPrimary] = useState('#2563EB');
  const [pillColorSecondary, setPillColorSecondary] = useState('#FFFFFF');

  const [cycleForm, setCycleForm] = useState<CycleFormState>({
    doseAmount: '',
    scheduledTimes: [],
    targetOccurrences: '',
  });

  const [saving, setSaving] = useState(false);

  const handleSelectType = (nextType: MedicationType) => {
    setType(nextType);
    if (nextType === 'capsula') {
      setPillShape('capsule');
    } else if (nextType === 'liquido' || nextType === 'gotas') {
      setPillShape('bottle');
    } else if (nextType === 'comprimido' && pillShape === 'bottle') {
      setPillShape('round');
    }
  };

  const handleCameraPhoto = async () => {
    try {
      const base64Uri = await pickBoxPhotoFromCamera();
      if (base64Uri) {
        setBoxPhotoBase64(base64Uri);
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Erro ao abrir câmera.';
      Alert.alert('Câmera', msg);
    }
  };

  const handleGalleryPhoto = async () => {
    try {
      const base64Uri = await pickBoxPhotoFromGallery();
      if (base64Uri) {
        setBoxPhotoBase64(base64Uri);
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Erro ao abrir galeria.';
      Alert.alert('Galeria', msg);
    }
  };

  const handleSave = async () => {
    if (
      !commercialName.trim() ||
      !activeIngredient.trim() ||
      !concentration.trim()
    ) {
      Alert.alert(
        'Campos Obrigatórios',
        'Preencha o Nome Comercial, Princípio Ativo e a Dosagem/Concentração.'
      );
      return;
    }

    if (!cycleForm.doseAmount.trim()) {
      Alert.alert(
        'Posologia',
        'Informe a quantidade a ser tomada por dose (ex: 1 comprimido).'
      );
      return;
    }

    if (cycleForm.scheduledTimes.length === 0) {
      Alert.alert(
        'Horários',
        'Adicione pelo menos 1 horário fixo para o medicamento.'
      );
      return;
    }

    const occurrencesNum = parseInt(cycleForm.targetOccurrences || '0', 10) || 0;
    if (occurrencesNum <= 0) {
      Alert.alert(
        'Ocorrências',
        'Informe um número válido de ocorrências (pelo menos 1 dose).'
      );
      return;
    }

    try {
      setSaving(true);
      await createMedicationWithCycle({
        commercialName,
        activeIngredient,
        concentration,
        type,
        boxPhotoBase64,
        pillShape,
        pillColorPrimary,
        pillColorSecondary,
        cycle: {
          doseAmount: cycleForm.doseAmount,
          recurrenceType: 'fixed_times',
          scheduledTimes: cycleForm.scheduledTimes,
          isContinuous: false,
          targetOccurrences: occurrencesNum,
        },
      });

      router.back();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Falha ao cadastrar medicamento.';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        className="px-4 pt-4"
      >
        {/* Dados do Medicamento */}
        <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <Text className="text-base font-bold text-slate-900 mb-3">
            Identificação do Medicamento
          </Text>

          <Text className="text-xs font-semibold uppercase text-slate-600 mb-1">
            Nome Comercial *
          </Text>
          <TextInput
            testID="med-new-input-commercial-name"
            value={commercialName}
            onChangeText={setCommercialName}
            placeholder="Ex: Novalgina, Tylenol, Amoxil"
            className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-3.5"
          />

          <Text className="text-xs font-semibold uppercase text-slate-600 mb-1">
            Princípio Ativo *
          </Text>
          <TextInput
            testID="med-new-input-active-ingredient"
            value={activeIngredient}
            onChangeText={setActiveIngredient}
            placeholder="Ex: Dipirona Monoidratada, Paracetamol"
            className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-3.5"
          />

          <Text className="text-xs font-semibold uppercase text-slate-600 mb-1">
            Dosagem / Concentração *
          </Text>
          <TextInput
            testID="med-new-input-concentration"
            value={concentration}
            onChangeText={setConcentration}
            placeholder="Ex: 500mg, 1g, 50mg/ml"
            className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-4"
          />

          <Text className="text-xs font-semibold uppercase text-slate-600 mb-2">
            Tipo *
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {MEDICATION_TYPES.map((t) => {
              const selected = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  testID={`med-new-type-${t}`}
                  onPress={() => handleSelectType(t)}
                  className={`px-3.5 py-2 rounded-xl border ${
                    selected
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      selected ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Biblioteca de Formatos e Cores */}
        <PillAppearancePicker
          shape={pillShape}
          primaryColor={pillColorPrimary}
          secondaryColor={pillColorSecondary}
          onChangeShape={setPillShape}
          onChangePrimaryColor={setPillColorPrimary}
          onChangeSecondaryColor={setPillColorSecondary}
        />

        {/* Foto da Caixa (Salva no SQLite em Base64 comprimido) */}
        <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <Text className="text-base font-bold text-slate-900 mb-1">
            Foto da Caixa
          </Text>
          <Text className="text-xs text-slate-500 mb-3">
            A imagem é otimizada e salva diretamente no banco de dados local.
          </Text>

          {boxPhotoBase64 ? (
            <View className="items-center">
              <Image
                source={{ uri: boxPhotoBase64 }}
                className="w-full h-44 rounded-xl border border-slate-200 mb-3"
                resizeMode="cover"
              />
              <TouchableOpacity
                testID="med-new-btn-remove-photo"
                onPress={() => setBoxPhotoBase64(null)}
                className="flex-row items-center bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl"
              >
                <Trash2 size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600 ml-1.5">
                  Remover Foto
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity
                testID="med-new-btn-camera"
                onPress={handleCameraPhoto}
                className="flex-1 flex-row items-center justify-center bg-slate-100 border border-slate-300 py-3 rounded-xl"
              >
                <Camera size={16} color="#334155" />
                <Text className="text-xs font-bold text-slate-800 ml-2">
                  Tirar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="med-new-btn-gallery"
                onPress={handleGalleryPhoto}
                className="flex-1 flex-row items-center justify-center bg-slate-100 border border-slate-300 py-3 rounded-xl"
              >
                <ImageIcon size={16} color="#334155" />
                <Text className="text-xs font-bold text-slate-800 ml-2">
                  Galeria
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Posologia / Forma de Tomar */}
        <CycleFormFields value={cycleForm} onChange={setCycleForm} />

        {/* Botão Salvar */}
        <TouchableOpacity
          testID="med-new-btn-save"
          disabled={saving}
          onPress={handleSave}
          className={`flex-row items-center justify-center py-4 rounded-2xl ${
            saving ? 'bg-blue-400' : 'bg-blue-600'
          }`}
        >
          <Check size={18} color="#FFFFFF" />
          <Text className="text-base font-bold text-white ml-2">
            {saving ? 'Salvando...' : 'Salvar Medicamento e Lembretes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
