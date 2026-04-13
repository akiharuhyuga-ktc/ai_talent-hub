import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface UseChatOptions {
	memberName?: string;
	memberContext?: string;
}

export function useChat({ memberName, memberContext }: UseChatOptions = {}) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [mode, setMode] = useState<"mock" | "live" | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	const sendMessage = useCallback(
		async (content: string) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			const userMessage: ChatMessage = { role: "user", content };
			const nextMessages = [...messagesRef.current, userMessage];
			setMessages(nextMessages);
			setIsLoading(true);

			setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

			try {
				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						messages: nextMessages,
						memberName,
						memberContext,
					}),
					signal: controller.signal,
				});

				if (
					!res.ok ||
					!res.headers.get("content-type")?.includes("text/event-stream")
				) {
					const data = await res
						.json()
						.catch(() => ({ error: `HTTP ${res.status}` }));
					throw new Error(data.error || `HTTP ${res.status}`);
				}

				setMode("live");
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
							if (parsed.text) {
								fullText += parsed.text;
								setMessages((prev) => {
									const updated = [...prev];
									updated[updated.length - 1] = {
										role: "assistant",
										content: fullText,
									};
									return updated;
								});
							}
						} catch (_err) {
							// ignore parse errors
						}
					}
				}
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setMessages((prev) => {
					const updated = [...prev];
					updated[updated.length - 1] = {
						role: "assistant",
						content:
							"エラーが発生しました。しばらくしてから再度お試しください。",
					};
					return updated;
				});
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[memberName, memberContext],
	);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		setMessages([]);
		setMode(null);
	}, []);

	return { messages, isLoading, mode, sendMessage, reset };
}
