import { useCallback, useRef, useState } from "react";

interface UseStreamingTextOptions {
	onComplete?: (fullText: string) => void;
}

interface UseStreamingTextReturn {
	text: string;
	isStreaming: boolean;
	error: string;
	startStream: (url: string, body: Record<string, unknown>) => void;
	cancel: () => void;
}

export function useStreamingText(
	options: UseStreamingTextOptions = {},
): UseStreamingTextReturn {
	const [text, setText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const cancel = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
	}, []);

	const startStream = useCallback(
		(url: string, body: Record<string, unknown>) => {
			cancel();

			const controller = new AbortController();
			abortRef.current = controller;

			setText("");
			setError("");
			setIsStreaming(true);

			(async () => {
				try {
					const res = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
						signal: controller.signal,
					});

					if (
						!res.ok ||
						!res.headers.get("content-type")?.includes("text/event-stream")
					) {
						const data = await res
							.json()
							.catch(() => ({ error: `HTTP ${res.status}` }));
						setError(data.error || `HTTP ${res.status}`);
						setIsStreaming(false);
						return;
					}

					const reader = res.body?.getReader();
					if (!reader) return;
					const decoder = new TextDecoder();
					let buffer = "";
					let fullText = "";

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split("\n");
						buffer = lines.pop() || "";

						for (const line of lines) {
							if (!line.startsWith("data: ")) continue;
							const data = line.slice(6).trim();

							if (data === "[DONE]") continue;

							try {
								const parsed = JSON.parse(data);
								if (parsed.error) {
									setError(parsed.error);
									setIsStreaming(false);
									return;
								}
								if (parsed.text) {
									fullText += parsed.text;
									setText(fullText);
								}
							} catch (_err) {
								// ignore parse errors
							}
						}
					}

					options.onComplete?.(fullText);
				} catch (err) {
					if ((err as Error).name !== "AbortError") {
						setError("通信エラーが発生しました");
					}
				} finally {
					setIsStreaming(false);
					abortRef.current = null;
				}
			})();
		},
		[cancel, options],
	);

	return { text, isStreaming, error, startStream, cancel };
}
