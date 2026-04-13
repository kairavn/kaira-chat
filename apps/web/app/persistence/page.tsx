import { DemoPageShell } from '@/components/demo/DemoPageShell';
import { DemoRuntimeProvider } from '@/components/demo/DemoRuntimeProvider';
import { PersistenceDemo } from '@/components/demo/PersistenceDemo';
import { getDemoDefinition } from '@/config/demo-registry';

export default function PersistencePage(): React.JSX.Element {
  const definition = getDemoDefinition('persistence');

  return (
    <DemoPageShell definition={definition}>
      <DemoRuntimeProvider
        demoId="persistence"
        apiBasePath="/api/demos/persistence"
        storageName="kaira-chat-demo:persistence"
        sender={{
          id: 'persistence:user',
          role: 'user',
          displayName: 'SDK Explorer',
        }}
      >
        <PersistenceDemo />
      </DemoRuntimeProvider>
    </DemoPageShell>
  );
}
