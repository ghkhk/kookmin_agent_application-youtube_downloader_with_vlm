import { NextRequest } from "next/server";
import youtubeDl from "youtube-dl-exec";

export const runtime = "nodejs";
export const maxDuration = 60;

function isValidYoutubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/|live\/)|youtu\.be\/)[\w-]+/.test(
    url
  );
}

const PROXY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.youtube.com/",
};

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const action = request.nextUrl.searchParams.get("action") ?? "info";

  if (!url) {
    return new Response(JSON.stringify({ error: "url 파라미터가 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isValidYoutubeUrl(url)) {
    return new Response(JSON.stringify({ error: "유효하지 않은 YouTube URL입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 영상 메타데이터 반환
    if (action === "info") {
      const info = (await youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
      })) as Record<string, unknown>;

      return new Response(
        JSON.stringify({
          title: info.title as string,
          thumbnail: info.thumbnail as string,
          duration: Number(info.duration),
          author: (info.uploader ?? info.channel ?? "") as string,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 영상 스트리밍: yt-dlp로 직접 URL 추출 → 서버 프록시
    if (action === "stream") {
      // videoandaudio 통합 mp4 포맷 우선 선택 (ffmpeg 불필요)
      const info = (await youtubeDl(url, {
        dumpSingleJson: true,
        format: "best[ext=mp4][height<=720]/best[ext=mp4]/best",
        noWarnings: true,
        noCheckCertificates: true,
      })) as Record<string, unknown>;

      // 직접 스트림 URL 추출
      let directUrl = info.url as string | undefined;
      if (!directUrl) {
        const downloads = info.requested_downloads as
          | Array<Record<string, unknown>>
          | undefined;
        directUrl = downloads?.[0]?.url as string | undefined;
      }
      if (!directUrl) {
        throw new Error("영상 스트리밍 URL을 가져올 수 없습니다.");
      }

      // Range 헤더 전달 (영상 탐색 지원)
      const rangeHeader = request.headers.get("range");
      const fetchHeaders: Record<string, string> = { ...PROXY_HEADERS };
      if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

      // YouTube CDN → 서버 → 클라이언트 프록시
      const videoResponse = await fetch(directUrl, { headers: fetchHeaders });

      const responseHeaders: Record<string, string> = {
        "Content-Type": videoResponse.headers.get("content-type") ?? "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      };
      const cl = videoResponse.headers.get("content-length");
      const cr = videoResponse.headers.get("content-range");
      if (cl) responseHeaders["Content-Length"] = cl;
      if (cr) responseHeaders["Content-Range"] = cr;

      return new Response(videoResponse.body, {
        status: rangeHeader ? 206 : 200,
        headers: responseHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "알 수 없는 action 값입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[YouTube API 오류]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
