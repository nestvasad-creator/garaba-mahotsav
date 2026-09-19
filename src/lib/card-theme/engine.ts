import { CardThemeRecord } from '@/types';

export interface ResolvedCardTheme {
  primaryColor: string;
  headerColor: string;
  footerColor: string;
  accentColor: string;
  textColor: string;
  logoUrl?: string | null;
  watermarkUrl?: string | null;
  templateConfig?: Record<string, any>;
}

export const defaultSystemTheme: ResolvedCardTheme = {
  primaryColor: '#900B09',
  headerColor: '#700908',
  footerColor: '#700908',
  accentColor: '#F59E0B',
  textColor: '#FFFFFF',
};

/**
 * Resolves the final card theme using the priority:
 * 1. Gender-specific theme match for this card type
 * 2. Default theme match for this card type (gender_rule IS NULL)
 * 3. System fallback theme
 */
export function resolveCardTheme(
  cardTypeId: string,
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null,
  themes: CardThemeRecord[] = []
): ResolvedCardTheme {
  if (!cardTypeId || !themes.length) {
    return defaultSystemTheme;
  }

  // 1. Check gender-specific rule
  if (gender && (gender === 'MALE' || gender === 'FEMALE')) {
    const genderTheme = themes.find(
      (t) => t.card_type_id === cardTypeId && t.gender_rule === gender
    );
    if (genderTheme) {
      return {
        primaryColor: genderTheme.primary_color,
        headerColor: genderTheme.header_color,
        footerColor: genderTheme.footer_color,
        accentColor: genderTheme.accent_color,
        textColor: genderTheme.text_color,
        logoUrl: genderTheme.logo_url,
        watermarkUrl: genderTheme.watermark_url,
        templateConfig: genderTheme.template_config,
      };
    }
  }

  // 2. Fall back to generic card type theme (gender_rule IS NULL)
  const defaultCardTypeTheme = themes.find(
    (t) => t.card_type_id === cardTypeId && !t.gender_rule
  );

  if (defaultCardTypeTheme) {
    return {
      primaryColor: defaultCardTypeTheme.primary_color,
      headerColor: defaultCardTypeTheme.header_color,
      footerColor: defaultCardTypeTheme.footer_color,
      accentColor: defaultCardTypeTheme.accent_color,
      textColor: defaultCardTypeTheme.text_color,
      logoUrl: defaultCardTypeTheme.logo_url,
      watermarkUrl: defaultCardTypeTheme.watermark_url,
      templateConfig: defaultCardTypeTheme.template_config,
    };
  }

  return defaultSystemTheme;
}
