import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Dev-only Vite middleware that persists members under data/v1/ on host FS.
 *
 * URL パスのメンバー識別子は ID（例: mbr_xxx）を使う。ディスク上のディレクトリ名も
 * 同じ ID で揃える（同姓同名対策・URL/FS 間の正規化負荷を避けるため）。
 *
 * クエリ ?mode=demo が付くと data/v1/demo-members/ を参照する（開発時の実データ
 * 保護）。demo-members/ が空のときは frontend/src/mocks/seeds/members/ から
 * 自動コピーする。
 *
 * Endpoints (?mode=demo オプション付き):
 *   GET    /api/fs/members                              → list member profiles
 *   GET    /api/fs/members/:id/profile                  → read profile.md
 *   PUT    /api/fs/members/:id/profile                  → write profile.md (body: { content })
 *   DELETE /api/fs/members/:id                          → recursive delete member dir
 *
 *   GET    /api/fs/members/:id/goals                    → list goals/*.md
 *   PUT    /api/fs/members/:id/goals/:period            → write goals/{period}.md
 *   GET    /api/fs/members/:id/one-on-one               → list one-on-one/*.md
 *   PUT    /api/fs/members/:id/one-on-one/:yearMonth    → write one-on-one/{YYYY-MM}.md
 *   GET    /api/fs/members/:id/reviews                  → list reviews/*.md
 *   PUT    /api/fs/members/:id/reviews/:period          → write reviews/{period}.md
 *
 * DATA_ROOT env (default: ../data/v1 relative to cwd):
 *   - docker compose: /workspace/data/v1 (bind-mounted)
 *   - local:          ./data/v1 relative to repo root
 */

const DEFAULT_DATA_ROOT = path.resolve(process.cwd(), "..", "data", "v1");
const DATA_ROOT = process.env.DATA_ROOT
	? path.resolve(process.env.DATA_ROOT)
	: DEFAULT_DATA_ROOT;

const MEMBERS_DIR = path.join(DATA_ROOT, "members");
const DEMO_MEMBERS_DIR = path.join(DATA_ROOT, "demo-members");

// Vite dev server の cwd は frontend/ ディレクトリ
const SEED_DIR = path.resolve(process.cwd(), "src", "mocks", "seeds", "members");

const SUB_DIRS = ["goals", "one-on-one", "reviews"] as const;
type SubDir = (typeof SUB_DIRS)[number];

function isSubDir(value: string): value is SubDir {
	return (SUB_DIRS as readonly string[]).includes(value);
}

async function ensureDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

function safeSegment(raw: string): string | null {
	const decoded = decodeURIComponent(raw);
	if (
		!decoded ||
		decoded.includes("..") ||
		decoded.includes("/") ||
		decoded.includes("\\")
	) {
		return null;
	}
	return decoded;
}

function json(
	res: import("node:http").ServerResponse,
	status: number,
	body: unknown,
): void {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(body));
}

function text(
	res: import("node:http").ServerResponse,
	status: number,
	body: string,
): void {
	res.statusCode = status;
	res.setHeader("Content-Type", "text/plain; charset=utf-8");
	res.end(body);
}

async function readBody(
	req: import("node:http").IncomingMessage,
): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

async function readJsonContent(
	req: import("node:http").IncomingMessage,
): Promise<string | null> {
	const body = await readBody(req);
	if (!body) return null;
	try {
		const parsed = JSON.parse(body) as { content?: string };
		return typeof parsed.content === "string" ? parsed.content : null;
	} catch {
		return null;
	}
}

async function isDirEmpty(dir: string): Promise<boolean> {
	if (!existsSync(dir)) return true;
	const entries = await fs.readdir(dir);
	return entries.length === 0;
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
	await fs.cp(src, dest, { recursive: true });
}

async function ensureDemoSeeded(): Promise<void> {
	if (!existsSync(SEED_DIR)) {
		// seed が無い場合は何もしない（dev 環境外で動かしている可能性）
		await ensureDir(DEMO_MEMBERS_DIR);
		return;
	}
	if (await isDirEmpty(DEMO_MEMBERS_DIR)) {
		await ensureDir(path.dirname(DEMO_MEMBERS_DIR));
		await copyDirRecursive(SEED_DIR, DEMO_MEMBERS_DIR);
		console.log(
			`[fs-api] seeded demo-members from ${path.relative(process.cwd(), SEED_DIR)}`,
		);
	}
}

function parseMode(url: string): "real" | "demo" {
	const queryStart = url.indexOf("?");
	if (queryStart < 0) return "real";
	const params = new URLSearchParams(url.slice(queryStart + 1));
	return params.get("mode") === "demo" ? "demo" : "real";
}

async function resolveMembersDir(mode: "real" | "demo"): Promise<string> {
	if (mode === "demo") {
		await ensureDemoSeeded();
		return DEMO_MEMBERS_DIR;
	}
	return MEMBERS_DIR;
}

export function fsApiPlugin(): Plugin {
	return {
		name: "fs-api",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url ?? "";
				if (!url.startsWith("/api/fs/")) {
					next();
					return;
				}

				const method = (req.method ?? "GET").toUpperCase();
				const parts = url.split("?")[0].split("/").filter(Boolean);
				// parts: ["api", "fs", "members", ...rest]
				const mode = parseMode(url);

				try {
					if (parts[2] !== "members") {
						return text(res, 404, "fs-api route not found");
					}

					const membersDir = await resolveMembersDir(mode);
					await ensureDir(membersDir);

					// GET /api/fs/members → { profiles: [{ id, content }] }
					if (parts.length === 3 && method === "GET") {
						const entries = await fs.readdir(membersDir, {
							withFileTypes: true,
						});
						const profiles: { id: string; content: string }[] = [];
						for (const entry of entries) {
							if (!entry.isDirectory()) continue;
							const profilePath = path.join(
								membersDir,
								entry.name,
								"profile.md",
							);
							if (!existsSync(profilePath)) continue;
							const content = await fs.readFile(profilePath, "utf-8");
							profiles.push({ id: entry.name, content });
						}
						return json(res, 200, { profiles });
					}

					if (parts.length < 4) {
						return text(res, 404, "fs-api route not found");
					}

					const memberId = safeSegment(parts[3]);
					if (!memberId) {
						return text(res, 400, "invalid member id");
					}
					const memberDir = path.join(membersDir, memberId);

					// DELETE /api/fs/members/:id
					if (parts.length === 4 && method === "DELETE") {
						if (!existsSync(memberDir)) {
							return text(res, 404, "not found");
						}
						await fs.rm(memberDir, { recursive: true, force: true });
						res.statusCode = 204;
						return res.end();
					}

					// GET /api/fs/members/:id/profile
					if (
						parts.length === 5 &&
						parts[4] === "profile" &&
						method === "GET"
					) {
						const profilePath = path.join(memberDir, "profile.md");
						if (!existsSync(profilePath)) {
							return text(res, 404, "not found");
						}
						const content = await fs.readFile(profilePath, "utf-8");
						return json(res, 200, { content });
					}

					// PUT /api/fs/members/:id/profile
					if (
						parts.length === 5 &&
						parts[4] === "profile" &&
						method === "PUT"
					) {
						const content = await readJsonContent(req);
						if (content === null) {
							return text(res, 400, "content required");
						}
						await ensureDir(memberDir);
						await fs.writeFile(
							path.join(memberDir, "profile.md"),
							content,
							"utf-8",
						);
						return json(res, 200, { ok: true });
					}

					// Sub-directory endpoints (goals / one-on-one / reviews)
					if (parts.length >= 5 && isSubDir(parts[4])) {
						const subDir = path.join(memberDir, parts[4]);

						// GET /api/fs/members/:id/:sub → { files: [{ name, content }] }
						if (parts.length === 5 && method === "GET") {
							if (!existsSync(subDir)) {
								return json(res, 200, { files: [] });
							}
							const entries = await fs.readdir(subDir, { withFileTypes: true });
							const files: { name: string; content: string }[] = [];
							for (const entry of entries) {
								if (!entry.isFile()) continue;
								if (!entry.name.endsWith(".md")) continue;
								const filePath = path.join(subDir, entry.name);
								const content = await fs.readFile(filePath, "utf-8");
								files.push({
									name: entry.name.replace(/\.md$/, ""),
									content,
								});
							}
							return json(res, 200, { files });
						}

						// PUT /api/fs/members/:id/:sub/:key
						if (parts.length === 6 && method === "PUT") {
							const key = safeSegment(parts[5]);
							if (!key) {
								return text(res, 400, "invalid key");
							}
							const content = await readJsonContent(req);
							if (content === null) {
								return text(res, 400, "content required");
							}
							await ensureDir(subDir);
							await fs.writeFile(
								path.join(subDir, `${key}.md`),
								content,
								"utf-8",
							);
							return json(res, 200, { ok: true });
						}
					}

					return text(res, 404, "fs-api route not found");
				} catch (err) {
					console.error("[fs-api] error:", err);
					return text(
						res,
						500,
						err instanceof Error ? err.message : "internal error",
					);
				}
			});
		},
	};
}
