import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
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
		},
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	envPrefix: ["VITE_", "TAURI_ENV_*"],
	build: {
		target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
