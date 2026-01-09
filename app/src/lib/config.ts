import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '@/types/config';

/**
 * Get config file paths
 * - In Docker: config files are mounted at /app/
 * - In development: config files are at monorepo root (one level up from app/)
 */
function getConfigPaths() {
  const isDocker =
    process.env.NODE_ENV === 'production' || fs.existsSync('/app/config.default.json');

  if (isDocker) {
    return {
      defaultConfig: '/app/config.default.json',
      userConfig: '/app/config.json',
    };
  }

  // Development: config at monorepo root
  const monorepoRoot = path.resolve(process.cwd(), '..');
  return {
    defaultConfig: path.join(monorepoRoot, 'config.default.json'),
    userConfig: path.join(monorepoRoot, 'config.json'),
  };
}

const { userConfig: USER_CONFIG_PATH } = getConfigPaths();

/**
 * Read and merge configuration from default and user config files
 */
export function getConfig(): AppConfig {
  let config: AppConfig = {
    llm: {
      model: 'xiaomi/mimo-v2-flash:free',
      language: 'auto',
      preprompt: '',
    },
  };

  // Load user config (overrides)
  try {
    if (fs.existsSync(USER_CONFIG_PATH)) {
      const userConfig = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf-8'));
      config = deepMerge(config, userConfig);
    }
  } catch (error) {
    console.error('[Config] Failed to load user config:', error);
  }

  return config;
}

/**
 * Get a specific config value
 */
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return getConfig()[key];
}

/**
 * Update user configuration (creates config.json if doesn't exist)
 */
export function updateConfig(updates: Partial<AppConfig>): AppConfig {
  const currentConfig = getConfig();
  const newConfig = deepMerge(currentConfig, updates);

  try {
    fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Config] Failed to save user config:', error);
    throw new Error('Failed to save configuration');
  }

  return newConfig;
}

/**
 * Update a specific config section
 */
export function updateConfigSection<K extends keyof AppConfig>(
  key: K,
  value: Partial<AppConfig[K]>,
): AppConfig {
  const currentConfig = getConfig();
  const newSection = deepMerge(currentConfig[key] as Record<string, unknown>, value);

  return updateConfig({ [key]: newSection } as Partial<AppConfig>);
}

/**
 * Reset config to defaults (deletes user config file)
 */
export function resetConfig(): void {
  try {
    if (fs.existsSync(USER_CONFIG_PATH)) {
      fs.unlinkSync(USER_CONFIG_PATH);
    }
  } catch (error) {
    console.error('[Config] Failed to reset config:', error);
    throw new Error('Failed to reset configuration');
  }
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Get language instruction for system prompt
 */
export function getLanguageInstruction(): string {
  const { language } = getConfigValue('llm');

  switch (language) {
    case 'fr':
      return 'Always respond in French.';
    case 'en':
      return 'Always respond in English.';
    default:
      return 'Respond in the same language the user is using. If unsure, respond in English.';
  }
}
