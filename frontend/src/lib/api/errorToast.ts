import { AxiosError } from "axios";
import { toast } from "sonner";

// 401 は AuthContext 側でセッション切れダイアログが出るのでトーストは抑止する。
const SUPPRESSED_STATUSES = new Set([401]);

export function showApiErrorToast(error: unknown): void {
	// ユーザー中断 (AbortController) は通知しない
	if (error instanceof Error && error.name === "AbortError") return;
	// AiProxyError は name で識別 (循環依存を避けるため instanceof は使わない)
	if (
		error instanceof Error &&
		error.name === "AiProxyError" &&
		isSuppressedAiProxyError(error)
	) {
		return;
	}

	const { title, description } = formatError(error);
	if (title == null) return;
	toast.error(title, { description });
}

function isSuppressedAiProxyError(error: Error): boolean {
	const status = (error as Error & { status?: number }).status;
	return status != null && SUPPRESSED_STATUSES.has(status);
}

function formatError(error: unknown): {
	title: string | null;
	description?: string;
} {
	if (error instanceof AxiosError) {
		const status = error.response?.status;
		if (status != null && SUPPRESSED_STATUSES.has(status)) {
			return { title: null };
		}
		const method = error.config?.method?.toUpperCase() ?? "REQUEST";
		const url = error.config?.url ?? "(unknown url)";
		const statusText = error.response?.statusText ?? error.code ?? "Error";
		const title = status
			? `${status} ${statusText}`
			: `${statusText} (${error.message})`;
		const description = `${method} ${url}`;
		return { title, description };
	}
	if (error instanceof Error) {
		return { title: error.message };
	}
	return { title: "予期しないエラーが発生しました" };
}
