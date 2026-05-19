# 🥗 다이어트 트래커 (Diet Tracker)

Next.js 14 + Prisma + PostgreSQL + Gemini AI 기반 풀스택 다이어트 기록 웹앱.
PWA 지원 (모바일 홈 화면 추가, 오프라인 캐시, 백그라운드 동기화).

## 🚀 Vercel 배포 가이드

1. **Vercel 대시보드 → New Project → Import**: `satoshisong01/diet-tracker` 선택
2. **Environment Variables** 등록 (`.env.example` 참고):
   - `GOOGLE_AI_API_KEY` — [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급
   - `DATABASE_URL` — `postgresql://USER:PASS@HOST:PORT/postgres?schema=diet` (AWS RDS 등 PostgreSQL)
   - `AUTH_SECRET` — 32자 이상 강력한 랜덤 (`openssl rand -base64 48`)
   - (선택) `GEMINI_MODEL` — 기본 `gemini-3-flash-preview`
3. **Deploy** 클릭 → 자동 빌드 (`prisma generate` + Next 빌드 + SW 생성)
4. 첫 배포 후 한 번만 `npx prisma db push` 로 원격 DB에 `diet` 스키마 푸시
   - Vercel 빌드 단계에서 자동 실행하고 싶으면 `package.json` build 스크립트를 `prisma db push && prisma generate && next build` 로 변경 가능

## ✨ 주요 기능

- 🔐 **회원가입/로그인** — 키·몸무게·나이·성별·활동 수준 입력 (JWT 쿠키 세션)
- 📅 **캘린더 대시보드** — 월별 달력에서 일별 섭취/소모 요약 확인
- 🍱 **음식 기록** — 식사별(아침/점심/저녁/간식) 입력, **🤖 AI(Gemini) 자동 칼로리 추정**
- 🔥 **운동 기록** — 가볍게/보통/고강도 강도별 입력, MET 공식 + AI 추정 둘 다 지원
- 📊 **일별 상세** — 섭취/소모/순 칼로리/목표(-500kcal)까지 4-카드
- ✅ **기초대사량(BMR) 포함 체크박스** — 체크 시 소모 칼로리 = 운동 + BMR
- 💪 **BMI/BMR/TDEE 자동 계산** (Mifflin-St Jeor 공식)
- 🤖 **AI 코치 조언** — Gemini가 오늘 데이터를 기반으로 조언 1줄 생성
- 📱 **PC/모바일 반응형** (Tailwind, 모바일 햄버거 메뉴 포함)

## 🛠 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router), React 18, TypeScript |
| UI | Tailwind CSS, 반응형 (PC/모바일) |
| 인증 | JWT (jose) + HTTP-only 쿠키, bcryptjs |
| DB | PostgreSQL (AWS RDS, `diet` 스키마 분리) |
| ORM | Prisma 5 (multiSchema) |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| 검증 | Zod |

## 🚀 실행 방법

```bash
# 1. 의존성 설치 + Prisma client 생성 (postinstall)
npm install

# 2. 원격 PostgreSQL에 diet 스키마 푸시 (이미 완료됨)
npm run db:push

# 3. 개발 서버
npm run dev          # http://localhost:3000

# 4. 프로덕션 빌드
npm run build && npm start
```

### 환경 변수 (`.env`)

```
GOOGLE_AI_API_KEY=...        # Gemini API 키
DATABASE_URL=...             # 위 DB_* 값을 합쳐 자동 생성
DB_HOST=...                  # 통합 DB (호환용)
DB_USER=postgres
DB_PASS=...
DB_NAME=postgres
DB_PORT=5432
AUTH_SECRET=...              # JWT 서명용 (32자 이상 권장)
```

> `DATABASE_URL`은 `?schema=diet` 가 붙어 있으며, 모든 테이블이 `diet` 스키마 아래에 격리됩니다.

## 📂 디렉토리 구조

```
src/
├── app/
│   ├── (landing) page.tsx        # / — 랜딩
│   ├── login/                    # 로그인
│   ├── signup/                   # 회원가입 (체형 정보 입력)
│   ├── dashboard/                # 메인 캘린더
│   ├── day/[date]/               # YYYY-MM-DD 일별 상세
│   ├── mypage/                   # 프로필 수정 + BMI/BMR/TDEE
│   └── api/
│       ├── auth/                 # signup, login, logout
│       ├── me                    # GET/PATCH 프로필
│       ├── foods                 # GET/POST + [id] PATCH/DELETE + estimate(AI)
│       ├── exercises             # 동일 + estimate(AI/MET)
│       ├── summary/day, /month   # 일·월 집계
│       └── tip                   # AI 다이어트 조언
├── components/
│   ├── TopNav.tsx                # 반응형 네비
│   ├── Calendar.tsx              # 월별 캘린더
│   ├── DayDetail.tsx             # 일별 음식·운동 CRUD UI
│   └── ProfileForm.tsx           # 마이페이지 폼
├── lib/
│   ├── db.ts                     # Prisma client 싱글톤
│   ├── auth.ts                   # JWT 세션 + bcrypt
│   ├── ai.ts                     # Gemini 음식·운동·조언
│   ├── calorie.ts                # BMR/TDEE + MET 표 (한국어 별칭 포함)
│   └── date.ts                   # YYYY-MM-DD UTC 정규화
├── middleware.ts                 # 보호 라우트 가드 + 인증 시 /login → /dashboard
└── app/globals.css               # Tailwind + 유틸 클래스
```

## 🧮 계산 공식

- **BMR (Mifflin-St Jeor)**
  - 남: `10×kg + 6.25×cm - 5×age + 5`
  - 여: `10×kg + 6.25×cm - 5×age - 161`
- **TDEE** = BMR × 활동계수 (1.2 ~ 1.9)
- **운동 칼로리** = MET × kg × hours
  - 표 기반(걷기/달리기/자전거/수영/헬스/요가/등산/댄스) + AI 보강
- **순 칼로리(체크박스 ON)** = 섭취 − (운동 + BMR)
- **순 칼로리(체크박스 OFF)** = 섭취 − 운동만

## 🗄 DB 스키마 (`diet` 스키마)

- `users` — 계정 + 체형 + activity_level + include_bmr 기본값
- `food_entries` — date, name, calories, quantity, meal_type
- `exercise_entries` — date, activity, duration_min, intensity, calories_burned
- `weight_logs` — 몸무게 변경 시 자동 기록 (날짜별 1개)

모든 테이블은 `userId, date` 인덱스로 빠른 일·월 조회 지원.

## 🧪 검증된 항목

- [x] `npm run build` 통과 (19개 라우트)
- [x] TypeScript strict 검사 통과
- [x] 회원가입/로그인 API 동작 (DB에 실제 저장)
- [x] 음식·운동 등록 → `/api/summary/day` 응답 (intake/exerciseBurn/bmr/net 계산 정상)
- [x] 미들웨어 라우트 가드 (미인증 시 `/dashboard` → `/login` 307)
