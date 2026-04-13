import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { SingleConversationDemo } from '@/components/demo/SingleConversationDemo';
import { MEDIA_QUICK_ACTIONS } from '@/config/demo-quick-actions';
import { getDemoDefinition } from '@/config/demo-registry';

export default function MediaPage(): React.JSX.Element {
  const definition = getDemoDefinition('media');

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="media"
        apiBasePath="/api/demos/media"
        storageName="kaira-chat-demo:media"
        sender={{
          id: 'media:user',
          role: 'user',
          displayName: 'SDK Explorer',
        }}
      >
        <SingleConversationDemo
          title="Renderer Demo"
          description="A seeded conversation plus exact quick actions for validating each built-in renderer and the fallback path for unsupported custom content."
          quickActions={MEDIA_QUICK_ACTIONS}
          helperPanel={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 16 }}>What to inspect</h2>
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
                  Image, audio, video, file, and location cards use the default renderer registry.
                </li>
                <li>
                  The quick actions now request an exact assistant response type instead of relying
                  on read-only seeded content.
                </li>
                <li>
                  The seeded conversation still gives you baseline coverage before you trigger
                  targeted action buttons.
                </li>
              </ul>
            </div>
          }
        />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
