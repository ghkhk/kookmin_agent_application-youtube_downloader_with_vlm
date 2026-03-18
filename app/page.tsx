import dynamic from "next/dynamic";

// SSR 비활성화: @huggingface/transformers는 브라우저(WebGPU)에서만 동작
const VideoAnalyzer = dynamic(() => import("@/components/VideoAnalyzer"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white opacity-50" />
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800">
      <VideoAnalyzer />
    </main>
  );
}
