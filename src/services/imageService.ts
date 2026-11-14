import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Redimensiona e comprime a imagem para armazenamento seguro no SQLite
 * sem estourar o limite de CursorWindow (~2MB) do Android.
 */
async function compressToBase64DataUri(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.65,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!manipulated.base64) {
    throw new Error('Não foi possível converter a imagem para Base64.');
  }

  return `data:image/jpeg;base64,${manipulated.base64}`;
}

export async function pickBoxPhotoFromCamera(): Promise<string | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permissão de acesso à câmera negada.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    return await compressToBase64DataUri(result.assets[0].uri);
  } catch (error) {
    console.error('[ImageService] Erro ao capturar foto da câmera:', error);
    throw error;
  }
}

export async function pickBoxPhotoFromGallery(): Promise<string | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permissão de acesso à galeria negada.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    return await compressToBase64DataUri(result.assets[0].uri);
  } catch (error) {
    console.error('[ImageService] Erro ao selecionar foto da galeria:', error);
    throw error;
  }
}
