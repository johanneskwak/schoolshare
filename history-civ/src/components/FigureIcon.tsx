import { useState } from 'react';
import { FIGURE_ICONS } from '../constants/figureIcons';

/** 위인 초상: public/portraits/{id}.png, 없으면 이모지 */
export function FigureIcon({ id, fallback, className = 'h-full w-full' }: { id: string; fallback?: string; className?: string }) {
  const icon = FIGURE_ICONS[id];
  const [broken, setBroken] = useState(false);
  if (!icon || broken) return <span aria-hidden>{fallback ?? icon?.fallback ?? '👤'}</span>;
  return <img src={icon.src} alt={icon.name} className={`${className} rounded-full object-cover`} onError={() => setBroken(true)} />;
}
