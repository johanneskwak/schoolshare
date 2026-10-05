/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F5',   // 오프화이트 배경
        card: '#FFFFFF',
        sand: '#F0EEE6',    // 보조 면
        line: '#E8E6DC',    // 절제된 선
        ink: '#3D3929',     // 본문
        mute: '#83827D',    // 보조 텍스트
        coral: { DEFAULT: '#C96442', soft: '#F5E4DC', deep: '#AE5130' }, // 테라코타 포인트
        ok: '#4F7A5A',
        bad: '#B5483A',
      },
      fontFamily: {
        serif: ['"Noto Serif KR"', 'Georgia', 'serif'],
        sans: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
