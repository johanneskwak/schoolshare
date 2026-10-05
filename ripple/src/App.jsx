import { useEffect, useState } from 'react';
import { Home as HomeIcon, CalendarDays, BookOpen, Camera, Settings, NotebookPen } from 'lucide-react';
import Notes from './screens/Notes.jsx';
import Home from './screens/Home.jsx';
import Scan from './screens/Scan.jsx';
import Solve from './screens/Solve.jsx';
import Planner from './screens/Planner.jsx';
import Records from './screens/Records.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import { ErrorBox } from './components/ui.jsx';
import * as store from './lib/store.js';
import { today } from './lib/schedule.js';

const TABS = [['home', '홈', HomeIcon], ['planner', '플래너', CalendarDays], ['notes', '오답노트', NotebookPen], ['records', '기록', BookOpen]];

export default function App() {
  const [state, setState] = useState(() => store.loadState(window.localStorage));
  const [view, setView] = useState({ name: 'home' });
  const [keyOpen, setKeyOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const r = store.saveState(window.localStorage, state);
    setSaveError(r.ok ? null : r.error);
  }, [state]);

  const todayStr = today();
  const go = (name, extra = {}) => { setView({ name, ...extra }); window.scrollTo(0, 0); };
  const problem = view.name === 'solve' ? state.problems.find((p) => p.id === view.id) : null;

  const handleSave = (input) => {
    try {
      const { state: next, problem: p } = store.addProblem(state, input);
      setState(next);
      go('solve', { id: p.id });
    } catch (e) { setSaveError(e.message); }
  };
  const handleRegister = (problemId) => {
    const { state: next, added } = store.registerReviews(state, problemId, todayStr);
    setState(next);
    return added > 0;
  };

  const showFab = ['home', 'planner', 'records', 'notes'].includes(view.name);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-32 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <span className="font-serif text-lg tracking-tight text-coral">리플</span>
        <button onClick={() => setKeyOpen(true)} aria-label="API 키 설정" className="rounded-full p-2 text-mute hover:bg-sand"><Settings size={18} /></button>
      </header>

      {saveError && (
        <div className="mb-4">
          <ErrorBox title="저장하지 못했어요">
            {saveError === 'QUOTA' ? '브라우저 저장 공간이 가득 찼어요. 오래된 문제를 삭제해 주세요.' : String(saveError)}
          </ErrorBox>
        </div>
      )}

      <main>
        {view.name === 'home' && <Home state={state} todayStr={todayStr} onToggle={(id) => setState(store.toggleReview(state, id))} onOpen={(id) => go('solve', { id })} onScan={() => go('scan')} />}
        {view.name === 'scan' && <Scan apiKey={state.settings.apiKey} onSave={handleSave} onOpenKey={() => setKeyOpen(true)} />}
        {view.name === 'planner' && <Planner state={state} todayStr={todayStr} onToggle={(id) => setState(store.toggleReview(state, id))} onOpen={(id) => go('solve', { id })} />}
        {view.name === 'records' && <Records state={state} onOpen={(id) => go('solve', { id })} onDelete={(id) => setState(store.deleteProblem(state, id))} />}
        {view.name === 'notes' && <Notes notes={state.notes} onMemo={(id, m) => setState(store.updateNoteMemo(state, id, m))} onRemove={(id) => setState(store.removeNote(state, id))} />}
        {view.name === 'solve' && (problem ? (
          <Solve problem={problem} attempts={state.attempts} notes={state.notes}
            onToggleNote={(snap) => setState(store.toggleNote(state, snap))} hasReviews={state.reviews.some((r) => r.problemId === problem.id)}
            onAttempt={(pid, itemId, userAnswer, correct) => setState(store.recordAttempt(state, { problemId: pid, itemId, userAnswer, correct }))}
            onRegister={handleRegister} onBack={() => go('home')} />
        ) : <ErrorBox title="문제를 찾을 수 없어요" actions={<button className="btn-ghost" onClick={() => go('home')}>홈으로</button>}>삭제되었거나 잘못된 주소예요.</ErrorBox>)}
      </main>

      {showFab && (
        <button onClick={() => go('scan')} aria-label="문제 스캔" className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-coral text-white shadow-lg hover:bg-coral-deep">
          <Camera size={22} />
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {TABS.map(([name, label, Icon]) => (
            <li key={name} className="flex-1">
              <button onClick={() => go(name)} aria-current={view.name === name ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-3 text-xs ${view.name === name ? 'text-coral' : 'text-mute'}`}>
                <Icon size={20} /> {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {keyOpen && <ApiKeyModal initialKey={state.settings.apiKey} onClose={() => setKeyOpen(false)}
        onSave={(k) => { setState(store.setApiKey(state, k)); setKeyOpen(false); }} />}
    </div>
  );
}
