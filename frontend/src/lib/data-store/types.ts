import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import type { GoalsData, OneOnOneRecord, ReviewData } from "@/lib/types";

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

export interface GoalsStore {
	listForMember(memberId: string): Promise<GoalsData[]>;
	save(memberId: string, period: string, content: string): Promise<void>;
}

export interface OneOnOnesStore {
	listForMember(memberId: string): Promise<OneOnOneRecord[]>;
	save(memberId: string, yearMonth: string, content: string): Promise<void>;
}

export interface ReviewsStore {
	listForMember(memberId: string): Promise<ReviewData[]>;
	save(memberId: string, period: string, content: string): Promise<void>;
}

export interface DataStore {
	members: MembersStore;
	goals: GoalsStore;
	oneOnOnes: OneOnOnesStore;
	reviews: ReviewsStore;
}
