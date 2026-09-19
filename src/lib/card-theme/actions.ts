'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserSession } from '@/lib/auth/actions';
import { canPerformAction } from '@/lib/auth/permissions';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';

export interface CardThemeItem {
  id: string;
  eventId: string;
  cardTypeId: string;
  cardTypeCode: string;
  cardTypeNameEn: string;
  cardTypeNameGu: string;
  genderRule: 'MALE' | 'FEMALE' | null;
  primaryColor: string;
  headerColor: string;
  footerColor: string;
  accentColor: string;
  textColor: string;
  logoUrl?: string | null;
  watermarkUrl?: string | null;
  templateConfig?: Record<string, any>;
  updatedAt: string;
}

/**
 * Fetches all card themes for an event, joined with card types.
 */
export async function getEventThemes(
  eventId: string = DEFAULT_EVENT_ID
): Promise<CardThemeItem[]> {
  try {
    const adminClient = createAdminClient();

    const { data: themes, error } = await adminClient
      .from('card_themes')
      .select('*, card_types(id, code, name_en, name_gu)')
      .eq('event_id', eventId)
      .order('card_type_id', { ascending: true });

    if (error || !themes) {
      console.error('getEventThemes error:', error?.message);
      return [];
    }

    return themes.map((t: any) => ({
      id: t.id,
      eventId: t.event_id,
      cardTypeId: t.card_type_id,
      cardTypeCode: t.card_types?.code || '',
      cardTypeNameEn: t.card_types?.name_en || '',
      cardTypeNameGu: t.card_types?.name_gu || '',
      genderRule: t.gender_rule,
      primaryColor: t.primary_color,
      headerColor: t.header_color,
      footerColor: t.footer_color,
      accentColor: t.accent_color,
      textColor: t.text_color,
      logoUrl: t.logo_url,
      watermarkUrl: t.watermark_url,
      templateConfig: t.template_config,
      updatedAt: t.updated_at,
    }));
  } catch (err: any) {
    console.error('getEventThemes exception:', err);
    return [];
  }
}

/**
 * Updates a card theme's colors and configuration.
 */
export async function updateCardTheme(
  themeId: string,
  updates: {
    primaryColor?: string;
    headerColor?: string;
    footerColor?: string;
    accentColor?: string;
    textColor?: string;
    logoUrl?: string | null;
    watermarkUrl?: string | null;
    templateConfig?: Record<string, any>;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !canPerformAction(session.roleCode, 'DESIGN_CARD_THEME')) {
      return {
        success: false,
        error: 'Unauthorized: Only SUPER_ADMIN or EVENT_ADMIN can customize card themes.',
      };
    }

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: now,
    };
    if (updates.primaryColor) updatePayload.primary_color = updates.primaryColor;
    if (updates.headerColor) updatePayload.header_color = updates.headerColor;
    if (updates.footerColor) updatePayload.footer_color = updates.footerColor;
    if (updates.accentColor) updatePayload.accent_color = updates.accentColor;
    if (updates.textColor) updatePayload.text_color = updates.textColor;
    if (updates.logoUrl !== undefined) updatePayload.logo_url = updates.logoUrl;
    if (updates.watermarkUrl !== undefined) updatePayload.watermark_url = updates.watermarkUrl;
    if (updates.templateConfig !== undefined) updatePayload.template_config = updates.templateConfig;

    const { error } = await adminClient
      .from('card_themes')
      .update(updatePayload)
      .eq('id', themeId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Write audit log
    await adminClient.from('audit_logs').insert({
      event_id: DEFAULT_EVENT_ID,
      user_id: session.id,
      action: 'CARD_THEME_UPDATED',
      entity_type: 'CARD_THEMES',
      entity_id: themeId,
      details: {
        updates,
        updated_by_email: session.email,
        updated_by_role: session.roleCode,
      },
    });

    return {
      success: true,
      message: 'Card theme palette saved successfully!',
    };
  } catch (err: any) {
    console.error('updateCardTheme error:', err);
    return { success: false, error: err.message };
  }
}
