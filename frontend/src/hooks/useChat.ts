import { useCallback, useRef, useState } from "react";
import { requestChat } from "@/lib/ai/client";
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
				setMode("live");
				await requestChat(
					{
						messages: nextMessages,
						memberName,
						memberContext,
					},
					{
						signal: controller.signal,
						onText: (cumulative) => {
							setMessages((prev) => {
								const updated = [...prev];
								updated[updated.length - 1] = {
									role: "assistant",
									content: cumulative,
								};
								return updated;
							});
						},
					},
				);
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
