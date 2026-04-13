import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { SingleConversationDemo } from '@/components/demo/SingleConversationDemo';
import { STREAMING_QUICK_ACTIONS } from '@/config/demo-quick-actions';
import { getDemoDefinition } from '@/config/demo-registry';

export default function StreamingPage(): React.JSX.Element {
  const definition = getDemoDefinition('streaming');

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="streaming"
        apiBasePath="/api/demos/streaming"
        storageName="kaira-chat-demo:streaming"
        sender={{
          id: 'streaming:user',
          role: 'user',
          displayName: 'SDK Explorer',
        }}
        enableStreamingBridge
      >
        <SingleConversationDemo
          title="Streaming Demo"
          description="This route is tuned for stream lifecycle inspection. Use the quick actions to trigger a normal stream, a longer stream, or a mid-stream failure."
          quickActions={STREAMING_QUICK_ACTIONS}
          helperPanel={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 16 }}>Suggested actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {STREAMING_QUICK_ACTIONS.map((action) => (
                  <div
                    key={action.id}
                    style={{
                      borderRadius: 12,
                      border: '1px solid #334155',
                      background: 'rgba(15, 23, 42, 0.72)',
                      padding: '12px 14px',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: 4 }}>{action.label}</strong>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>{action.description}</span>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
