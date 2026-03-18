"use client";

import { useState, useRef, useCallback } from "react";

// ─── 타입 정의 ───────────────────────────────────────────────
type ModelStatus = "idle" | "loading" | "ready" | "analyzing" | "error";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  author: string;
}

// ─── 유틸 ─────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function VideoAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoSrc, setVideoSrc] = useState("");
  const [isFetchingVideo, setIsFetchingVideo] = useState(false);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [loadProgress, setLoadProgress] = useState({ file: "", progress: 0 });

  const [isVideoPaused, setIsVideoPaused] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState(
    "이 화면에 무엇이 보이는지 한국어로 자세하고 상세하게 설명해주세요. 화면의 내용, 분위기, 주요 요소들을 모두 묘사해주세요."
  );

  // ── 1. YouTube 영상 불러오기 ──────────────────────────────
  const handleLoadVideo = useCallback(async () => {
    const trimmed = youtubeUrl.trim();
    if (!trimmed) return;
    setIsFetchingVideo(true);
    setError("");
    setVideoInfo(null);
    setVideoSrc("");
    setAnalysis("");

    try {
      const res = await fetch(
        `/api/youtube?url=${encodeURIComponent(trimmed)}&action=info`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "영상 정보를 가져올 수 없습니다.");
      setVideoInfo(data as VideoInfo);
      setVideoSrc(`/api/youtube?url=${encodeURIComponent(trimmed)}&action=stream`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsFetchingVideo(false);
    }
  }, [youtubeUrl]);

  // ── 2. Qwen2.5-VL 모델 로드 (WebGPU) ─────────────────────
  const handleLoadModel = useCallback(async () => {
    if (modelStatus === "ready" || modelStatus === "loading") return;
    setModelStatus("loading");
    setError("");
    setLoadProgress({ file: "", progress: 0 });

    try {
      // 브라우저 환경에서만 동적 import
      const { AutoProcessor, Qwen3_5ForConditionalGeneration } = await import(
        "@huggingface/transformers"
      );

      const MODEL_ID = "onnx-community/Qwen3.5-2B-ONNX";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onProgress = (p: any) => {
        if (p.status === "progress" && p.file) {
          setLoadProgress({
            file: p.file,
            progress: Math.round(p.progress ?? 0),
          });
        }
      };

      processorRef.current = await AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback: onProgress,
      });

      modelRef.current = await Qwen3_5ForConditionalGeneration.from_pretrained(
        MODEL_ID,
        {
          dtype: {
            embed_tokens: "q4",
            vision_encoder: "fp16",
            decoder_model_merged: "q4",
          },
          device: "webgpu",
          progress_callback: onProgress,
        }
      );

      setModelStatus("ready");
    } catch (err) {
      setModelStatus("error");
      setError(
        `모델 로드 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [modelStatus]);

  // ── 3. 현재 프레임 분석 ───────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    const video = videoRef.current;
    if (!video || modelStatus !== "ready") return;

    setModelStatus("analyzing");
    setAnalysis("");
    setError("");

    try {
      const { RawImage } = await import("@huggingface/transformers");

      // canvas로 현재 프레임 캡처
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D 컨텍스트를 사용할 수 없습니다.");
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // Qwen3.5 프롬프트: content 안에 image URL을 넣지 않고 별도로 전달
      const messages = [
        {
          role: "user",
          content: [
            { type: "image" },
            {
              type: "text",
              text: prompt.trim() || "이 화면에 무엇이 보이는지 한국어로 자세하고 상세하게 설명해주세요.",
            },
          ],
        },
      ];

      const text = processorRef.current.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // RawImage.read()로 data URL 로드
      const image = await RawImage.read(imageDataUrl);

      const inputs = await processorRef.current(text, [image]);

      const generatedIds = await modelRef.current.generate({
        ...inputs,
        max_new_tokens: 512,
      });

      // Tensor → 일반 JS 배열로 변환 후 입력 토큰 제거
      const inputLen = inputs.input_ids.dims[1] as number;
      const generatedList = generatedIds.tolist() as number[][];
      const trimmedIds = generatedList.map((ids) => ids.slice(inputLen));

      const result = processorRef.current.batch_decode(trimmedIds, {
        skip_special_tokens: true,
      });

      setAnalysis(result[0] ?? "분석 결과가 없습니다.");
      setModelStatus("ready");
    } catch (err) {
      setModelStatus("error");
      setError(
        `분석 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [modelStatus]);

  // ── UI ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-3xl font-bold mb-2">🎬 YouTube VLM 분석기</h1>
          <p className="text-slate-400 text-sm">
            Qwen3.5-2B · WebGPU · 영상을 일시정지하면 AI가 화면을 한국어로 분석합니다
          </p>
        </div>

        {/* ─ Step 1: YouTube URL ─ */}
        <section className="bg-slate-800/80 backdrop-blur rounded-2xl p-6 mb-5 border border-slate-700/50">
          <h2 className="text-base font-semibold mb-3 text-slate-200">
            📺 Step 1 · YouTube 영상 불러오기
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleLoadVideo}
              disabled={isFetchingVideo || !youtubeUrl.trim()}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition whitespace-nowrap"
            >
              {isFetchingVideo ? "로딩…" : "불러오기"}
            </button>
          </div>

          {/* 영상 메타 정보 */}
          {videoInfo && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-slate-700/60 rounded-xl">
              {videoInfo.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{videoInfo.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {videoInfo.author} · {formatDuration(videoInfo.duration)}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ─ Step 2: 영상 플레이어 ─ */}
        {videoSrc && (
          <section className="bg-slate-800/80 backdrop-blur rounded-2xl p-6 mb-5 border border-slate-700/50">
            <h2 className="text-base font-semibold mb-3 text-slate-200">
              🎮 Step 2 · 영상 재생
            </h2>
            <div className="rounded-xl overflow-hidden bg-black ring-1 ring-slate-700">
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full max-h-[460px]"
                onPause={() => setIsVideoPaused(true)}
                onPlay={() => setIsVideoPaused(false)}
                onEnded={() => setIsVideoPaused(true)}
              >
                브라우저가 비디오를 지원하지 않습니다.
              </video>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-slate-500 text-xs">
                분석할 장면에서 ⏸ 일시정지한 뒤 아래 '화면 분석' 버튼을 누르세요
              </p>
              <a
                href={videoSrc}
                download={`${videoInfo?.title ?? "video"}.mp4`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium transition whitespace-nowrap"
              >
                ⬇ 다운로드
              </a>
            </div>
          </section>
        )}

        {/* ─ Step 3: AI 모델 & 분석 ─ */}
        <section className="bg-slate-800/80 backdrop-blur rounded-2xl p-6 mb-5 border border-slate-700/50">
          <h2 className="text-base font-semibold mb-4 text-slate-200">
            🤖 Step 3 · AI 모델 로드 및 화면 분석
          </h2>

          {/* 모델 로드 버튼 */}
          {modelStatus === "idle" && (
            <div className="mb-4">
              <button
                onClick={handleLoadModel}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold transition text-sm"
              >
                Qwen3.5-2B 모델 로드 (WebGPU)
              </button>
              <p className="text-slate-500 text-xs mt-2 text-center">
                최초 실행 시 HuggingFace에서 약 1~2 GB 다운로드됩니다.
                Chrome 113+ / Edge 113+ (WebGPU 지원) 필수.
              </p>
            </div>
          )}

          {/* 로딩 진행 표시 */}
          {modelStatus === "loading" && (
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-violet-300">모델 로드 중…</span>
                <span className="text-sm text-slate-400">
                  {loadProgress.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress.progress}%` }}
                />
              </div>
              {loadProgress.file && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {loadProgress.file}
                </p>
              )}
            </div>
          )}

          {/* 모델 준비 완료 표시 */}
          {(modelStatus === "ready" || modelStatus === "analyzing") && (
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-medium">
                모델 준비 완료 · Qwen3.5-2B (WebGPU)
              </span>
            </div>
          )}

          {/* 에러 후 재시도 */}
          {modelStatus === "error" && (
            <div className="mb-4">
              <button
                onClick={() => {
                  setModelStatus("idle");
                  setError("");
                }}
                className="w-full py-3 rounded-xl bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* 프롬프트 입력 */}
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">분석 프롬프트</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="모델에게 전달할 질문이나 지시를 입력하세요…"
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* 화면 분석 버튼 */}
          <button
            onClick={handleAnalyze}
            disabled={
              modelStatus !== "ready" ||
              !videoSrc ||
              !isVideoPaused
            }
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg transition"
          >
            {modelStatus === "analyzing" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block">⏳</span>
                분석 중…
              </span>
            ) : (
              "🔍 화면 분석"
            )}
          </button>

          {/* 비활성화 안내 */}
          {modelStatus === "ready" && videoSrc && !isVideoPaused && (
            <p className="text-amber-400 text-xs text-center mt-2">
              ⏸ 영상을 일시정지한 후 분석 버튼을 누르세요
            </p>
          )}
          {modelStatus === "ready" && !videoSrc && (
            <p className="text-slate-500 text-xs text-center mt-2">
              먼저 YouTube 영상을 불러오세요
            </p>
          )}
        </section>

        {/* ─ 에러 메시지 ─ */}
        {error && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-4 mb-5">
            <p className="text-red-300 text-sm">⚠ {error}</p>
          </div>
        )}

        {/* ─ 분석 결과 ─ */}
        {analysis && (
          <section className="bg-slate-800/80 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
            <h2 className="text-base font-semibold mb-3 text-slate-200">
              📋 분석 결과
            </h2>
            <div className="bg-slate-700/40 rounded-xl p-5">
              <p className="text-slate-100 leading-relaxed whitespace-pre-wrap text-sm">
                {analysis}
              </p>
            </div>
          </section>
        )}

        <footer className="mt-10 mb-4 text-center text-xs text-slate-600">
          Qwen3.5-2B (ONNX) · WebGPU · 국민대학교 생성모델응용 과제
        </footer>
      </div>
    </div>
  );
}
