-- =====================================================================
-- 1750년 연대기 · 난이도/무제한 턴 · 위인(연도 등장)+퀴즈 · 도시 건물 · 경제 위기 상태
-- · 도시 공성전(도시 HP) · 테크트리 연장(AI 혁명 = 과학 승리)
--   연도: 1750 + 5 × (턴 − 1)  → 60턴 = 2045년
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) 컬럼 · 연도 함수
-- ---------------------------------------------------------------------
alter table public.hc_rooms add column if not exists difficulty text not null default 'normal'
  check (difficulty in ('easy', 'normal', 'hard'));
alter table public.hc_rooms drop constraint if exists hc_rooms_turn_seconds_check;
alter table public.hc_rooms add constraint hc_rooms_turn_seconds_check
  check (turn_seconds = 0 or turn_seconds between 20 and 300);           -- 0 = 시간 무제한
alter table public.hc_room_players add column if not exists gold_rate int not null default 0;
alter table public.hc_room_players add column if not exists hammer_rate int not null default 0;
alter table public.hc_room_players add column if not exists food_rate int not null default 0;
alter table public.hc_tiles add column if not exists city_hp int not null default 100;

create or replace function public.hc__year(p_turn int)
returns int language sql immutable as $$ select 1750 + 5 * (greatest(p_turn, 1) - 1) $$;

-- ---------------------------------------------------------------------
-- 1) 테크트리 연장: 2차(내연기관) → 3차(컴퓨터·인터넷) → 4차(AI 혁명)
-- ---------------------------------------------------------------------
insert into public.hc_techs (id, name_ko, cost, prereq, branch) values
  ('internal_combustion', '내연기관',  80, 'electrification', 'science'),
  ('computing',           '컴퓨터',   150, 'electrification', 'science'),
  ('internet',            '인터넷',   220, 'computing',       'science'),
  ('ai_revolution',       'AI 혁명',  320, 'internet',        'science')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) 위인 (연도 도달 시 자동 등장) — 기존 지식인 테이블을 확장
-- ---------------------------------------------------------------------
alter table public.hc_scholar_defs drop constraint if exists hc_scholar_defs_faction_ord_key;
alter table public.hc_scholar_defs alter column faction drop not null;
alter table public.hc_scholar_defs add column if not exists category text;
alter table public.hc_scholar_defs add column if not exists year int;
alter table public.hc_scholar_defs add column if not exists factions text[];      -- null = 모든 문명
alter table public.hc_scholar_defs add column if not exists immediate jsonb not null default '{}';
alter table public.hc_scholar_defs add column if not exists passive jsonb not null default '{}';
alter table public.hc_scholar_defs add column if not exists unlock_building text;
alter table public.hc_scholar_defs add column if not exists quiz jsonb;

alter table public.hc_player_scholars add column if not exists quiz_result text check (quiz_result in ('correct', 'wrong'));
alter table public.hc_player_scholars drop constraint if exists hc_player_scholars_pkey;
alter table public.hc_player_scholars add primary key (room_id, scholar_id, player_id);   -- 공통 위인은 문명마다 등장

insert into public.hc_scholar_defs
  (id, faction, ord, name, era, icon, works, significance, effect, category, year, factions, immediate, passive, unlock_building, quiz)
values
  ('watt', 'britain', 10, '제임스 와트', '스코틀랜드의 발명가', '⚙️', '증기기관 개량 (1769)',
   '와트가 효율을 크게 높인 증기기관은 공장과 광산, 기차를 움직여 1차 산업혁명을 일으켰습니다.',
   '망치 +20 즉시, 망치 +2/턴, 와트 인물 카드, 도서관 해금', 'scientist', 1765, '{britain}',
   '{"hammer": 20, "leader": "watt"}', '{"hammer": 2}', 'library',
   '{"q": "제임스 와트가 개량해 산업혁명을 이끈 기계는?", "choices": ["증기기관", "방적기", "전신기"], "answer": 0}'),
  ('jefferson', 'usa', 11, '토머스 제퍼슨', '미국 독립 선언서 기초자', '📜', '《독립 선언서》 (1776)',
   '"모든 사람은 평등하게 태어났다"는 천부 인권 사상을 담아 미국 독립 혁명의 이념을 세웠습니다.',
   '개척자 비용 15, 혁명 이념 +2/턴', 'thinker', 1776, '{usa}',
   '{"ideology": 10}', '{"ideology": 2}', null,
   '{"q": "토머스 제퍼슨이 기초한 문서는?", "choices": ["마그나 카르타", "독립 선언서", "권리 장전"], "answer": 1}'),
  ('adam_smith', 'britain', 12, '애덤 스미스', '고전 경제학자', '⚖️', '《국부론》 (1776)',
   '분업과 자유로운 시장 경쟁이 나라를 부유하게 한다고 설명해 자본주의 경제학의 기초를 세웠습니다.',
   '골드 수입 +25%, 중앙은행 해금', 'economist', 1776, '{britain}',
   '{"gold": 20}', '{"gold_pct": 25}', 'central_bank',
   '{"q": "애덤 스미스가 《국부론》에서 강조한 것은?", "choices": ["왕의 절대 권력", "분업과 자유 시장", "농업 중심 경제"], "answer": 1}'),
  ('voltaire', 'france', 13, '볼테르', '18세기 계몽사상가', '🖋️', '《철학 서한》 (1734) · 《관용론》 (1763)',
   '이성과 종교적 관용, 표현의 자유를 주장하며 절대 왕정과 교회의 권위를 비판했습니다. 계몽사상은 프랑스 혁명의 사상적 바탕이 되었어요.',
   '혁명 이념 +2/턴, 반란 페널티 무효', 'thinker', 1780, '{france}',
   '{"ideology": 5}', '{"ideology": 2}', null,
   '{"q": "볼테르가 《관용론》에서 주장한 것은?", "choices": ["종교적 관용", "절대 왕정", "중상주의"], "answer": 0}'),
  ('kant', 'empire', 14, '임마누엘 칸트', '독일 계몽 철학자', '🧠', '《계몽이란 무엇인가》 (1784)',
   '"감히 알려고 하라!" — 스스로 생각하는 용기를 강조하며 계몽의 뜻을 정리했습니다.',
   '혁신 +3/턴', 'thinker', 1784, '{empire}',
   '{}', '{"research": 3}', null,
   '{"q": "칸트가 말한 계몽의 표어는?", "choices": ["만국의 노동자여 단결하라", "감히 알려고 하라", "짐이 곧 국가다"], "answer": 1}'),
  ('rousseau', 'france', 15, '장 자크 루소', '18세기 계몽사상가', '📘', '《사회계약론》 (1762) · 《에밀》 (1762)',
   '"국가의 주인은 국민"이라는 국민 주권론을 펼쳐 프랑스 혁명과 인권선언에 큰 영향을 주었습니다.',
   '연구 +10%, 혁명 이념 +2/턴, 반란 페널티 무효', 'thinker', 1785, '{france}',
   '{"ideology": 5}', '{"research_pct": 10, "ideology": 2}', null,
   '{"q": "루소가 《사회계약론》에서 주장한 것은?", "choices": ["국민 주권", "왕권신수설", "보호 무역"], "answer": 0}'),
  ('goethe', 'empire', 16, '요한 볼프강 폰 괴테', '독일의 문호', '🎭', '《파우스트》 (1808·1832)',
   '인간의 끝없는 탐구와 성장을 그린 《파우스트》로 독일 문학과 낭만주의에 큰 영향을 주었습니다.',
   '혁명 이념(문화) +3/턴, 연구 +15%', 'artist', 1795, '{empire}',
   '{}', '{"ideology": 3, "research_pct": 15}', null,
   '{"q": "괴테의 대표작은?", "choices": ["파우스트", "레 미제라블", "햄릿"], "answer": 0}'),
  ('napoleon', 'france', 17, '나폴레옹 보나파르트', '프랑스의 황제', '👑', '브뤼메르 쿠데타 (1799) · 나폴레옹 법전 (1804)',
   '혁명 이후 권력을 잡아 황제가 되었고, 나폴레옹 법전으로 혁명의 이념(법 앞의 평등)을 유럽에 퍼뜨렸습니다.',
   '나폴레옹 영웅 유닛 등장, 지상군 이동 +1·공격 +2 (인물 카드)', 'statesman', 1799, '{france}',
   '{"leader": "napoleon", "spawn": {"kind": "hero_napoleon", "count": 1}}', '{}', null,
   '{"q": "나폴레옹이 만든 법전의 의의는?", "choices": ["신분제 강화", "법 앞의 평등을 제도화", "노예제 합법화"], "answer": 1}'),
  ('beethoven', 'empire', 18, '루트비히 판 베토벤', '독일의 작곡가', '🎼', '교향곡 5번 《운명》 · 9번 《합창》',
   '청력을 잃어 가면서도 인류애와 자유를 노래한 교향곡을 남겨 고전주의와 낭만주의를 잇는 다리가 되었습니다.',
   '안정도가 10 아래로 떨어지지 않음, 안정도 +1/턴, 콘서트홀 해금', 'artist', 1805, '{empire}',
   '{"stability": 5}', '{"stability": 1, "stability_floor": 10}', 'concert_hall',
   '{"q": "베토벤 교향곡 9번의 별명은?", "choices": ["운명", "합창", "전원"], "answer": 1}'),
  ('hugo', 'france', 19, '빅토르 위고', '프랑스의 작가', '📖', '《레 미제라블》 (1862)',
   '가난한 사람들과 혁명의 시대를 그려 사회 정의와 인간의 존엄을 호소했습니다.',
   '안정도 +2/턴, 반란 평화적 진압, 국립극장 해금', 'artist', 1830, '{france}',
   '{}', '{"stability": 2}', 'national_theatre',
   '{"q": "빅토르 위고의 대표작은?", "choices": ["레 미제라블", "올리버 트위스트", "파우스트"], "answer": 0}'),
  ('dickens', 'britain', 20, '찰스 디킨스', '산업혁명기 소설가', '📚', '《올리버 트위스트》 (1838) · 《어려운 시절》 (1854)',
   '산업혁명 시기 공장 노동자와 아동, 빈민의 비참한 삶을 그려 공장법 등 사회 개혁 여론을 이끌었습니다.',
   '안정도 +2/턴, 콜레라 피해 절반', 'artist', 1840, '{britain}',
   '{"stability": 10}', '{"stability": 2}', null,
   '{"q": "디킨스 소설이 비판한 사회 문제는?", "choices": ["산업혁명기 빈민·아동 노동", "중세 봉건제", "우주 개발"], "answer": 0}'),
  ('marx', 'empire', 21, '카를 마르크스', '사회주의 사상가', '🚩', '《공산당 선언》 (1848) · 《자본론》 (1867)',
   '산업혁명 이후 자본가와 노동자의 불평등을 비판하고 사회주의 운동에 큰 영향을 주었습니다.',
   '혁명 이념 +3/턴', 'thinker', 1848, '{empire}',
   '{"ideology": 5}', '{"ideology": 3}', null,
   '{"q": "마르크스가 비판한 것은?", "choices": ["자본가와 노동자의 불평등", "계몽사상", "민주주의"], "answer": 0}'),
  ('darwin', 'britain', 22, '찰스 다윈', '영국의 박물학자', '🐢', '《종의 기원》 (1859)',
   '자연 선택에 의한 진화론을 발표해 생물학과 사람들의 세계관을 크게 바꾸었습니다.',
   '혁신(연구) +100 즉시, 자연사박물관 해금', 'scientist', 1859, '{britain}',
   '{"research": 100}', '{}', 'natural_history_museum',
   '{"q": "다윈의 《종의 기원》이 설명한 것은?", "choices": ["만유인력", "자연 선택에 의한 진화", "지동설"], "answer": 1}'),
  ('lincoln_scholar', 'usa', 23, '에이브러햄 링컨', '미국 16대 대통령', '🎩', '《게티스버그 연설》 (1863) · 노예 해방 선언 (1863)',
   '남북 전쟁 중 노예 해방을 선언하고 "국민의, 국민에 의한, 국민을 위한 정부"를 말해 민주주의 발전의 상징이 되었습니다.',
   '생산 +20%, 모든 아군 방어 +2, 링컨 인물 카드', 'statesman', 1861, '{usa}',
   '{"leader": "lincoln"}', '{"hammer_pct": 20}', null,
   '{"q": "링컨이 게티스버그 연설에서 말한 정부는?", "choices": ["국민의, 국민에 의한, 국민을 위한 정부", "왕의 정부", "귀족의 정부"], "answer": 0}'),
  ('pasteur', 'france', 24, '루이 파스퇴르', '프랑스의 미생물학자', '🧪', '저온 살균법 · 광견병 백신 (1885)',
   '미생물이 병을 일으킨다는 것을 밝히고 백신을 개발해 근대 의학과 공중 보건을 발전시켰습니다.',
   '콜레라 면역, 식량 +30%, 의학연구소 해금', 'scientist', 1865, '{france}',
   '{}', '{"food_pct": 30}', 'medical_institute',
   '{"q": "파스퇴르의 업적이 아닌 것은?", "choices": ["저온 살균법", "광견병 백신", "증기기관"], "answer": 2}'),
  ('bismarck', 'empire', 25, '오토 폰 비스마르크', '독일 제국의 재상', '🪖', '철혈 정책 · 독일 통일 (1871) · 사회 보험',
   '"철과 피"로 독일을 통일하고, 세계 최초로 노동자 사회 보험 제도를 만들었습니다.',
   '비스마르크 인물 카드(골드 +3·군사 생산 -25%), 골드 +2/턴', 'statesman', 1871, '{empire}',
   '{"leader": "bismarck"}', '{"gold": 2}', null,
   '{"q": "비스마르크가 이끈 사건은?", "choices": ["독일 통일", "프랑스 혁명", "미국 독립"], "answer": 0}'),
  ('curie', 'france', 26, '마리 퀴리', '방사능 연구자', '☢️', '방사능 연구 · 노벨상 2회 (1903·1911)',
   '라듐과 폴로늄을 발견하고 방사능을 연구해 여성 최초로 노벨상을, 그것도 두 번 받았습니다.',
   '연구 +40%, 라듐연구소 해금', 'scientist', 1903, '{france}',
   '{"research": 30}', '{"research_pct": 40}', 'radium_institute',
   '{"q": "마리 퀴리가 발견한 원소는?", "choices": ["라듐", "산소", "우라늄"], "answer": 0}'),
  ('einstein', null, 27, '알베르트 아인슈타인', '이론 물리학자', '🧑‍🔬', '상대성 이론 (1905·1915)',
   '시간과 공간에 대한 생각을 바꾼 상대성 이론을 세웠고, 나치를 피해 미국으로 건너갔습니다.',
   '연구 +20%, 맨해튼 프로젝트 비용 50%, 고등학술원 해금', 'scientist', 1930, '{empire,usa}',
   '{"research": 40}', '{"research_pct": 20}', 'institute_advanced_study',
   '{"q": "아인슈타인의 대표 이론은?", "choices": ["진화론", "상대성 이론", "지동설"], "answer": 1}'),
  ('fdr', 'usa', 28, '프랭클린 D. 루스벨트', '미국 32대 대통령', '🏗️', '뉴딜 정책 (1933)',
   '대공황 때 정부가 공공사업과 사회 보장 제도로 경제를 살리는 뉴딜 정책을 펼쳤습니다.',
   '대공황 무효, 망치 +3/턴', 'statesman', 1933, '{usa}',
   '{}', '{"hammer": 3}', null,
   '{"q": "루스벨트가 대공황 극복을 위해 펼친 정책은?", "choices": ["뉴딜 정책", "철혈 정책", "쇄국 정책"], "answer": 0}'),
  ('keynes', 'britain', 29, '존 메이너드 케인스', '영국의 경제학자', '💷', '《고용, 이자 및 화폐의 일반이론》 (1936)',
   '불황 때는 정부가 돈을 써서 수요를 만들어야 한다고 주장해 현대 경제 정책의 틀을 만들었습니다.',
   '대공황 무효, 골드 +3/턴', 'economist', 1936, '{britain}',
   '{}', '{"gold": 3}', null,
   '{"q": "케인스가 불황 극복법으로 주장한 것은?", "choices": ["정부의 적극적 지출", "금 본위제 강화", "무역 금지"], "answer": 0}'),
  ('chaplin', null, 30, '찰리 채플린', '희극 배우·영화감독', '🎬', '《모던 타임스》 (1936)',
   '기계에 끌려다니는 노동자를 풍자해 대공황기 산업 사회를 비판하고 웃음으로 위로했습니다.',
   '대공황 피해 절반, 안정도 +1/턴, 영화관 해금', 'artist', 1936, '{britain,usa}',
   '{}', '{"stability": 1}', 'cinema',
   '{"q": "채플린의 《모던 타임스》가 풍자한 것은?", "choices": ["기계화된 산업 사회", "중세 기사", "우주 여행"], "answer": 0}'),
  ('picasso', 'france', 31, '파블로 피카소', '입체파 화가', '🎨', '《게르니카》 (1937)',
   '전쟁의 참혹함을 고발한 《게르니카》로 예술이 평화를 외칠 수 있음을 보여 주었습니다.',
   '혁명 이념 +3/턴, 안정도 +2/턴', 'artist', 1937, '{france}',
   '{}', '{"ideology": 3, "stability": 2}', null,
   '{"q": "피카소의 《게르니카》가 고발한 것은?", "choices": ["전쟁의 참혹함", "산업혁명", "왕정"], "answer": 0}'),
  ('churchill', 'britain', 32, '윈스턴 처칠', '영국 총리', '🎖️', '결사항전 연설 (1940)',
   '"우리는 결코 항복하지 않을 것입니다" — 제2차 세계 대전에서 영국을 이끌었습니다.',
   '아군 방어 +3, 도시 공성 저항 1.5배', 'statesman', 1940, '{britain}',
   '{"stability": 10}', '{}', null,
   '{"q": "처칠이 영국을 이끈 전쟁은?", "choices": ["제2차 세계 대전", "백년 전쟁", "남북 전쟁"], "answer": 0}'),
  ('hayek', null, 33, '프리드리히 하이에크', '오스트리아 출신 경제학자', '📕', '《노예의 길》 (1944)',
   '국가가 경제를 지나치게 계획하면 자유가 위협받는다고 경고했습니다.',
   '골드 +3/턴(유지비 절감), 민간투자사 해금', 'economist', 1944, '{empire,britain}',
   '{}', '{"gold": 3}', 'private_investment',
   '{"q": "하이에크가 《노예의 길》에서 경고한 것은?", "choices": ["지나친 국가 계획 경제", "자유 무역", "산업혁명"], "answer": 0}'),
  ('turing', null, 34, '앨런 튜링 · 폰 노이만', '컴퓨터 과학의 아버지들', '💻', '튜링 기계 (1936) · 폰 노이만 구조 (1945)',
   '계산하는 기계의 원리와 오늘날 컴퓨터의 구조를 설계해 정보 시대를 열었습니다.',
   '연구 +20%, 데이터연구소 해금', 'scientist', 1950, null,
   '{"research": 30}', '{"research_pct": 20}', 'data_lab',
   '{"q": "튜링과 폰 노이만이 기초를 놓은 것은?", "choices": ["컴퓨터", "증기기관", "전화기"], "answer": 0}'),
  ('beatles', 'britain', 35, '비틀즈', '영국의 록 밴드', '🎸', '브리티시 인베이전 (1964)',
   '영국 대중음악이 미국과 세계를 휩쓸며 문화가 국경을 넘어 퍼지는 모습을 보여 주었습니다.',
   '다른 문명에서 골드 2씩 흡수(문화 수출), 대형스타디움 해금', 'artist', 1964, '{britain}',
   '{}', '{"gold_drain": 2}', 'stadium',
   '{"q": "비틀즈가 미국에서 일으킨 문화 현상은?", "choices": ["브리티시 인베이전", "골드러시", "뉴딜"], "answer": 0}'),
  ('volcker', 'usa', 36, '폴 볼커', '미국 연방준비제도 의장', '📉', '인플레이션 파이터 (1979)',
   '금리를 크게 올려 오일쇼크 이후의 극심한 물가 상승을 잡았습니다.',
   '오일쇼크 무효, 연방준비은행 해금', 'economist', 1979, '{usa}',
   '{}', '{}', 'federal_reserve',
   '{"q": "볼커가 싸운 경제 문제는?", "choices": ["인플레이션(물가 상승)", "흑사병", "금 부족"], "answer": 0}'),
  ('greenspan', 'usa', 37, '앨런 그린스펀', '미국 연방준비제도 의장', '📈', '"마에스트로" (1987~2006)',
   '오랫동안 미국 경제를 안정적으로 이끌어 "마에스트로"라 불렸습니다.',
   '골드 +40%, 증권거래소 해금', 'economist', 1990, '{usa}',
   '{}', '{"gold_pct": 40}', 'stock_exchange',
   '{"q": "그린스펀의 별명은?", "choices": ["마에스트로", "철의 여인", "철혈 재상"], "answer": 0}'),
  ('bernanke', 'usa', 38, '벤 버냉키', '미국 연방준비제도 의장', '🏦', '양적 완화 (2008)',
   '서브프라임 사태 때 중앙은행이 돈을 풀어 금융 위기가 대공황으로 번지는 것을 막았습니다.',
   '서브프라임 무효, 긴급 구제금융 골드 +300', 'economist', 2008, '{usa}',
   '{"gold": 300}', '{}', null,
   '{"q": "버냉키가 금융 위기 때 쓴 정책은?", "choices": ["양적 완화", "쇄국", "금주법"], "answer": 0}')
on conflict (id) do update set
  faction = excluded.faction, ord = excluded.ord, name = excluded.name, era = excluded.era, icon = excluded.icon,
  works = excluded.works, significance = excluded.significance, effect = excluded.effect, category = excluded.category,
  year = excluded.year, factions = excluded.factions, immediate = excluded.immediate, passive = excluded.passive,
  unlock_building = excluded.unlock_building, quiz = excluded.quiz;

-- 도서관으로 합류하던 기존 지식인은 혁신 +3/턴 유지
update public.hc_scholar_defs set passive = '{"research": 3}' where year is null and passive = '{}';

create or replace function public.hc__has_person(p_room uuid, p_player uuid, p_person text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hc_player_scholars where room_id = p_room and player_id = p_player and scholar_id = p_person);
$$;

-- ---------------------------------------------------------------------
-- 3) 도시 건물 (시설 칸과 별개 — 도서관이 공장·항구와 겹쳐 못 짓던 문제 해결)
-- ---------------------------------------------------------------------
create table if not exists public.hc_building_defs (
  id              text primary key,
  name_ko         text not null,
  icon            text not null,
  gold_cost       int  not null,
  requires_tech   text references public.hc_techs(id),
  requires_person text references public.hc_scholar_defs(id),
  passive         jsonb not null default '{}',
  description     text not null,
  sort            int  not null
);
insert into public.hc_building_defs values
  ('library',                  '도서관',       '📚', 35, 'enlightenment', 'watt',        '{"research": 3}',                    '혁신 +3/턴 (계몽사상 또는 제임스 와트)', 1),
  ('central_bank',             '중앙은행',     '🏦', 50, null, 'adam_smith',             '{"gold_pct": 15}',                   '골드 +15%', 2),
  ('concert_hall',             '콘서트홀',     '🎼', 40, null, 'beethoven',              '{"stability": 2, "ideology": 1}',    '안정도 +2, 이념 +1', 3),
  ('national_theatre',         '국립극장',     '🎭', 40, null, 'hugo',                   '{"stability": 2, "ideology": 2}',    '안정도 +2, 이념 +2', 4),
  ('natural_history_museum',   '자연사박물관', '🦕', 50, null, 'darwin',                 '{"research": 4}',                    '혁신 +4/턴', 5),
  ('medical_institute',        '의학연구소',   '⚕️', 50, null, 'pasteur',                '{"food": 3}',                        '식량 +3/턴', 6),
  ('radium_institute',         '라듐연구소',   '☢️', 60, null, 'curie',                  '{"research": 5}',                    '혁신 +5/턴', 7),
  ('institute_advanced_study', '고등학술원',   '🎓', 60, null, 'einstein',               '{"research": 6}',                    '혁신 +6/턴', 8),
  ('cinema',                   '영화관',       '🎬', 40, null, 'chaplin',                '{"stability": 3}',                   '안정도 +3', 9),
  ('private_investment',       '민간투자사',   '💼', 50, null, 'hayek',                  '{"gold": 5}',                        '골드 +5/턴', 10),
  ('data_lab',                 '데이터연구소', '💾', 70, null, 'turing',                 '{"research": 8}',                    '혁신 +8/턴', 11),
  ('stadium',                  '대형스타디움', '🏟️', 60, null, 'beatles',                '{"gold": 4, "stability": 2}',        '골드 +4, 안정도 +2', 12),
  ('federal_reserve',          '연방준비은행', '🏛️', 70, null, 'volcker',                '{"gold_pct": 15}',                   '골드 +15%', 13),
  ('stock_exchange',           '증권거래소',   '📈', 70, null, 'greenspan',              '{"gold": 8}',                        '골드 +8/턴', 14)
on conflict (id) do nothing;

create table if not exists public.hc_city_buildings (
  room_id     uuid not null references public.hc_rooms(id) on delete cascade,
  x           int  not null,
  y           int  not null,
  building_id text not null references public.hc_building_defs(id),
  built_turn  int  not null,
  primary key (room_id, x, y, building_id)
);
alter table public.hc_building_defs  enable row level security;
alter table public.hc_city_buildings enable row level security;
create policy "rules readable" on public.hc_building_defs  for select to authenticated using (true);
create policy "members read"   on public.hc_city_buildings for select to authenticated using (public.hc_is_room_member(room_id));

-- 기존 '도서관 시설'을 건물로 옮긴다
insert into public.hc_city_buildings (room_id, x, y, building_id, built_turn)
select room_id, x, y, 'library', 0 from public.hc_tiles where improvement = 'library'
on conflict do nothing;
update public.hc_tiles set improvement = null where improvement = 'library';

create or replace function public.hc_build_building(p_room uuid, p_x int, p_y int, p_building text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl hc_room_players; b hc_building_defs; t hc_tiles; ev jsonb;
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  select * into pl from hc_room_players where room_id = p_room and user_id = auth.uid();
  if not found or pl.is_eliminated then raise exception 'NOT_MEMBER'; end if;
  if pl.has_ended_turn then raise exception 'TURN_ALREADY_ENDED'; end if;
  select * into b from hc_building_defs where id = p_building;
  if not found then raise exception 'NO_BUILDING'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  if not found or not t.is_city or t.owner_id <> pl.user_id then raise exception 'NOT_YOUR_CITY'; end if;
  -- 해금 조건: 기술 또는 위인 중 하나 (둘 다 없으면 누구나)
  if not ((b.requires_tech is null and b.requires_person is null)
          or (b.requires_tech is not null and b.requires_tech = any (pl.researched))
          or (b.requires_person is not null and hc__has_person(p_room, pl.user_id, b.requires_person))) then
    raise exception 'BUILDING_LOCKED';
  end if;
  if exists (select 1 from hc_city_buildings where room_id = p_room and x = p_x and y = p_y and building_id = p_building) then
    raise exception 'ALREADY_BUILT';
  end if;
  if pl.gold < b.gold_cost then raise exception 'NOT_ENOUGH_GOLD'; end if;

  update hc_room_players set gold = gold - b.gold_cost where room_id = p_room and user_id = pl.user_id;
  insert into hc_city_buildings values (p_room, p_x, p_y, p_building, r.turn_number);
  ev := jsonb_build_array(jsonb_build_object('type', 'building_built', 'player', pl.user_id, 'building', p_building,
                                             'x', p_x, 'y', p_y, 'city', t.city_name));
  perform hc__bump(p_room);
  return ev;
end $$;

-- ---------------------------------------------------------------------
-- 4) 경제 위기 · 사기 등 일시 상태 (사건 선택지로 부여, 위인이 무효화)
-- ---------------------------------------------------------------------
create table if not exists public.hc_player_conditions (
  room_id    uuid not null references public.hc_rooms(id) on delete cascade,
  player_id  uuid not null references public.hc_profiles(id),
  cond_id    text not null check (cond_id in ('depression', 'oil_shock', 'cholera', 'subprime', 'unrest', 'morale')),
  until_turn int  not null,
  primary key (room_id, player_id, cond_id)
);
alter table public.hc_player_conditions enable row level security;
create policy "members read" on public.hc_player_conditions for select to authenticated using (public.hc_is_room_member(room_id));

create or replace function public.hc__has_condition(p_room uuid, p_player uuid, p_cond text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hc_player_conditions c join hc_rooms r on r.id = c.room_id
                  where c.room_id = p_room and c.player_id = p_player and c.cond_id = p_cond and c.until_turn >= r.turn_number);
$$;

-- 효과 적용: 기존 키 + condition({id, turns})
create or replace function public.hc__apply_effects(p_room uuid, p_player uuid, p_eff jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap record; n int; i int; v_kind text; sx int; sy int; v_turn int; out jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;
  update hc_room_players set
    gold              = greatest(0, gold + coalesce((p_eff->>'gold')::int, 0)),
    hammer            = greatest(0, hammer + coalesce((p_eff->>'hammer')::int, 0)),
    ideology          = greatest(0, ideology + coalesce((p_eff->>'ideology')::int, 0)),
    stability         = least(100, greatest(0, stability + coalesce((p_eff->>'stability')::int, 0))),
    research_progress = research_progress + coalesce((p_eff->>'research')::int, 0)
   where room_id = p_room and user_id = p_player;

  if p_eff ? 'condition' then
    insert into hc_player_conditions (room_id, player_id, cond_id, until_turn)
    values (p_room, p_player, p_eff->'condition'->>'id', v_turn + coalesce((p_eff->'condition'->>'turns')::int, 3))
    on conflict (room_id, player_id, cond_id) do update set until_turn = excluded.until_turn;
    out := out || jsonb_build_object('type', 'condition_started', 'player', p_player, 'condition', p_eff->'condition'->>'id');
  end if;

  if p_eff ? 'spawn' then
    v_kind := p_eff->'spawn'->>'kind';
    n := coalesce((p_eff->'spawn'->>'count')::int, 1);
    select x, y into cap from hc_tiles
     where room_id = p_room and owner_id = p_player and is_city order by is_capital desc limit 1;
    if found then
      for i in 1..n loop
        select g.x, g.y into sx, sy from hc_tiles g
         where g.room_id = p_room and greatest(abs(g.x - cap.x), abs(g.y - cap.y)) <= 2
           and g.terrain not in ('water', 'mountain')
           and not exists (select 1 from hc_units o where o.room_id = p_room and o.x = g.x and o.y = g.y)
         order by greatest(abs(g.x - cap.x), abs(g.y - cap.y)), random() limit 1;
        exit when not found;
        perform hc__spawn(p_room, p_player, v_kind, sx, sy, v_turn);
        out := out || jsonb_build_object('type', 'unit_produced', 'player', p_player, 'kind', v_kind, 'x', sx, 'y', sy);
      end loop;
    end if;
  end if;

  if p_eff ? 'leader' and hc__grant_leader(p_room, p_player, p_eff->>'leader') then
    out := out || jsonb_build_object('type', 'leader_joined', 'player', p_player, 'leader', p_eff->>'leader');
  end if;
  return out;
end $$;

-- 전투 보너스: 공격(나폴레옹 +2, 사기 +1) · 방어(링컨 +2, 처칠 +3)
create or replace function public.hc__attack_bonus(p_room uuid, p_player uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when hc__has_leader(p_room, p_player, 'napoleon') then 2 else 0 end
       + case when hc__has_condition(p_room, p_player, 'morale') then 1 else 0 end;
$$;
create or replace function public.hc__defense_bonus(p_room uuid, p_player uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when hc__has_person(p_room, p_player, 'lincoln_scholar') then 2 else 0 end
       + case when hc__has_person(p_room, p_player, 'churchill') then 3 else 0 end;
$$;

-- 생산 비용: 미국 개척자 20 (제퍼슨 15) · 링컨(카드) 시민군 50% · 비스마르크 군사 -25%
create or replace function public.hc__unit_cost(p_room uuid, p_player uuid, p_kind text, p_base int)
returns int language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'settler' and exists (select 1 from hc_room_players where room_id = p_room and user_id = p_player and faction = 'usa')
         then case when hc__has_person(p_room, p_player, 'jefferson') then 15 else 20 end
    when p_kind = 'militia' and hc__has_leader(p_room, p_player, 'lincoln') then p_base / 2
    when hc__has_leader(p_room, p_player, 'bismarck')
         and exists (select 1 from hc_unit_types where kind = p_kind and attack > 0) then (p_base * 3) / 4
    else p_base
  end;
$$;

-- ---------------------------------------------------------------------
-- 5) 연대기 사건 체인 (연도 순서대로, 한 턴에 하나)
-- ---------------------------------------------------------------------
alter table public.hc_event_defs add column if not exists year int;
alter table public.hc_event_defs add column if not exists factions text[];

update public.hc_event_defs set year = 1776, sort = 20 where id = 'independence';
update public.hc_event_defs set year = 1789, sort = 30,
  choice_a_label = '혁명 지지', choice_a_desc = '시민 편에 선다 · 혁명 이념 +20, 군사 사기(공격 +1) 5턴, 안정도 -2',
  choice_a = '{"ideology": 20, "stability": -2, "condition": {"id": "morale", "turns": 5}}',
  choice_b_label = '왕정 수호', choice_b_desc = '국왕을 지킨다 · 골드 +50, 반란 봉기(안정도 -3·망치 -2/턴) 3턴',
  choice_b = '{"gold": 50, "condition": {"id": "unrest", "turns": 3}}'
 where id = 'french_revolution';
update public.hc_event_defs set year = 1811, sort = 40 where id = 'luddite';
update public.hc_event_defs set year = 1851, sort = 60 where id = 'great_exhibition';

insert into public.hc_event_defs
  (id, title, era, icon, body, choice_a_label, choice_a_desc, choice_a, choice_b_label, choice_b_desc, choice_b, sort, year, factions)
values
  ('industrial_revolution', '1차 산업혁명', '1760년대', '🏭',
   '영국에서 방적기와 증기기관이 등장해 공장에서 물건을 대량으로 만들기 시작했습니다. 농촌 사람들이 도시로 몰려듭니다.',
   '공장제 도입', '기계와 공장을 들인다 · 망치 +25, 안정도 -5', '{"hammer": 25, "stability": -5}',
   '가내 수공업 보호', '전통 방식을 지킨다 · 안정도 +5, 골드 +10', '{"stability": 5, "gold": 10}', 10, 1760, null),
  ('cholera', '콜레라 유행', '1832년', '🦠',
   '도시로 사람이 몰리며 오염된 물을 통해 콜레라가 퍼지고 있습니다. 산업화의 그늘입니다.',
   '상하수도 정비', '공중 보건에 투자한다 · 골드 -30', '{"gold": -30}',
   '방치', '비용을 아낀다 · 콜레라(식량 -50%) 4턴', '{"condition": {"id": "cholera", "turns": 4}}', 50, 1832, null),
  ('civil_war', '미국 남북전쟁', '1861년', '⚔️',
   '노예제를 둘러싸고 북부와 남부가 갈라져 전쟁이 일어났습니다.',
   '연방 수호', '북부 연방을 지킨다 · 전열보병 2부대, 안정도 -5', '{"spawn": {"kind": "line_infantry", "count": 2}, "stability": -5}',
   '타협', '전쟁을 피한다 · 골드 -30, 혁명 이념 -5', '{"gold": -30, "ideology": -5}', 70, 1861, '{usa}'),
  ('second_industrial', '2차 산업혁명', '1870년대', '⚡',
   '전기와 석유, 화학 공업이 발달하며 거대한 공장과 대기업이 나타났습니다.',
   '중화학공업 육성', '철강·화학 공업 · 망치 +30, 연구 +20', '{"hammer": 30, "research": 20}',
   '전력망 투자', '전기를 보급한다 · 연구 +40, 골드 -20', '{"research": 40, "gold": -20}', 80, 1870, null),
  ('great_depression', '세계 대공황', '1929년', '📉',
   '미국 증권 시장이 무너지며 공장이 문을 닫고 실업자가 넘쳐 납니다. 불황이 전 세계로 번집니다.',
   '뉴딜·케인스 정책', '정부가 돈을 풀어 일자리를 만든다 · 골드 -40', '{"gold": -40}',
   '시장 방임', '시장에 맡긴다 · 골드 보존, 대공황(생산 -50%) 3턴', '{"condition": {"id": "depression", "turns": 3}}', 90, 1929, null),
  ('space_race', '우주 경쟁 · 아폴로 11호', '1969년', '🚀',
   '인류가 처음으로 달에 발을 디뎠습니다. 과학 기술 경쟁이 우주로 넓어졌습니다.',
   '우주 계획 투자', '달 탐사에 도전한다 · 골드 -50, 연구 +60', '{"gold": -50, "research": 60}',
   '국내 산업 투자', '땅 위의 경제에 집중한다 · 망치 +30', '{"hammer": 30}', 100, 1969, null),
  ('oil_shock', '오일쇼크', '1973년', '🛢️',
   '중동 전쟁으로 석유 값이 몇 배로 뛰어 물가가 치솟고 경제가 흔들립니다.',
   '비축유 방출', '비상 석유를 푼다 · 골드 -40', '{"gold": -40}',
   '긴축', '버틴다 · 오일쇼크(골드 -30%) 3턴', '{"condition": {"id": "oil_shock", "turns": 3}}', 110, 1973, null),
  ('subprime', '서브프라임 모기지 사태', '2008년', '🏚️',
   '갚을 능력이 없는 사람에게 빌려준 주택 대출이 부실해지며 세계 금융 위기가 일어났습니다.',
   '긴급 구제금융', '은행을 살린다 · 골드 -60', '{"gold": -60}',
   '시장 정리', '부실을 정리한다 · 금융 위기(골드 -50%) 3턴', '{"condition": {"id": "subprime", "turns": 3}}', 120, 2008, null),
  ('ai_era', '4차 산업혁명 · AI 시대', '2016년', '🤖',
   '인공지능이 바둑 세계 챔피언을 이기고, 로봇과 데이터가 산업을 바꾸고 있습니다.',
   'AI 연구 투자', '미래 기술에 투자한다 · 연구 +80, 안정도 -5', '{"research": 80, "stability": -5}',
   '일자리 보호', '사람의 일자리를 지킨다 · 안정도 +10, 골드 +20', '{"stability": 10, "gold": 20}', 130, 2016, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6) 도시 공성전
-- ---------------------------------------------------------------------
create or replace function public.hc__siege(p_room uuid, p_unit uuid, p_x int, p_y int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; s hc_unit_types; t hc_tiles; cdef int; dmg_city int; dmg_att int; v_hp int;
begin
  select * into u from hc_units where id = p_unit;
  select * into s from hc_unit_types where kind = u.kind;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  cdef := 4 + t.city_pop + case when t.is_capital then 3 else 0 end + hc__defense_bonus(p_room, t.owner_id);
  dmg_city := greatest(8, 25 + 4 * (s.attack + hc__attack_bonus(p_room, u.owner_id)
                                    + case when s.kind = 'artillery' then 3 else 0 end - cdef)) * (50 + u.hp / 2) / 100;
  if hc__has_person(p_room, t.owner_id, 'churchill') then dmg_city := dmg_city * 2 / 3; end if;  -- 결사항전: 저항 1.5배
  dmg_att := case when s.range > 1 then 0 else greatest(5, 10 + 3 * cdef - 2 * s.attack) * 8 / 10 end;
  update hc_tiles set city_hp = greatest(0, city_hp - dmg_city)
   where room_id = p_room and x = p_x and y = p_y returning city_hp into v_hp;
  update hc_units set hp = greatest(0, hp - dmg_att), moves_left = 0, acted = true, fortified = false
   where id = u.id returning * into u;
  if u.hp = 0 then delete from hc_units where id = u.id; end if;
  return jsonb_build_object('type', 'siege', 'attacker', u.id, 'x', p_x, 'y', p_y, 'dmg_city', dmg_city,
                            'dmg_att', dmg_att, 'city_hp', v_hp, 'attacker_hp', u.hp, 'owner', t.owner_id);
end $$;

-- 점령: 도시 HP 50으로 복구 + 불가사의 즉시 인계(카운트다운 리셋)
create or replace function public.hc__capture_city(p_room uuid, p_x int, p_y int, p_new_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old uuid; v_cap boolean; v_turn int;
begin
  select turn_number into v_turn from hc_rooms where id = p_room;
  select owner_id, is_capital into v_old, v_cap from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  update hc_tiles set owner_id = p_new_owner, is_capital = false, city_hp = 50
   where room_id = p_room and x = p_x and y = p_y;
  update hc_tiles set owner_id = p_new_owner
   where room_id = p_room and owner_id = v_old and not is_city
     and greatest(abs(x - p_x), abs(y - p_y)) <= 1;
  update hc_wonders set player_id = p_new_owner, built_turn = v_turn
   where room_id = p_room and x = p_x and y = p_y;
  if v_cap then
    update hc_room_players set is_eliminated = true, has_ended_turn = true
     where room_id = p_room and user_id = v_old;
    update hc_tiles set owner_id = p_new_owner, is_capital = false
     where room_id = p_room and owner_id = v_old;
    update hc_wonders set player_id = p_new_owner, built_turn = v_turn
     where room_id = p_room and player_id = v_old;
    delete from hc_units where room_id = p_room and owner_id = v_old;
  end if;
  return jsonb_build_object('type', case when v_cap then 'capital_captured' else 'city_captured' end,
                            'x', p_x, 'y', p_y, 'from', v_old, 'to', p_new_owner);
end $$;

create or replace function public.hc_unit_move(p_room uuid, p_unit uuid, p_x int, p_y int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; s hc_unit_types; t hc_tiles; r hc_rooms; dist int; ev jsonb := '[]';
begin
  u := hc__act_guard(p_room, p_unit);
  select * into r from hc_rooms where id = p_room;
  select * into s from hc_unit_types where kind = u.kind;
  if p_x < 0 or p_y < 0 or p_x >= r.map_width or p_y >= r.map_height then raise exception 'INVALID_TARGET'; end if;
  dist := greatest(abs(p_x - u.x), abs(p_y - u.y));
  if dist = 0 or dist > u.moves_left then raise exception 'OUT_OF_RANGE'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  if t.terrain = 'mountain' or (t.terrain = 'water' and not s.naval)
     or (t.terrain <> 'water' and s.naval and not (t.is_city and t.owner_id = u.owner_id)) then
    raise exception 'IMPASSABLE';
  end if;
  if exists (select 1 from hc_units where room_id = p_room and x = p_x and y = p_y) then raise exception 'TILE_OCCUPIED'; end if;
  if t.is_city and t.owner_id is distinct from u.owner_id then
    if s.attack = 0 or s.range > 1 then raise exception 'CANNOT_ENTER_CITY'; end if;
    if t.city_hp > 0 then raise exception 'CITY_WALLS'; end if;           -- 먼저 공성으로 HP를 0으로
  end if;

  update hc_units set x = p_x, y = p_y, moves_left = moves_left - dist, fortified = false where id = u.id;
  ev := ev || jsonb_build_object('type', 'move', 'unit', u.id, 'from', jsonb_build_array(u.x, u.y), 'to', jsonb_build_array(p_x, p_y));
  if t.is_city and t.owner_id is distinct from u.owner_id then
    ev := ev || hc__capture_city(p_room, p_x, p_y, u.owner_id);
    perform hc__check_instant_conquest(p_room);
  end if;
  perform hc__bump(p_room);
  return jsonb_build_object('events', ev, 'moves_left', u.moves_left - dist);
end $$;

create or replace function public.hc_unit_attack(p_room uuid, p_unit uuid, p_x int, p_y int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u hc_units; d hc_units; s hc_unit_types; ds hc_unit_types; t hc_tiles;
  dist int; def_bonus int; dmg_def int; dmg_att int; moved_in boolean := false; ev jsonb := '[]';
  ux int; uy int; res jsonb;
begin
  u := hc__act_guard(p_room, p_unit);
  ux := u.x; uy := u.y;
  select * into s from hc_unit_types where kind = u.kind;
  if s.attack = 0 then raise exception 'CANNOT_ATTACK'; end if;
  dist := greatest(abs(p_x - u.x), abs(p_y - u.y));
  if not (dist <= u.moves_left or (s.range > 1 and dist <= s.range)) then raise exception 'OUT_OF_RANGE'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  select * into d from hc_units where room_id = p_room and x = p_x and y = p_y for update;

  if not found then
    -- 빈 적 도시 → 공성 (도시 HP를 깎는다)
    if t.is_city and t.owner_id is not null and t.owner_id <> u.owner_id and t.city_hp > 0 then
      res := hc__siege(p_room, u.id, p_x, p_y);
      perform hc__bump(p_room);
      return jsonb_build_object('siege', true, 'attacker_id', u.id, 'defender_id', null,
        'from', jsonb_build_array(ux, uy), 'at', jsonb_build_array(p_x, p_y),
        'dmg_att', res->'dmg_att', 'dmg_def', res->'dmg_city', 'attacker_hp', res->'attacker_hp',
        'defender_hp', res->'city_hp', 'city_hp', res->'city_hp', 'moved_in', false, 'events', jsonb_build_array(res));
    end if;
    raise exception 'NO_ENEMY';
  end if;
  if d.owner_id = u.owner_id then raise exception 'NO_ENEMY'; end if;

  select * into ds from hc_unit_types where kind = d.kind;
  def_bonus := case when t.terrain in ('hills', 'forest') then 2 else 0 end
             + case when t.is_city then 3 else 0 end
             + case when d.fortified then 2 else 0 end
             + hc__defense_bonus(p_room, d.owner_id);
  dmg_def := greatest(10, 30 + 4 * (s.attack + hc__attack_bonus(p_room, u.owner_id) + hc__matchup(s.kind, ds.kind)
                                    - ds.defense - def_bonus)) * (50 + u.hp / 2) / 100;
  dmg_att := case when s.range > 1 then 0
                  else greatest(5, 20 + 4 * (ds.defense + def_bonus - s.attack)) * (50 + d.hp / 2) / 100 end;

  update hc_units set hp = greatest(0, hp - dmg_def) where id = d.id returning * into d;
  update hc_units set hp = greatest(0, hp - dmg_att), moves_left = 0, acted = true, fortified = false
   where id = u.id returning * into u;
  ev := ev || jsonb_build_object('type', 'combat', 'attacker', u.id, 'defender', d.id,
                                 'x', p_x, 'y', p_y, 'dmg_att', dmg_att, 'dmg_def', dmg_def);
  if d.hp = 0 then
    delete from hc_units where id = d.id;
    ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', d.id, 'owner', d.owner_id);
  end if;
  if u.hp = 0 then
    delete from hc_units where id = u.id;
    ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', u.id, 'owner', u.owner_id);
  elsif d.hp = 0 and s.range <= 1 and dist = 1
        and not (t.terrain = 'mountain' or (t.terrain = 'water' and not s.naval))
        and (not t.is_city or t.owner_id = u.owner_id or t.city_hp <= 0) then   -- 성벽이 남아 있으면 진입 불가
    update hc_units set x = p_x, y = p_y where id = u.id;
    moved_in := true;
    if t.is_city and t.owner_id is distinct from u.owner_id then
      ev := ev || hc__capture_city(p_room, p_x, p_y, u.owner_id);
      perform hc__check_instant_conquest(p_room);
    end if;
  end if;
  perform hc__bump(p_room);
  return jsonb_build_object(
    'siege', false, 'attacker_id', u.id, 'defender_id', d.id,
    'from', jsonb_build_array(ux, uy), 'at', jsonb_build_array(p_x, p_y),
    'dmg_att', dmg_att, 'dmg_def', dmg_def,
    'attacker_hp', u.hp, 'defender_hp', d.hp, 'moved_in', moved_in, 'events', ev);
end $$;

-- ---------------------------------------------------------------------
-- 7) 기존 함수 패치: 산출량 기록 · 방어 보너스 · 공성 · 과학 승리 · 무제한 턴 · AI 난이도/연구
-- ---------------------------------------------------------------------
do $mig$
declare d text;
  core_pairs text[][] := array[
    ['      hammer            = hammer + v_ham,',
     '      hammer            = hammer + v_ham,
      hammer_rate = v_ham, gold_rate = v_gold, food_rate = v_food,'],
    ['case when t.is_city then 3 else 0 end + case when d.fortified then 2 else 0 end;',
     'case when t.is_city then 3 else 0 end + case when d.fortified then 2 else 0 end + hc__defense_bonus(p_room, d.owner_id);'],
    ['    update hc_units set x = tx, y = ty, moves_left = greatest(0, moves_left - dist) where id = u.id;',
     '    if t.is_city and t.owner_id is distinct from u.owner_id then
      continue when s.attack = 0 or s.naval;
      if t.city_hp > 0 then
        ev := ev || hc__siege(p_room, u.id, tx, ty);
        continue;
      end if;
    end if;
    update hc_units set x = tx, y = ty, moves_left = greatest(0, moves_left - dist) where id = u.id;'],
    ['and ''new_weapons'' = any (researched)', 'and ''ai_revolution'' = any (researched)'],
    ['now() + make_interval(secs => turn_seconds)', 'case when turn_seconds > 0 then now() + make_interval(secs => turn_seconds) end']
  ];
  i int;
begin
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  for i in 1..array_length(core_pairs, 1) loop
    if position(core_pairs[i][2] in d) > 0 then continue; end if;
    if position(core_pairs[i][1] in d) = 0 then raise exception 'core pattern not found: %', core_pairs[i][1]; end if;
    d := replace(d, core_pairs[i][1], core_pairs[i][2]);
  end loop;
  execute d;

  d := pg_get_functiondef('public.hc_start_game(uuid)'::regprocedure);
  if position('case when turn_seconds > 0' in d) = 0 then
    d := replace(d, 'now() + make_interval(secs => turn_seconds)', 'case when turn_seconds > 0 then now() + make_interval(secs => turn_seconds) end');
    execute d;
  end if;

  d := pg_get_functiondef('public.hc_try_resolve_turn(uuid,integer)'::regprocedure);
  if position('turn_deadline is null' in d) = 0 then
    d := replace(d, 'or now() < r.turn_deadline then', 'or r.turn_deadline is null or now() < r.turn_deadline then');
    execute d;
  end if;

  d := pg_get_functiondef('public.hc__ai_actions(uuid,uuid)'::regprocedure);
  d := replace(d, 'continue when r.turn_number < 6;',
                  'continue when r.turn_number < case r.difficulty when ''easy'' then 12 when ''hard'' then 3 else 6 end;');
  d := replace(d, 'array[''steam_engine'', ''enlightenment'', ''electrification'', ''rights_declaration'', ''new_weapons'']',
                  'array[''steam_engine'', ''enlightenment'', ''electrification'', ''rights_declaration'', ''internal_combustion'', ''computing'', ''new_weapons'', ''internet'', ''ai_revolution'']');
  execute d;
end $mig$;

-- ---------------------------------------------------------------------
-- 8) 위인 등장 · 연대기 사건 · 경제 패시브
-- ---------------------------------------------------------------------
create or replace function public.hc__check_persons(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl record; d hc_scholar_defs; v_year int; n int; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  v_year := hc__year(r.turn_number);
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    n := 0;
    for d in select * from hc_scholar_defs sd
              where sd.year is not null and sd.year <= v_year
                and (sd.factions is null or pl.faction::text = any (sd.factions))
                and not exists (select 1 from hc_player_scholars s
                                 where s.room_id = p_room and s.scholar_id = sd.id and s.player_id = pl.user_id)
              order by sd.year, sd.ord loop
      exit when n >= 2;                                   -- 한 턴에 최대 2명 (연대기 순)
      insert into hc_player_scholars (room_id, scholar_id, player_id, joined_turn, seen)
      values (p_room, d.id, pl.user_id, r.turn_number, pl.is_ai);
      out := out || jsonb_build_object('type', 'person_joined', 'player', pl.user_id, 'scholar', d.id, 'year', d.year);
      out := out || hc__apply_effects(p_room, pl.user_id, d.immediate);
      n := n + 1;
    end loop;
  end loop;
  return out;
end $$;

create or replace function public.hc__trigger_events(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl record; e record; v_year int; v_id bigint; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  v_year := hc__year(r.turn_number);
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    continue when exists (select 1 from hc_player_events where room_id = p_room and player_id = pl.user_id and turn = r.turn_number);
    select * into e from hc_event_defs ed
     where ed.year is not null and ed.year <= v_year
       and (ed.factions is null or pl.faction::text = any (ed.factions))
       and not exists (select 1 from hc_player_events pe where pe.room_id = p_room and pe.player_id = pl.user_id and pe.event_id = ed.id)
     order by ed.year, ed.sort limit 1;                   -- 연대기 순서 강제: 가장 이른 미발생 사건 하나
    continue when not found;
    insert into hc_player_events (room_id, player_id, event_id, turn)
    values (p_room, pl.user_id, e.id, r.turn_number) returning id into v_id;
    out := out || jsonb_build_object('type', 'historic_event', 'player', pl.user_id, 'event', e.id);
    if pl.is_ai then
      out := out || hc__resolve_event(v_id, case when random() < 0.5 then 'a' else 'b' end);
    end if;
  end loop;
  return out;
end $$;

create or replace function public.hc__faction_passives(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r hc_rooms; pl record;
  g int; h int; rs int; i int; st int; f int; gp int; hp int; rp int; fp int; drain int; floor_st int;
  v_take int; o record;
begin
  select * into r from hc_rooms where id = p_room;
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    -- 위인 패시브 + 내 도시 건물 패시브 합산
    select coalesce(sum((j->>'gold')::int), 0), coalesce(sum((j->>'hammer')::int), 0), coalesce(sum((j->>'research')::int), 0),
           coalesce(sum((j->>'ideology')::int), 0), coalesce(sum((j->>'stability')::int), 0), coalesce(sum((j->>'food')::int), 0),
           coalesce(sum((j->>'gold_pct')::int), 0), coalesce(sum((j->>'hammer_pct')::int), 0),
           coalesce(sum((j->>'research_pct')::int), 0), coalesce(sum((j->>'food_pct')::int), 0),
           coalesce(sum((j->>'gold_drain')::int), 0), coalesce(max((j->>'stability_floor')::int), 0)
      into g, h, rs, i, st, f, gp, hp, rp, fp, drain, floor_st
      from (select d.passive as j from hc_player_scholars s join hc_scholar_defs d on d.id = s.scholar_id
             where s.room_id = p_room and s.player_id = pl.user_id
            union all
            select b.passive from hc_city_buildings cb
              join hc_tiles t on t.room_id = cb.room_id and t.x = cb.x and t.y = cb.y and t.owner_id = pl.user_id
              join hc_building_defs b on b.id = cb.building_id
             where cb.room_id = p_room) z;

    g := g + pl.gold_rate * gp / 100;
    h := h + pl.hammer_rate * hp / 100;
    rs := rs + pl.innovation * rp / 100;
    f := f + pl.food_rate * fp / 100;

    -- 미국 특성: 식량 +2, 이념 +1
    if pl.faction = 'usa' then f := f + 2; i := i + 1; end if;

    -- 경제 위기 · 반란 (위인이 무효화)
    if hc__has_condition(p_room, pl.user_id, 'depression')
       and not hc__has_person(p_room, pl.user_id, 'fdr') and not hc__has_person(p_room, pl.user_id, 'keynes') then
      h := h - pl.hammer_rate * (case when hc__has_person(p_room, pl.user_id, 'chaplin') then 25 else 50 end) / 100;
    end if;
    if hc__has_condition(p_room, pl.user_id, 'oil_shock') and not hc__has_person(p_room, pl.user_id, 'volcker') then
      g := g - pl.gold_rate * 30 / 100;
    end if;
    if hc__has_condition(p_room, pl.user_id, 'cholera') and not hc__has_person(p_room, pl.user_id, 'pasteur') then
      f := f - pl.food_rate * (case when hc__has_person(p_room, pl.user_id, 'dickens') then 25 else 50 end) / 100;
    end if;
    if hc__has_condition(p_room, pl.user_id, 'subprime') and not hc__has_person(p_room, pl.user_id, 'bernanke') then
      g := g - pl.gold_rate * 50 / 100;
    end if;
    if hc__has_condition(p_room, pl.user_id, 'unrest')
       and not (hc__has_person(p_room, pl.user_id, 'voltaire') or hc__has_person(p_room, pl.user_id, 'rousseau')
                or hc__has_person(p_room, pl.user_id, 'hugo')) then
      st := st - 3; h := h - 2;
    end if;

    -- 난이도
    if r.difficulty = 'easy' and not pl.is_ai then g := g + 3; h := h + 3; end if;
    if r.difficulty = 'easy' and pl.is_ai then rs := rs - pl.innovation / 4; end if;
    if r.difficulty = 'hard' and pl.is_ai then h := h + pl.hammer_rate / 4; rs := rs + pl.innovation / 4; end if;

    -- 문화 수출(비틀즈): 다른 문명에서 골드를 흡수
    if drain > 0 then
      for o in select user_id, gold from hc_room_players where room_id = p_room and user_id <> pl.user_id and not is_eliminated loop
        v_take := least(drain, o.gold);
        update hc_room_players set gold = gold - v_take where room_id = p_room and user_id = o.user_id;
        g := g + v_take;
      end loop;
    end if;

    update hc_room_players set
      gold              = greatest(0, gold + g),
      hammer            = greatest(0, hammer + h),
      research_progress = greatest(0, research_progress + rs),
      innovation        = greatest(0, innovation + rs),
      ideology          = greatest(0, ideology + i),
      food              = greatest(0, food + f),
      stability         = least(100, greatest(floor_st, stability + st))
     where room_id = p_room and user_id = pl.user_id;
  end loop;

  -- 옛 클라이언트가 '도서관 시설'로 지은 것은 건물로 옮긴다
  insert into hc_city_buildings (room_id, x, y, building_id, built_turn)
  select room_id, x, y, 'library', r.turn_number from hc_tiles where room_id = p_room and improvement = 'library' and is_city
  on conflict do nothing;
  update hc_tiles set improvement = null where room_id = p_room and improvement = 'library';

  -- 도시 성벽 회복 +10/턴, 끝난 상태 정리
  update hc_tiles set city_hp = least(100, city_hp + 10) where room_id = p_room and is_city;
  delete from hc_player_conditions where room_id = p_room and until_turn < r.turn_number;
end $$;

-- 정산 래퍼: 지식인(도서관) 대신 연대기 위인 등장
create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_turn int; a record; v_winner uuid; v_status hc_room_status; ev jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;

  for a in select id from hc_player_events where room_id = p_room and status = 'pending' and turn <= v_turn loop
    ev := ev || hc__resolve_event(a.id, 'a');
  end loop;

  for a in select user_id from hc_room_players where room_id = p_room and is_ai and not is_eliminated loop
    insert into hc_turn_actions (room_id, turn, player_id, actions)
    values (p_room, v_turn, a.user_id, hc__ai_actions(p_room, a.user_id))
    on conflict (room_id, turn, player_id) do update set actions = excluded.actions, submitted_at = now();
  end loop;

  perform hc__resolve_turn_core(p_room);
  update hc_room_players set has_ended_turn = true where room_id = p_room and is_ai;
  update hc_units set acted = false where room_id = p_room;

  select status into v_status from hc_rooms where id = p_room;
  if v_status = 'playing' then
    perform hc__leader_passives(p_room);
    perform hc__faction_passives(p_room);
    ev := ev || hc__check_persons(p_room) || hc__check_leaders(p_room) || hc__trigger_events(p_room);
  end if;
  if jsonb_array_length(ev) > 0 then
    update hc_turn_logs set events = events || ev
     where id = (select max(id) from hc_turn_logs where room_id = p_room);
  end if;

  if v_status = 'playing' then
    ev := hc__check_wonders(p_room);
    if jsonb_array_length(ev) > 0 then
      update hc_turn_logs set events = events || ev where id = (select max(id) from hc_turn_logs where room_id = p_room);
    end if;
  end if;

  if exists (select 1 from hc_rooms where id = p_room and is_solo and status = 'playing')
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
  end if;
end $$;

-- 맨해튼 프로젝트: 아인슈타인이 있으면 비용 50%
create or replace function public.hc_build_wonder(p_room uuid, p_x int, p_y int, p_wonder text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl hc_room_players; w hc_wonder_defs; t hc_tiles; ev jsonb; v_cost int;
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  select * into pl from hc_room_players where room_id = p_room and user_id = auth.uid();
  if not found or pl.is_eliminated then raise exception 'NOT_MEMBER'; end if;
  if pl.has_ended_turn then raise exception 'TURN_ALREADY_ENDED'; end if;
  select * into w from hc_wonder_defs where id = p_wonder;
  if not found then raise exception 'NO_WONDER'; end if;
  if w.faction is not null and w.faction <> pl.faction then raise exception 'WRONG_FACTION'; end if;
  if w.requires_tech is not null and not (w.requires_tech = any (pl.researched)) then raise exception 'TECH_REQUIRED'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  if not found or not t.is_city or t.owner_id <> pl.user_id then raise exception 'NOT_YOUR_CITY'; end if;
  if exists (select 1 from hc_wonders where room_id = p_room and wonder_id = p_wonder) then raise exception 'WONDER_TAKEN'; end if;
  if exists (select 1 from hc_wonders where room_id = p_room and x = p_x and y = p_y) then raise exception 'CITY_HAS_WONDER'; end if;
  v_cost := case when p_wonder = 'manhattan' and hc__has_person(p_room, pl.user_id, 'einstein') then w.hammer_cost / 2 else w.hammer_cost end;
  if pl.hammer < v_cost then raise exception 'NOT_ENOUGH_HAMMER'; end if;

  update hc_room_players set hammer = hammer - v_cost where room_id = p_room and user_id = pl.user_id;
  insert into hc_wonders (room_id, wonder_id, player_id, x, y, built_turn)
  values (p_room, p_wonder, pl.user_id, p_x, p_y, r.turn_number);
  ev := jsonb_build_array(jsonb_build_object('type', 'wonder_built', 'player', pl.user_id, 'wonder', p_wonder,
                                             'x', p_x, 'y', p_y, 'city', t.city_name));
  update hc_turn_logs set events = events || ev where id = (select max(id) from hc_turn_logs where room_id = p_room);
  perform hc__bump(p_room);
  return ev;
end $$;

-- ---------------------------------------------------------------------
-- 9) 위인 퀴즈 · 솔로 게임(난이도) · 스냅샷
-- ---------------------------------------------------------------------
create or replace function public.hc_answer_person_quiz(p_room uuid, p_person text, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ps hc_player_scholars; q jsonb; v_ok boolean;
begin
  perform 1 from hc_rooms where id = p_room and status = 'playing' for share;
  if not found then raise exception 'ROOM_NOT_PLAYING'; end if;
  select * into ps from hc_player_scholars where room_id = p_room and scholar_id = p_person and player_id = auth.uid() for update;
  if not found then raise exception 'NOT_YOUR_PERSON'; end if;
  if ps.quiz_result is not null then raise exception 'ALREADY_ANSWERED'; end if;
  select quiz into q from hc_scholar_defs where id = p_person;
  v_ok := q is not null and (q->>'answer')::int = p_choice;
  update hc_player_scholars set quiz_result = case when v_ok then 'correct' else 'wrong' end, seen = true
   where room_id = p_room and scholar_id = p_person and player_id = auth.uid();
  if v_ok then
    update hc_room_players set research_progress = research_progress + 25 where room_id = p_room and user_id = auth.uid();
  end if;
  return jsonb_build_object('correct', v_ok, 'answer', (q->>'answer')::int);
end $$;

drop function if exists public.hc_create_solo_game(hc_faction_type, int, int);
create or replace function public.hc_create_solo_game(
  p_faction hc_faction_type, p_ai_count int default 2, p_turn_seconds int default 120, p_difficulty text default 'normal')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r hc_rooms; i int;
  others hc_faction_type[];
begin
  if not exists (select 1 from hc_profiles where id = auth.uid() and not is_ai) then raise exception 'NO_PROFILE'; end if;
  if p_ai_count not between 1 and 3 then raise exception 'INVALID_AI_COUNT'; end if;
  if p_difficulty not in ('easy', 'normal', 'hard') then raise exception 'INVALID_DIFFICULTY'; end if;

  insert into hc_rooms (host_id, max_players, turn_seconds, is_solo, difficulty)
  values (auth.uid(), 1 + p_ai_count, p_turn_seconds, true, p_difficulty) returning * into r;
  insert into hc_room_players (room_id, user_id, nickname, seat, faction)
  select r.id, auth.uid(), nickname, 0, p_faction from hc_profiles where id = auth.uid();

  others := array(select f from unnest(enum_range(null::hc_faction_type)) f where f <> p_faction);
  for i in 1..p_ai_count loop
    insert into hc_room_players (room_id, user_id, nickname, seat, faction, is_ready, is_ai)
    values (r.id, ('00000000-0000-4000-a000-00000000000' || i)::uuid,
            'AI ' || case others[i] when 'france' then '나폴레옹' when 'britain' then '빅토리아' when 'usa' then '워싱턴' else '비스마르크' end,
            i, others[i], true, true);
  end loop;

  perform hc_start_game(r.id);
  update hc_room_players set has_ended_turn = true where room_id = r.id and is_ai;
  return r.id;
end $$;

create or replace function public.hc_get_game_state(p_room uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r hc_rooms;
begin
  if not hc_is_room_member(p_room) then raise exception 'NOT_MEMBER'; end if;
  select * into r from hc_rooms where id = p_room;
  return jsonb_build_object(
    'server_now', now(),
    'year',       hc__year(r.turn_number),
    'room',       to_jsonb(r),
    'players',    (select coalesce(jsonb_agg(to_jsonb(rp) order by rp.seat), '[]') from hc_room_players rp where rp.room_id = p_room),
    'tiles',      (select coalesce(jsonb_agg(to_jsonb(g) - 'room_id'), '[]') from hc_tiles g where g.room_id = p_room),
    'units',      (select coalesce(jsonb_agg(to_jsonb(u) - 'room_id'), '[]') from hc_units u where u.room_id = p_room),
    'my_actions', (select actions from hc_turn_actions where room_id = p_room and turn = r.turn_number and player_id = auth.uid()),
    'last_log',   (select events from hc_turn_logs where room_id = p_room order by id desc limit 1),
    'leaders',    (select coalesce(jsonb_agg(jsonb_build_object('leader_id', leader_id, 'player_id', player_id,
                                                                'joined_turn', joined_turn)), '[]')
                     from hc_player_leaders where room_id = p_room),
    'my_events',  (select coalesce(jsonb_agg((to_jsonb(d) - 'choice_a' - 'choice_b' - 'sort')
                                             || jsonb_build_object('pe_id', e.id, 'turn', e.turn) order by e.id), '[]')
                     from hc_player_events e join hc_event_defs d on d.id = e.event_id
                    where e.room_id = p_room and e.player_id = auth.uid() and e.status = 'pending'),
    -- 위인: 퀴즈 정답은 보내지 않는다
    'scholars',   (select coalesce(jsonb_agg((to_jsonb(d) - 'quiz' - 'immediate' - 'passive')
                                     || jsonb_build_object(
                                     'player_id', s.player_id, 'joined_turn', s.joined_turn,
                                     'seen', s.seen or s.player_id <> auth.uid(),
                                     'quiz_result', s.quiz_result,
                                     'quiz', case when d.quiz is null then null
                                                  else jsonb_build_object('q', d.quiz->'q', 'choices', d.quiz->'choices') end)
                                     order by s.joined_turn, d.year, d.ord), '[]')
                     from hc_player_scholars s join hc_scholar_defs d on d.id = s.scholar_id
                    where s.room_id = p_room),
    'wonders',    (select coalesce(jsonb_agg(jsonb_build_object(
                                     'wonder_id', w.wonder_id, 'player_id', w.player_id, 'x', w.x, 'y', w.y,
                                     'built_turn', w.built_turn,
                                     'turns_left', greatest(0, 10 - (r.turn_number - w.built_turn)),
                                     'name_ko', d.name_ko, 'icon', d.icon) order by w.built_turn), '[]')
                     from hc_wonders w join hc_wonder_defs d on d.id = w.wonder_id
                    where w.room_id = p_room),
    'buildings',  (select coalesce(jsonb_agg(jsonb_build_object('x', x, 'y', y, 'building_id', building_id, 'built_turn', built_turn)), '[]')
                     from hc_city_buildings where room_id = p_room),
    'conditions', (select coalesce(jsonb_agg(jsonb_build_object('player_id', player_id, 'cond_id', cond_id, 'until_turn', until_turn)), '[]')
                     from hc_player_conditions where room_id = p_room and until_turn >= r.turn_number)
  );
end $$;

revoke execute on function public.hc__year(int)                                 from public, anon;
revoke execute on function public.hc__has_person(uuid, uuid, text)              from public, anon, authenticated;
revoke execute on function public.hc__has_condition(uuid, uuid, text)           from public, anon, authenticated;
revoke execute on function public.hc__apply_effects(uuid, uuid, jsonb)          from public, anon, authenticated;
revoke execute on function public.hc__attack_bonus(uuid, uuid)                  from public, anon, authenticated;
revoke execute on function public.hc__defense_bonus(uuid, uuid)                 from public, anon, authenticated;
revoke execute on function public.hc__unit_cost(uuid, uuid, text, int)          from public, anon, authenticated;
revoke execute on function public.hc__siege(uuid, uuid, int, int)               from public, anon, authenticated;
revoke execute on function public.hc__capture_city(uuid, int, int, uuid)        from public, anon, authenticated;
revoke execute on function public.hc__check_persons(uuid)                       from public, anon, authenticated;
revoke execute on function public.hc__trigger_events(uuid)                      from public, anon, authenticated;
revoke execute on function public.hc__faction_passives(uuid)                    from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                        from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)                   from public, anon, authenticated;
revoke execute on function public.hc__ai_actions(uuid, uuid)                    from public, anon, authenticated;
revoke execute on function public.hc_start_game(uuid)                           from public, anon;
revoke execute on function public.hc_try_resolve_turn(uuid, int)                from public, anon;
revoke execute on function public.hc_unit_move(uuid, uuid, int, int)            from public, anon;
revoke execute on function public.hc_unit_attack(uuid, uuid, int, int)          from public, anon;
revoke execute on function public.hc_build_building(uuid, int, int, text)       from public, anon;
revoke execute on function public.hc_build_wonder(uuid, int, int, text)         from public, anon;
revoke execute on function public.hc_answer_person_quiz(uuid, text, int)        from public, anon;
revoke execute on function public.hc_create_solo_game(hc_faction_type, int, int, text) from public, anon;
revoke execute on function public.hc_get_game_state(uuid)                       from public, anon;

-- 연대기(60턴 = 1750~2045)에 맞춰 문화 승리 목표 200 → 800
do $mig$
declare d text;
begin
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  if position('ideology >= 200' in d) > 0 then
    execute replace(d, 'ideology >= 200', 'ideology >= 800');
  end if;
end $mig$;

-- 독일 도시 풀 (빈·프라하 제외)
delete from public.hc_city_names where faction = 'empire';
insert into public.hc_city_names (faction, ord, name)
select 'empire', o, n from unnest(array['베를린','함부르크','뮌헨','프랑크푸르트','쾰른','드레스덴','슈투트가르트','라이프치히']) with ordinality as t(n, o);
