import { demoConfig } from '@/config/demo';

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

/**
 * Resolves the full demo config: server-only API secrets merged with the
 * shared NEXT_PUBLIC_ demo identifiers from demoConfig.
 */
export function getChatDemoConfig(): ChatDemoConfig {
  return {
    apiUrl: requireServerEnv('API_URL'),
    apiKey: requireServerEnv('X_API_KEY'),
    apiId: requireServerEnv('X_API_ID'),
    sessionId: demoConfig.sessionId,
    senderId: demoConfig.senderId,
    chatbotNickname: demoConfig.chatbotNickname,
    chatroomId: demoConfig.chatroomId,
    appContext: {
      username: 'Dev Together',
      gender: 'male',
      dob: '2000-01-01',
    },
  };
}
