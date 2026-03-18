const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["youtube-dl-exec", "onnxruntime-node"],
  },
  webpack: (config, { isServer }) => {
    // WebAssembly 비동기 지원 (WebGPU 백엔드용)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (isServer) {
      // 서버 빌드: @huggingface/transformers와 onnxruntime-node를 번들링에서 제외
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existing,
        "onnxruntime-node",
        "@huggingface/transformers",
      ];
    } else {
      // 브라우저 빌드: 웹 전용 버전으로 강제 지정
      // transformers.node.mjs 대신 transformers.web.js를 사용
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
        "@huggingface/transformers": path.resolve(
          __dirname,
          "node_modules/@huggingface/transformers/dist/transformers.web.js"
        ),
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        net: false,
        tls: false,
        dns: false,
        "node:fs": false,
        "node:path": false,
        "node:stream": false,
        "node:buffer": false,
        "node:util": false,
        "node:events": false,
        "node:crypto": false,
        "node:os": false,
      };
    }

    // .node 네이티브 바이너리 무시
    config.module.rules.push({
      test: /\.node$/,
      use: "null-loader",
    });

    return config;
  },
  images: {
    domains: ["img.youtube.com", "i.ytimg.com"],
  },
};

module.exports = nextConfig;
