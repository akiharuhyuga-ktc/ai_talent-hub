import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { fsApiPlugin } from "./vite-plugins/fs-api";

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
		fsApiPlugin(),
	],
	clearScreen: false,
	server: {
		host: "0.0.0.0",
		port: 5173,
		strictPort: true,
		open: !isTauri,
		proxy: {
			"/api": {
				target: "http://backend:8080",
				changeOrigin: true,
			},
			// Microsoft の /devicecode は CORS を許可していないため、dev では Vite proxy を経由する。
			// 本番（Tauri）では別途 Rust 側 or バックエンドプロキシで対応すること。
			// Origin/Referer を落とさないと /token で AADSTS9002326（クロスオリジン token 交換は SPA 専用）に弾かれる。
			"/auth/ms": {
				target: "https://login.microsoftonline.com",
				changeOrigin: true,
				rewrite: (p) => p.replace(/^\/auth\/ms/, ""),
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq) => {
						proxyReq.removeHeader("origin");
						proxyReq.removeHeader("referer");
					});
				},
			},
		},
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	envPrefix: ["VITE_", "TAURI_ENV_*"],
	build: {
		target:
			process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
