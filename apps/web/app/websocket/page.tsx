import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { SingleConversationDemo } from '@/components/demo/SingleConversationDemo';
import { WebSocketDemoHelperPanel } from '@/components/demo/WebSocketDemoHelperPanel';
import { WEBSOCKET_QUICK_ACTIONS } from '@/config/demo-quick-actions';
import { getDemoDefinition } from '@/config/demo-registry';

export default function WebSocketPage(): React.JSX.Element {
  const definition = getDemoDefinition('websocket');

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="websocket"
        apiBasePath="/api/demos/websocket"
        storageName="kaira-chat-demo:websocket"
        sender={{
          id: 'websocket:user',
          role: 'user',
          displayName: 'SDK Explorer',
        }}
      >
        <SingleConversationDemo
          title="WebSocket Transport Demo"
          description="A local-only showcase that bootstraps the conversation over the existing HTTP demo routes, then keeps message and typing traffic on a dedicated WebSocket bridge."
          helperPanel={<WebSocketDemoHelperPanel />}
          quickActions={WEBSOCKET_QUICK_ACTIONS}
        />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
