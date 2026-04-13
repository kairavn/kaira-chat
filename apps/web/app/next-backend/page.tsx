import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { SingleConversationDemo } from '@/components/demo/SingleConversationDemo';
import { NEXT_BACKEND_QUICK_ACTIONS } from '@/config/demo-quick-actions';
import { getDemoDefinition } from '@/config/demo-registry';

export default function NextBackendPage(): React.JSX.Element {
  const definition = getDemoDefinition('next-backend');

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="next-backend"
        apiBasePath="/api/demos/next-backend"
        storageName="kaira-chat-demo:next-backend"
        sender={{
          id: 'next-backend:user',
          role: 'user',
          displayName: 'SDK Explorer',
        }}
        enableStreamingBridge
      >
        <SingleConversationDemo
          title="Next Backend Chat Demo"
          description="A local server-owned ChatEngine implemented with Next route handlers. The assistant types, streams a reply, and persists history through the SDK runtime."
          quickActions={NEXT_BACKEND_QUICK_ACTIONS}
          helperPanel={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 16 }}>Checks</h2>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  color: '#cbd5e1',
                  paddingLeft: 18,
                }}
              >
                <li>
                  Use the quick actions to force stable streamed replies from the local backend.
                </li>
                <li>
                  Open devtools to inspect stream lifecycle events alongside the final AI message.
                </li>
                <li>
                  Reload the route to confirm the local browser storage adapter restores prior
                  messages.
                </li>
              </ul>
            </div>
          }
        />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
