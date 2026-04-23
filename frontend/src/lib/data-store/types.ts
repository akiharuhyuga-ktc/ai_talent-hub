import type { MemberRecord, MemberSummary } from "@/api/generated/types";

export type MemberCreateInput = {
	name: string;
	role: string;
	team: string;
	teamShort: string;
	joinedAt: string;
	mainProject?: string;
	rdPct?: number;
};

export interface MembersStore {
	list(): Promise<MemberSummary[]>;
	get(id: string): Promise<MemberRecord | null>;
	create(input: MemberCreateInput): Promise<MemberRecord>;
	remove(id: string): Promise<void>;
}

export interface DataStore {
	members: MembersStore;
}
