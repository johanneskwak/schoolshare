// 위인·후원 인물 초상 아이콘 테이블 (scripts/generate-higgsfield-icons.ts 가 같은 목록으로 이미지를 만든다)
// 이미지가 아직 없으면 FigureIcon이 이모지로 대신 보여 주므로 UI가 비지 않는다.
import type { Faction } from '../types/game';

export type FigureGroup = Faction | 'patron';

export interface FigureIcon {
  /** 영어 이름 — Higgsfield 프롬프트의 {character_name} */
  name: string;
  group: FigureGroup;
  /** public/ 기준 경로 */
  src: string;
  fallback: string;
}

const fig = (id: string, name: string, group: FigureGroup, fallback: string): [string, FigureIcon] => [
  id,
  { name, group, src: `/portraits/${id}.png`, fallback },
];

export const FIGURE_ICONS = Object.fromEntries([
  // 미국
  fig('washington', 'George Washington', 'usa', '🎖️'),
  fig('jefferson', 'Thomas Jefferson', 'usa', '📜'),
  fig('lincoln_scholar', 'Abraham Lincoln', 'usa', '🎩'),
  fig('fdr', 'Franklin D. Roosevelt', 'usa', '🏗️'),
  fig('volcker', 'Paul Volcker', 'usa', '📉'),
  fig('greenspan', 'Alan Greenspan', 'usa', '📈'),
  fig('bernanke', 'Ben Bernanke', 'usa', '🏦'),
  // 독일
  fig('goethe', 'Johann Wolfgang von Goethe', 'empire', '🎭'),
  fig('bismarck', 'Otto von Bismarck', 'empire', '🪖'),
  fig('einstein', 'Albert Einstein', 'empire', '🧑‍🔬'),
  fig('marx', 'Karl Marx', 'empire', '🚩'),
  fig('hayek', 'Friedrich Hayek', 'empire', '📕'),
  fig('kant', 'Immanuel Kant', 'empire', '🧠'),
  fig('beethoven', 'Ludwig van Beethoven', 'empire', '🎼'),
  // 영국
  fig('bill_of_rights', 'William III and Mary II signing the Bill of Rights', 'britain', '📜'),
  fig('watt', 'James Watt', 'britain', '⚙️'),
  fig('adam_smith', 'Adam Smith', 'britain', '⚖️'),
  fig('dickens', 'Charles Dickens', 'britain', '📚'),
  fig('darwin', 'Charles Darwin', 'britain', '🐢'),
  fig('keynes', 'John Maynard Keynes', 'britain', '💷'),
  fig('churchill', 'Winston Churchill', 'britain', '🎖️'),
  fig('chaplin', 'Charlie Chaplin', 'britain', '🎬'),
  fig('beatles', 'The Beatles', 'britain', '🎸'),
  // 프랑스
  fig('voltaire', 'Voltaire', 'france', '🖋️'),
  fig('rousseau', 'Jean-Jacques Rousseau', 'france', '📘'),
  fig('napoleon', 'Napoleon Bonaparte', 'france', '👑'),
  fig('hugo', 'Victor Hugo', 'france', '📖'),
  fig('pasteur', 'Louis Pasteur', 'france', '🧪'),
  fig('curie', 'Marie Curie', 'france', '☢️'),
  fig('picasso', 'Pablo Picasso', 'france', '🎨'),
  // 공통
  fig('turing', 'Alan Turing', 'usa', '💻'),
  // 외교 후원 · 혁명 인물
  fig('garibaldi', 'Giuseppe Garibaldi', 'patron', '🇮🇹'),
  fig('hidalgo', 'Miguel Hidalgo', 'patron', '⛪'),
  fig('bolivar', 'Simón Bolívar', 'patron', '⚔️'),
]) as Record<string, FigureIcon>;

export const ICON_PROMPT_TEMPLATE =
  '19th-century vintage copperplate engraving portrait icon of {character_name}, circular antique brass filigree frame, cross-hatching detail, retro civilization game asset, UI icon, dark muted background';

export function iconPrompt(name: string): string {
  return ICON_PROMPT_TEMPLATE.replace('{character_name}', name);
}
