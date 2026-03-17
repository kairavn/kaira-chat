import { Chat } from '@/components/chat/Chat';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 20,
        background: '#020617',
      }}
    >
      <Chat />
    </main>
  );
}
