import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
  // 개발 전용 데모 화면 (동적 import라 프로덕션 번들에는 포함되지 않음)
  void import('./dev/DemoScreen').then(({ DemoScreen }) =>
    root.render(
      <StrictMode>
        <DemoScreen />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
