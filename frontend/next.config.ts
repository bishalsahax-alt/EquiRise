import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Keep stellar-sdk server-side only (avoids bundling sodium-native in RSC)
  serverExternalPackages: ["stellar-sdk", "@stellar/stellar-sdk", "@stellar/stellar-base", "sodium-native"],

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Ignore the native Node.js addons that stellar-sdk pulls in
      config.plugins = [
        ...(config.plugins || []),
        new webpack.IgnorePlugin({
          resourceRegExp: /^(sodium-native|require-addon)$/,
        }),
      ];

      // Stub out Node.js built-ins not available in browsers
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        os: false,
        path: false,
        buffer: false,
        process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
