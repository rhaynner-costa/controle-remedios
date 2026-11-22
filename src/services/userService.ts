import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { userProfile, UserProfile } from '@/db/schema';
import { parseBrDateToIso } from '@/utils/dateUtils';

export interface SaveUserInput {
  name: string;
  birthDate?: string;
  healthNotes?: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const rows = await db.select().from(userProfile).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('[UserService] Erro ao buscar perfil do usuário:', error);
    throw error;
  }
}

export async function saveUserProfile(input: SaveUserInput): Promise<UserProfile> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('O nome do usuário é obrigatório.');
  }

  const trimmedBirthDate = input.birthDate?.trim() || '';
  if (trimmedBirthDate && !parseBrDateToIso(trimmedBirthDate)) {
    throw new Error(
      'Informe uma data de nascimento válida no formato DD/MM/AAAA.'
    );
  }

  try {
    const now = new Date().toISOString();
    const existing = await getUserProfile();

    if (existing) {
      await db
        .update(userProfile)
        .set({
          name: trimmedName,
          birthDate: input.birthDate?.trim() || null,
          healthNotes: input.healthNotes?.trim() || null,
          updatedAt: now,
        })
        .where(eq(userProfile.id, existing.id));

      const updated = await getUserProfile();
      if (!updated) {
        throw new Error('Falha ao recuperar perfil atualizado.');
      }
      return updated;
    }

    const result = await db
      .insert(userProfile)
      .values({
        name: trimmedName,
        birthDate: input.birthDate?.trim() || null,
        healthNotes: input.healthNotes?.trim() || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('[UserService] Erro ao salvar perfil do usuário:', error);
    throw error;
  }
}
