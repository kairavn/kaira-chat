import type { DemoDefinition } from '@/config/demo-registry';
import type { JSX, ReactNode } from 'react';

import Link from 'next/link';

interface DemoPageShellProps {
  readonly definition: DemoDefinition;
  readonly children: ReactNode;
}

export function DemoPageShell({ definition, children }: DemoPageShellProps): JSX.Element {
  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: '28px 20px 48px',
        background:
          'radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 1220,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/"
            style={{
              color: '#93c5fd',
              fontSize: 14,
            }}
          >
            Back to demos
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, color: '#f8fafc' }}>{definition.title}</h1>
            <p style={{ color: '#cbd5e1', fontSize: 16, maxWidth: 860 }}>{definition.summary}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {definition.badges.map((badge) => (
                <span
                  key={badge}
                  style={{
                    borderRadius: 999,
                    border: '1px solid #334155',
                    background: 'rgba(15, 23, 42, 0.75)',
                    padding: '6px 10px',
                    color: '#bfdbfe',
                    fontSize: 12,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
