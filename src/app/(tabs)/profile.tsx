import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Save,
  Database,
  Upload,
} from 'lucide-react-native';
import { getUserProfile, saveUserProfile } from '@/services/userService';
import {
  exportRawDatabaseFile,
  importDatabaseFile,
} from '@/services/backupService';
import { formatBirthDateMask } from '@/utils/dateUtils';
import packageJson from '../../../package.json';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [processingBackup, setProcessingBackup] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const user = await getUserProfile();
      if (user) {
        setName(user.name);
        setBirthDate(user.birthDate ?? '');
        setHealthNotes(user.healthNotes ?? '');
      }
    } catch (error) {
      console.error('[ProfileScreen] Erro ao carregar perfil:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar vazio.');
      return;
    }

    try {
      setSaving(true);
      await saveUserProfile({ name, birthDate, healthNotes });
      Alert.alert('Sucesso', 'Cadastro atualizado com sucesso.');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar os dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportDb = async () => {
    try {
      setProcessingBackup(true);
      await exportRawDatabaseFile();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Não foi possível exportar o arquivo SQLite (.db).';
      Alert.alert('Erro na Exportação', msg);
    } finally {
      setProcessingBackup(false);
    }
  };

  const handleImportDb = () => {
    Alert.alert(
      'Restaurar Backup',
      'A importação substituirá os dados atuais pelos dados e fotos do arquivo de backup (.db) selecionado. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Selecionar Arquivo',
          onPress: async () => {
            try {
              setProcessingBackup(true);
              const summary = await importDatabaseFile();
              if (summary) {
                await loadUser();
                Alert.alert(
                  'Backup Restaurado!',
                  `${summary.medicationsCount} medicamentos (com fotos) e ${summary.dosesCount} registros de doses foram restaurados com sucesso.`
                );
              }
            } catch (error) {
              const msg =
                error instanceof Error
                  ? error.message
                  : 'Falha ao importar arquivo de backup (.db).';
              Alert.alert('Erro na Restauração', msg);
            } finally {
              setProcessingBackup(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      className="flex-1 bg-slate-50 px-4 pt-4"
    >
      <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <Text className="text-base font-bold text-slate-900 mb-3">
          Dados do Usuário Local
        </Text>

        <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
          Nome *
        </Text>
        <TextInput
          testID="profile-input-name"
          value={name}
          onChangeText={setName}
          placeholder="Seu nome"
          className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-4"
        />

        <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
          Data de Nascimento
        </Text>
        <TextInput
          testID="profile-input-birth-date"
          value={birthDate}
          onChangeText={(v) => setBirthDate(formatBirthDateMask(v))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="DD/MM/AAAA"
          className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 mb-4"
        />

        <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
          Observações / Alergias
        </Text>
        <TextInput
          testID="profile-input-health-notes"
          value={healthNotes}
          onChangeText={setHealthNotes}
          placeholder="Alergias, condições de saúde..."
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 min-h-[80px] mb-4"
        />

        <TouchableOpacity
          testID="profile-btn-save"
          disabled={saving}
          onPress={handleSave}
          className="flex-row items-center justify-center bg-blue-600 py-3 rounded-xl"
        >
          <Save size={16} color="#FFFFFF" />
          <Text className="text-sm font-bold text-white ml-2">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Seção de Backup e Exportação */}
      <View className="bg-white border border-slate-200 rounded-2xl p-4">
        <Text className="text-base font-bold text-slate-900 mb-1">
          Backup e Exportação de Dados
        </Text>
        <Text className="text-xs text-slate-500 mb-3.5">
          Exporte seus medicamentos, fotos das caixas (embutidas no banco),
          ciclos e histórico de doses para guardar ou transferir de celular.
        </Text>

        <View className="gap-2.5">
          <TouchableOpacity
            testID="profile-btn-export-db"
            disabled={processingBackup}
            onPress={handleExportDb}
            className="flex-row items-center justify-center bg-slate-800 py-3 px-4 rounded-xl"
          >
            <Database size={16} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white ml-2">
              Exportar Arquivo do Banco SQLite (.DB)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="profile-btn-import-db"
            disabled={processingBackup}
            onPress={handleImportDb}
            className="flex-row items-center justify-center bg-emerald-50 border border-emerald-300 py-3 px-4 rounded-xl mt-1"
          >
            <Upload size={16} color="#047857" />
            <Text className="text-xs font-bold text-emerald-800 ml-2">
              Importar / Restaurar Backup (.DB)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-xs text-slate-400 text-center mt-6">
        v{packageJson.version}
      </Text>
    </ScrollView>
  );
}
