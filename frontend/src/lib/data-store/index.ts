import { isTauri } from "./detect";
import { devMembersStore } from "./dev-http";
import type { DataStore, MembersStore } from "./types";

// tauri-fs.ts は @tauri-apps/* を import するため、ブラウザ dev 環境では
// モジュール解決を行わないよう動的 import で遅延ロードする。
let cachedMembersStore: MembersStore | null = null;

async function getMembersStore(): Promise<MembersStore> {
	if (cachedMembersStore) return cachedMembersStore;
	if (isTauri()) {
		const mod = await import("./tauri-fs");
		cachedMembersStore = mod.tauriMembersStore;
	} else {
		cachedMembersStore = devMembersStore;
	}
	return cachedMembersStore;
}

export const dataStore: DataStore = {
	members: {
		list: async () => (await getMembersStore()).list(),
		get: async (id: string) => (await getMembersStore()).get(id),
		create: async (input) => (await getMembersStore()).create(input),
		remove: async (id: string) => (await getMembersStore()).remove(id),
	},
};

export type { MemberCreateInput } from "./types";
