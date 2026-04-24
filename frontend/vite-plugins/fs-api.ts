import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Dev-only Vite middleware that persists members under data/v1/ on host FS.
 *
 * Endpoints:
 *   GET    /api/fs/members                                → list member profiles
 *   GET    /api/fs/members/:name/profile                  → read profile.md
 *   PUT    /api/fs/members/:name/profile                  → write profile.md (body: { content })
 *   DELETE /api/fs/members/:name                          → recursive delete member dir
 *
 *   GET    /api/fs/members/:name/goals                    → list goals/*.md
 *   PUT    /api/fs/members/:name/goals/:period            → write goals/{period}.md
 *   GET    /api/fs/members/:name/one-on-one               → list one-on-one/*.md
 *   PUT    /api/fs/members/:name/one-on-one/:yearMonth    → write one-on-one/{YYYY-MM}.md
 *   GET    /api/fs/members/:name/reviews                  → list reviews/*.md
 *   PUT    /api/fs/members/:name/reviews/:period          → write reviews/{period}.md
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

				try {
					if (parts[2] !== "members") {
						return text(res, 404, "fs-api route not found");
					}

					await ensureDir(MEMBERS_DIR);

					// GET /api/fs/members → { profiles: [{ name, content }] }
					if (parts.length === 3 && method === "GET") {
						const entries = await fs.readdir(MEMBERS_DIR, {
							withFileTypes: true,
						});
						const profiles: { name: string; content: string }[] = [];
						for (const entry of entries) {
							if (!entry.isDirectory()) continue;
							const profilePath = path.join(
								MEMBERS_DIR,
								entry.name,
								"profile.md",
							);
							if (!existsSync(profilePath)) continue;
							const content = await fs.readFile(profilePath, "utf-8");
							profiles.push({ name: entry.name, content });
						}
						return json(res, 200, { profiles });
					}

					if (parts.length < 4) {
						return text(res, 404, "fs-api route not found");
					}

					const memberName = safeSegment(parts[3]);
					if (!memberName) {
						return text(res, 400, "invalid member name");
					}
					const memberDir = path.join(MEMBERS_DIR, memberName);

					// DELETE /api/fs/members/:name
					if (parts.length === 4 && method === "DELETE") {
						if (!existsSync(memberDir)) {
							return text(res, 404, "not found");
						}
						await fs.rm(memberDir, { recursive: true, force: true });
						res.statusCode = 204;
						return res.end();
					}

					// GET /api/fs/members/:name/profile
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

					// PUT /api/fs/members/:name/profile
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

						// GET /api/fs/members/:name/:sub → { files: [{ name, content }] }
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

						// PUT /api/fs/members/:name/:sub/:key
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
