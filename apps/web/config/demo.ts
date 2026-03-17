/**
 * Fail-fast helper — throws at module load time if a required var is absent.
 * Each process.env reference is written statically so Next.js inlines the
 * value into the client bundle at build time.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

/**
 * Centralised demo configuration sourced entirely from NEXT_PUBLIC_ env vars.
 * Available on both server and client; see apps/web/.env.example for required values.
 */
export const demoConfig = {
  sessionId: requireEnv('NEXT_PUBLIC_DEMO_SESSION_ID', process.env.NEXT_PUBLIC_DEMO_SESSION_ID),
  senderId: requireEnv('NEXT_PUBLIC_DEMO_SENDER_ID', process.env.NEXT_PUBLIC_DEMO_SENDER_ID),
  chatroomId: requireEnv('NEXT_PUBLIC_DEMO_CHATROOM_ID', process.env.NEXT_PUBLIC_DEMO_CHATROOM_ID),
  chatbotNickname: requireEnv(
    'NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME',
    process.env.NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME,
  ),
} as const;
