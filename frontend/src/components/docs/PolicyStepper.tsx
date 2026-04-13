import { Check } from "lucide-react";

type FlowMode = "continuous" | "initial" | null;

const LABELS: Record<"continuous" | "initial", string[]> = {
	continuous: [
		"年度選択",
		"前年度振返り",
		"来期テーマ",
		"AI方向性",
		"AI草案",
		"壁打ち",
		"確認・保存",
	],
	initial: [
		"年度選択",
		"現状把握",
		"上位方針",
		"AI骨格",
		"AI草案",
		"壁打ち",
		"確認・保存",
	],
};

const PLACEHOLDER_LABELS = [
	"年度選択",
	"...",
	"...",
	"...",
	"...",
	"...",
	"...",
];

interface PolicyStepperProps {
	currentStep: number;
	flowMode: FlowMode;
}

export function PolicyStepper({ currentStep, flowMode }: PolicyStepperProps) {
	const labels = flowMode ? LABELS[flowMode] : PLACEHOLDER_LABELS;

	return (
		<div className="flex items-center justify-center gap-1">
			{labels.map((label, i) => {
				const stepNum = i + 1;
				const isActive = stepNum === currentStep;
				const isDone = stepNum < currentStep;
				return (
					<div key={i} className="flex items-center">
						<div className="flex flex-col items-center">
							<div
								className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-colors ${
									isActive
										? "bg-brand-600 text-white border-brand-600 shadow-[0_0_0_4px_rgba(25,112,140,0.2)]"
										: isDone
											? "bg-brand-100 text-brand-600 border-brand-300"
											: "bg-gray-100 text-gray-400 border-gray-200"
								}`}
							>
								{isDone ? <Check size={16} /> : stepNum}
							</div>
							<span
								className={`text-lg mt-1 whitespace-nowrap ${isActive ? "text-brand-600 font-semibold" : "text-gray-400"}`}
							>
								{label}
							</span>
						</div>
						{i < labels.length - 1 && (
							<div
								className={`w-10 h-0.5 mx-1 mb-6 ${stepNum < currentStep ? "bg-brand-300" : "bg-gray-200"}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
