export interface DitPublicDemoConfig {
  readonly sessionId: string;
  readonly senderId: string;
  readonly chatroomId: string;
  readonly chatbotNickname: string;
}

export interface DemoAvailability {
  readonly available: boolean;
  readonly reason?: string;
  readonly missingEnv: ReadonlyArray<string>;
}

function getEnv(name: string, value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

export function getOptionalDitPublicConfig(): DitPublicDemoConfig | null {
  const sessionId = getEnv('NEXT_PUBLIC_DEMO_SESSION_ID', process.env.NEXT_PUBLIC_DEMO_SESSION_ID);
  const senderId = getEnv('NEXT_PUBLIC_DEMO_SENDER_ID', process.env.NEXT_PUBLIC_DEMO_SENDER_ID);
  const chatroomId = getEnv(
    'NEXT_PUBLIC_DEMO_CHATROOM_ID',
    process.env.NEXT_PUBLIC_DEMO_CHATROOM_ID,
  );
  const chatbotNickname = getEnv(
    'NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME',
    process.env.NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME,
  );

  if (!sessionId || !senderId || !chatroomId || !chatbotNickname) {
    return null;
  }

  return {
    sessionId,
    senderId,
    chatroomId,
    chatbotNickname,
  };
}

export function getRequiredDitPublicConfig(): DitPublicDemoConfig {
  const config = getOptionalDitPublicConfig();
  if (!config) {
    throw new Error(
      'The DIT demo requires NEXT_PUBLIC_DEMO_SESSION_ID, NEXT_PUBLIC_DEMO_SENDER_ID, NEXT_PUBLIC_DEMO_CHATROOM_ID, and NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME.',
    );
  }

  return config;
}

export function getDitPublicDemoAvailability(): DemoAvailability {
  const missingEnv = [
    !getEnv('NEXT_PUBLIC_DEMO_SESSION_ID', process.env.NEXT_PUBLIC_DEMO_SESSION_ID)
      ? 'NEXT_PUBLIC_DEMO_SESSION_ID'
      : null,
    !getEnv('NEXT_PUBLIC_DEMO_SENDER_ID', process.env.NEXT_PUBLIC_DEMO_SENDER_ID)
      ? 'NEXT_PUBLIC_DEMO_SENDER_ID'
      : null,
    !getEnv('NEXT_PUBLIC_DEMO_CHATROOM_ID', process.env.NEXT_PUBLIC_DEMO_CHATROOM_ID)
      ? 'NEXT_PUBLIC_DEMO_CHATROOM_ID'
      : null,
    !getEnv('NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME', process.env.NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME)
      ? 'NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME'
      : null,
  ].filter((value): value is string => value !== null);

  if (missingEnv.length > 0) {
    return {
      available: false,
      reason: 'Missing required public demo environment variables.',
      missingEnv,
    };
  }

  return {
    available: true,
    missingEnv: [],
  };
}
