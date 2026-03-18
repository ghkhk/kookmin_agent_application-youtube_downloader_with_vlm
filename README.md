# YouTube 다운로드 및 프레임 캡쳐 VLM 분석기

Qwen3.5-2B 멀티모달 언어 모델(WebGPU)을 활용하여 YouTube 영상의 특정 화면을 AI로 분석하는 웹 애플리케이션입니다.
영상을 일시정지한 뒤 원하는 프롬프트를 입력하면, 브라우저 내에서 직접 GPU 추론이 실행되어 결과를 반환합니다.

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| UI | React 18, Tailwind CSS |
| VLM 모델 | Qwen3.5-2B-ONNX |
| 모델 추론 | @huggingface/transformers v3 (WebGPU) |
| YouTube 스트리밍 / 다운로드 | youtube-dl-exec / yt-dlp (서버 사이드 프록시) |

---

## 사전 요구사항

| 항목 | 조건 |
|------|------|
| Node.js | **18.x 이상** (권장: 20.x LTS) |
| 브라우저 | **Chrome 113+ 또는 Edge 113+** (WebGPU 지원 필수) |
| GPU VRAM | **4 GB 이상** 권장 |
| 인터넷 | 최초 실행 시 모델 다운로드 (~2–3 GB) |

> ⚠️ Firefox, Safari 등 WebGPU 미지원 브라우저에서는 모델이 동작하지 않습니다.

---

## 로컬 실행 방법 (처음부터 따라하기)

### 1. Node.js 설치 확인

터미널(PowerShell 또는 cmd)을 열고 아래 명령어를 입력합니다:

```bash
node -v
npm -v
```

아래와 같이 버전이 출력되면 정상입니다:

```
v20.x.x   ← v18 이상이면 OK
10.x.x    ← 9 이상이면 OK
```

Node.js가 없거나 버전이 낮다면 https://nodejs.org 에서 **LTS 버전**을 설치한 뒤 터미널을 재시작하세요.

---

### 2. 저장소 클론

```bash
git clone https://github.com/ghkhk/kookmin_agent_application-youtube_downloader_with_vlm.git
cd kookmin_agent_application-youtube_downloader_with_vlm
```

---

### 3. 의존성 설치

```bash
npm install
```

- `node_modules/` 폴더가 생성됩니다.
- 설치 중 `yt-dlp` 바이너리도 자동으로 다운로드됩니다 (약 10–20 MB).
- `warn` 경고 메시지는 무시해도 됩니다.

> 오류 없이 완료되면 다음 단계로 넘어가세요.

---

### 4. 개발 서버 실행

```bash
npm run dev
```

아래 메시지가 출력되면 성공입니다:

```
▲ Next.js 14.x.x
- Local:   http://localhost:3000
```

---

### 5. 브라우저에서 접속

**Chrome 113+ 또는 Edge 113+** 을 열고 주소창에 입력:

```
http://localhost:3000
```

---

## 사용 방법

### Step 1 — YouTube 영상 불러오기

1. 상단 입력창에 YouTube URL을 붙여넣기
   ```
   예시: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```
2. **불러오기** 버튼 클릭 (또는 Enter)
3. 영상 제목·썸네일·길이 정보가 표시되고 플레이어에 영상이 로드됩니다

---

### Step 2 — 영상 재생 및 다운로드

1. 플레이어에서 영상을 재생합니다
2. 분석하고 싶은 장면에서 ⏸ **일시정지**
3. 일시정지 상태에서만 "화면 분석" 버튼이 활성화됩니다
4. 플레이어 우측 하단 **⬇ 다운로드** 버튼을 클릭하면 영상을 mp4 파일로 저장할 수 있습니다

---

### Step 3 — AI 모델 로드

1. **"Qwen3.5-2B 모델 로드 (WebGPU)"** 버튼 클릭
2. HuggingFace에서 ONNX 모델을 자동으로 다운로드합니다 (~2–3 GB)
3. 진행 표시줄에서 다운로드 진행 상황을 확인할 수 있습니다
4. **"모델 준비 완료"** 가 표시되면 완료

> 두 번째 실행부터는 브라우저 캐시에서 빠르게 로드됩니다.

---

### Step 4 — 프롬프트 입력 및 화면 분석

1. 분석 버튼 위의 **프롬프트 입력창**에 원하는 질문이나 지시를 입력합니다

   프롬프트 예시:
   ```
   이 화면에 무엇이 보이는지 한국어로 자세히 설명해주세요.
   이 장면에 나오는 자막을 한국어로 번역해주세요.
   등장인물의 표정과 감정을 분석해주세요.
   화면에 보이는 텍스트를 모두 읽어주세요.
   ```

2. 영상이 일시정지된 상태에서 **"🔍 화면 분석"** 버튼 클릭
3. 현재 프레임이 캡처되어 AI 모델로 전달됩니다
4. 잠시 후 화면 하단에 분석 결과가 출력됩니다

---

## 주의사항

- YouTube 영상 스트리밍은 YouTube 이용약관의 제한을 받습니다. **개인 학습 목적으로만** 사용하세요.
- 모델 첫 로드 시 네트워크 속도에 따라 수 분이 소요될 수 있습니다.
- WebGPU 미지원 환경(Firefox, Safari, 구형 Chrome)에서는 모델이 동작하지 않습니다.
- GPU VRAM이 4 GB 미만이면 모델 로드 중 오류가 발생할 수 있습니다.

---

## 파일 구조

```
.
├── app/
│   ├── layout.tsx           # 루트 레이아웃
│   ├── page.tsx             # 홈 페이지 (SSR 비활성화)
│   ├── globals.css          # Tailwind 전역 스타일
│   └── api/
│       └── youtube/
│           └── route.ts     # YouTube 영상 정보 / 스트리밍 프록시 API
├── components/
│   └── VideoAnalyzer.tsx    # 메인 UI (영상 플레이어 + VLM 분석)
├── next.config.js           # WebAssembly / 외부 패키지 webpack 설정
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 모델 정보

| 항목 | 내용 |
|------|------|
| 모델 ID | `onnx-community/Qwen3.5-2B-ONNX` |
| 원본 | `Qwen/Qwen3.5-2B` (Alibaba Cloud) |
| 형식 | ONNX (브라우저 WebGPU 추론용) |
| 양자화 | embed_tokens=q4, vision_encoder=fp16, decoder_model_merged=q4 |
| 추론 환경 | 브라우저 내 WebGPU (서버 불필요) |

---

*국민대학교 생성모델응용 과제*
