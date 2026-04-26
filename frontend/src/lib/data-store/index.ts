import { isTauri } from "./detect";
import {
	devGoalsStore,
	devMembersStore,
	devOneOnOnesStore,
	devReviewsStore,
} from "./dev-http";
import type {
	DataStore,
	GoalsStore,
	MembersStore,
	OneOnOnesStore,
	ReviewsStore,
} from "./types";

// tauri-fs.ts は @tauri-apps/* を import するため、ブラウザ dev 環境では
// モジュール解決を行わないよう動的 import で遅延ロードする。

interface CachedStores {
	members: MembersStore;
	goals: GoalsStore;
	oneOnOnes: OneOnOnesStore;
	reviews: ReviewsStore;
}

let cached: CachedStores | null = null;

async function getStores(): Promise<CachedStores> {
	if (cached) return cached;
	if (isTauri()) {
		const mod = await import("./tauri-fs");
		cached = {
			members: mod.tauriMembersStore,
			goals: mod.tauriGoalsStore,
			oneOnOnes: mod.tauriOneOnOnesStore,
			reviews: mod.tauriReviewsStore,
		};
	} else {
		cached = {
			members: devMembersStore,
			goals: devGoalsStore,
			oneOnOnes: devOneOnOnesStore,
			reviews: devReviewsStore,
		};
	}
	return cached;
}

export const dataStore: DataStore = {
	members: {
		list: async () => (await getStores()).members.list(),
		get: async (id: string) => (await getStores()).members.get(id),
		create: async (input) => (await getStores()).members.create(input),
		remove: async (id: string) => (await getStores()).members.remove(id),
	},
	goals: {
		listForMember: async (memberId) =>
			(await getStores()).goals.listForMember(memberId),
		save: async (memberId, period, content) =>
			(await getStores()).goals.save(memberId, period, content),
	},
	oneOnOnes: {
		listForMember: async (memberId) =>
			(await getStores()).oneOnOnes.listForMember(memberId),
		save: async (memberId, yearMonth, content) =>
			(await getStores()).oneOnOnes.save(memberId, yearMonth, content),
	},
	reviews: {
		listForMember: async (memberId) =>
			(await getStores()).reviews.listForMember(memberId),
		save: async (memberId, period, content) =>
			(await getStores()).reviews.save(memberId, period, content),
	},
};

export type { MemberCreateInput } from "./types";
