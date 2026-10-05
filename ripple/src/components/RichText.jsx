import Math from './Math.jsx';

// "문장 $수식$ 문장" 형식. 텍스트는 React가 이스케이프하고 수식만 KaTeX가 그린다.
export default function RichText({ text }) {
  const parts = String(text ?? '').split(/\$([^$]+)\$/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <Math key={i} latex={p} /> : <span key={i}>{p}</span>))}
    </>
  );
}
