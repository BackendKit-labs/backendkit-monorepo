'use client';

import { useState } from 'react';
import { highlight } from '@/lib/highlight';
import { CodeWindow } from '@/components/ui/code-window';

export interface DocExample {
  label: string;
  filename: string;
  code: string;
}

interface ExamplesTabsProps {
  examples: DocExample[];
  color?: string;
}

export function ExamplesTabs({ examples, color = '#4f7eff' }: ExamplesTabsProps) {
  const [active, setActive] = useState(0);
  const ex = examples[active];

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {examples.map((e, i) => (
          <button
            key={e.label}
            onClick={() => setActive(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={
              i === active
                ? { background: `${color}20`, color }
                : { color: '#64748b' }
            }
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Code window */}
      <CodeWindow
        filename={ex.filename}
        highlightedCode={highlight(ex.code)}
        plainCode={ex.code}
      />
    </div>
  );
}
