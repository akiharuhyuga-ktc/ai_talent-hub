import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

export function MarkdownRenderer({
	content,
	className,
}: MarkdownRendererProps) {
	const normalized = content
		.replace(/([^\n])([　\s]*└)/g, "$1\n$2")
		.replace(/^[　\s]*└\s*/gm, "- ");

	return (
		<div
			className={`prose prose-xl max-w-none prose-headings:text-gray-900 prose-a:text-brand-600 prose-td:text-xl prose-th:text-xl ${className ?? ""}`}
		>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
		</div>
	);
}
