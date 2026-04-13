import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { SingleConversationDemo } from '@/components/demo/SingleConversationDemo';
import { getDemoDefinition } from '@/config/demo-registry';
import { getRequiredDitPublicConfig } from '@/config/dit-demo';
import { getChatDemoAvailability } from '@/lib/chat/server-config';

export default function DitModivePage(): React.JSX.Element {
  const definition = getDemoDefinition('dit-modive');
  const availability = getChatDemoAvailability();

  if (!availability.available) {
    return (
      <DemoPageShell definition={definition}>
        <section
          style={{
            borderRadius: 18,
            border: '1px solid #7f1d1d',
            background: '#450a0a',
            color: '#fecaca',
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>DIT demo unavailable</h2>
          <p style={{ marginBottom: 10 }}>
            This route stays discoverable even when DIT credentials are missing.
          </p>
          <p>Missing env: {availability.missingEnv.join(', ')}</p>
        </section>
      </DemoPageShell>
    );
  }

  const config = getRequiredDitPublicConfig();

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="dit-modive"
        apiBasePath="/api/demos/dit-modive"
        storageName="kaira-chat-demo:dit-modive"
        sender={{
          id: config.senderId,
          role: 'user',
          displayName: 'Dev Together',
        }}
      >
        <SingleConversationDemo
          title="DIT Provider Demo"
          description="The original DIT-backed flow routed through Next.js. Send real messages through the server-owned DIT transport without exposing credentials to the browser."
          historyWindow={{
            initialVisibleCount: 8,
            incrementCount: 8,
          }}
          helperPanel={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 16 }}>What this demo covers</h2>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  color: '#cbd5e1',
                  paddingLeft: 18,
                }}
              >
                <li>Browser SDK runtime over local Next.js routes</li>
                <li>DIT transport kept server-side</li>
                <li>Dedicated demo room pinned by NEXT_PUBLIC_DEMO_CHATROOM_ID</li>
                <li>IndexedDB-backed client persistence</li>
                <li>Optimistic user messages and typing events</li>
                <li>Older DIT history loads as you scroll upward in the message list</li>
              </ul>
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid #334155',
                  background: 'rgba(15, 23, 42, 0.72)',
                  padding: '12px 14px',
                  color: '#cbd5e1',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Deterministic demo room</div>
                <p style={{ color: '#94a3b8', marginBottom: 8 }}>
                  This route is only demo-safe when <code>NEXT_PUBLIC_DEMO_CHATROOM_ID</code> points
                  to a dedicated pre-seeded DIT room. If that config is missing, the route stays
                  unavailable instead of falling back to a random room.
                </p>
                <div>
                  Room id: <code>{config.chatroomId}</code>
                </div>
                <div>
                  Config source: <code>NEXT_PUBLIC_DEMO_CHATROOM_ID</code>
                </div>
              </div>
            </div>
          }
        />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
