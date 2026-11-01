import type { ReactNode } from 'react';
import { GLOSSARY, type Concept, type ConceptId } from '../lib/glossary';

/**
 * 마우스를 올리거나(hover) 키보드로 포커스하면 개념 설명을 보여 주는 툴팁.
 * 터치 기기에서는 탭(포커스)으로 열린다.
 */
export function InfoTooltip({
  concept,
  children,
  align = 'left',
  className = '',
}: {
  /** 용어집 개념 또는 직접 만든 설명 (지식인 대표작 등) */
  concept: ConceptId | Pick<Concept, 'icon' | 'title' | 'body'>;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const c = typeof concept === 'string' ? GLOSSARY[concept] : concept;
  return (
    <span tabIndex={0} className={`group relative inline-flex cursor-help items-center outline-none ${className}`}>
      <span className="border-b border-dotted border-stone-500 group-hover:border-amber-400 group-focus:border-amber-400">{children}</span>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-40 mt-2 w-72 rounded-lg border border-amber-700/70 bg-stone-900 p-3 text-left text-xs leading-relaxed text-stone-200 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        <span className="mb-1 block text-sm font-bold text-amber-300">
          {c.icon} {c.title}
        </span>
        {c.body.map((line, i) => (
          <span key={i} className="block">
            · {line}
          </span>
        ))}
      </span>
    </span>
  );
}
