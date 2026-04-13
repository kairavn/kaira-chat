import type { DemoAvailability } from '@/config/dit-demo';

import { getOptionalDitPublicConfig } from '@/config/dit-demo';

export interface ChatDemoConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly apiId: string;
  readonly sessionId: string;
  readonly senderId: string;
  readonly chatbotNickname: string;
  readonly chatroomId: string;
  readonly appContext: {
    readonly username: string;
    readonly gender: string;
    readonly dob: string;
  };
}

function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function getOptionalServerEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Resolves the full demo config: server-only API secrets merged with the
 * shared NEXT_PUBLIC_ demo identifiers from the DIT demo config.
 */
export function getChatDemoConfig(): ChatDemoConfig {
  const publicConfig = getOptionalDitPublicConfig();
  if (!publicConfig) {
    throw new Error(
      'The DIT demo requires NEXT_PUBLIC_DEMO_SESSION_ID, NEXT_PUBLIC_DEMO_SENDER_ID, NEXT_PUBLIC_DEMO_CHATROOM_ID, and NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME.',
    );
  }

  return {
    apiUrl: requireServerEnv('API_URL'),
    apiKey: requireServerEnv('X_API_KEY'),
    apiId: requireServerEnv('X_API_ID'),
    sessionId: publicConfig.sessionId,
    senderId: publicConfig.senderId,
    chatbotNickname: publicConfig.chatbotNickname,
    chatroomId: publicConfig.chatroomId,
    appContext: {
      username: 'Dev Together',
      gender: 'male',
      dob: '2000-01-01',
    },
  };
}

export function getChatDemoAvailability(): DemoAvailability {
  const missingEnv = [
    !getOptionalServerEnv('API_URL') ? 'API_URL' : null,
    !getOptionalServerEnv('X_API_KEY') ? 'X_API_KEY' : null,
    !getOptionalServerEnv('X_API_ID') ? 'X_API_ID' : null,
    ...(!getOptionalDitPublicConfig()
      ? [
          'NEXT_PUBLIC_DEMO_SESSION_ID',
          'NEXT_PUBLIC_DEMO_SENDER_ID',
          'NEXT_PUBLIC_DEMO_CHATROOM_ID',
          'NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME',
        ]
      : []),
  ].filter((value): value is string => value !== null);

  if (missingEnv.length > 0) {
    return {
      available: false,
      reason: 'Missing required DIT demo environment variables.',
      missingEnv,
    };
  }

  return {
    available: true,
    missingEnv: [],
  };
}
