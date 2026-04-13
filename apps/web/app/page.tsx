import Link from 'next/link';

import { DEMO_DEFINITIONS } from '@/config/demo-registry';
import { getChatDemoAvailability } from '@/lib/chat/server-config';

function isDemoAvailable(demoId: string): boolean {
  if (demoId !== 'dit-modive') {
    return true;
  }

  return getChatDemoAvailability().available;
}

export default function Home(): React.JSX.Element {
  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: '32px 20px 48px',
        background:
          'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 1220,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ color: '#93c5fd', fontSize: 13, letterSpacing: 1.6 }}>
            INTERNAL SHOWCASE
          </span>
          <h1 style={{ fontSize: 44, lineHeight: 1.05, color: '#f8fafc', maxWidth: 760 }}>
            Kaira SDK demos, split by transport, runtime, and feature focus.
          </h1>
          <p style={{ color: '#cbd5e1', maxWidth: 760, fontSize: 16 }}>
            The original DIT flow now lives beside local Next.js demos that exercise streaming,
            renderer coverage, deterministic quick actions, and IndexedDB persistence.
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {DEMO_DEFINITIONS.map((demo) => {
            const available = isDemoAvailable(demo.id);

            return (
              <article
                key={demo.id}
                style={{
                  borderRadius: 20,
                  border: '1px solid #1e293b',
                  background: 'rgba(2, 6, 23, 0.8)',
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <h2 style={{ fontSize: 22, color: '#f8fafc' }}>{demo.title}</h2>
                  <span
                    style={{
                      borderRadius: 999,
                      background: available ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                      color: available ? '#86efac' : '#fca5a5',
                      padding: '5px 9px',
                      fontSize: 11,
                      alignSelf: 'flex-start',
                    }}
                  >
                    {available ? 'Available' : 'Config needed'}
                  </span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: 14 }}>{demo.description}</p>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>{demo.summary}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {demo.badges.map((badge) => (
                    <span
                      key={badge}
                      style={{
                        borderRadius: 999,
                        border: '1px solid #334155',
                        background: 'rgba(15, 23, 42, 0.8)',
                        padding: '5px 8px',
                        color: '#bfdbfe',
                        fontSize: 12,
                      }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <Link
                  href={demo.route}
                  style={{
                    marginTop: 'auto',
                    color: '#dbeafe',
                    fontSize: 14,
                  }}
                >
                  Open demo
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
