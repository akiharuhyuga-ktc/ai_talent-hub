import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Dev-only Vite middleware that persists members under data/v1/ on host FS.
 *
 * Endpoints:
 *   GET    /api/fs/members                        → list member directory names
 *   GET    /api/fs/members/:name/profile          → read profile.md
 *   PUT    /api/fs/members/:name/profile          → write profile.md (body: { content })
 *   DELETE /api/fs/members/:name                  → recursive delete member dir
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

async function ensureDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

function resolveMemberDir(rawName: string): string | null {
	const name = decodeURIComponent(rawName);
	if (
		!name ||
		name.includes("..") ||
		name.includes("/") ||
		name.includes("\\")
	) {
		return null;
	}
	return path.join(MEMBERS_DIR, name);
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
					if (parts[2] === "members") {
						await ensureDir(MEMBERS_DIR);

						// GET /api/fs/members → [{ name, content }]
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

						if (parts.length >= 4) {
							const memberDir = resolveMemberDir(parts[3]);
							if (!memberDir) {
								return text(res, 400, "invalid member name");
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
								const body = await readBody(req);
								const parsed = body
									? (JSON.parse(body) as { content?: string })
									: {};
								if (typeof parsed.content !== "string") {
									return text(res, 400, "content required");
								}
								await ensureDir(memberDir);
								await fs.writeFile(
									path.join(memberDir, "profile.md"),
									parsed.content,
									"utf-8",
								);
								return json(res, 200, { ok: true });
							}

							// DELETE /api/fs/members/:name
							if (parts.length === 4 && method === "DELETE") {
								if (!existsSync(memberDir)) {
									return text(res, 404, "not found");
								}
								await fs.rm(memberDir, { recursive: true, force: true });
								res.statusCode = 204;
								return res.end();
							}
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
