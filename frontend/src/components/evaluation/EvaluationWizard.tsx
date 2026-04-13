import { useReducer } from "react";
import type {
	EvaluationDraft,
	EvaluationWizardContextData,
	EvaluationWizardState,
	ManagerSupplementary,
	SelfEvaluation,
} from "@/lib/types";
import { getActivePeriod } from "@/lib/utils/period";
import { EvalCompletionScreen } from "./EvalCompletionScreen";
import { EvaluationStepper } from "./EvaluationStepper";
import { EvalStep1Materials } from "./steps/EvalStep1Materials";
import { EvalStep2AIDraft } from "./steps/EvalStep2AIDraft";
import { EvalStep3Review } from "./steps/EvalStep3Review";
import { EvalStep4Comment } from "./steps/EvalStep4Comment";

type Action =
	| {
			type: "SET_MATERIALS";
			payload: {
				selfEvaluation: SelfEvaluation;
				managerSupplementary: ManagerSupplementary;
			};
	  }
	| { type: "SET_AI_DRAFT"; payload: EvaluationDraft }
	| { type: "SET_CONFIRMED_DRAFT"; payload: EvaluationDraft }
	| { type: "SET_COMMENT"; payload: string }
	| { type: "NEXT_STEP" }
	| { type: "PREV_STEP" }
	| { type: "GO_TO_STEP"; payload: number };

function derivePeriod(goalsRawMarkdown: string | null): string {
	if (goalsRawMarkdown) {
		// Try to extract period from goals filename pattern like "2026-h1"
		const match = goalsRawMarkdown.match(/(\d{4})[年-]?(h[12]|上期|下期)/);
		if (match) {
			const year = match[1];
			const half = match[2] === "上期" || match[2] === "h1" ? "h1" : "h2";
			return `${year}-${half}`;
		}
	}
	return getActivePeriod();
}

function createInitialState(period: string): EvaluationWizardState {
	return {
		currentStep: 1,
		period,
		selfEvaluation: {
			score: "",
			achievementComment: "",
			reflectionComment: "",
		},
		managerSupplementary: { notableEpisodes: "", environmentChanges: "" },
		aiDraft: null,
		confirmedDraft: null,
		evaluatorComment: "",
		aiCommentDraft: null,
	};
}

function reducer(
	state: EvaluationWizardState,
	action: Action,
): EvaluationWizardState {
	switch (action.type) {
		case "SET_MATERIALS":
			return {
				...state,
				selfEvaluation: action.payload.selfEvaluation,
				managerSupplementary: action.payload.managerSupplementary,
				currentStep: 2,
			};
		case "SET_AI_DRAFT":
			return {
				...state,
				aiDraft: action.payload,
				currentStep: 3,
			};
		case "SET_CONFIRMED_DRAFT":
			return {
				...state,
				confirmedDraft: action.payload,
				currentStep: 4,
			};
		case "SET_COMMENT":
			return {
				...state,
				evaluatorComment: action.payload,
				currentStep: 5,
			};
		case "NEXT_STEP":
			return { ...state, currentStep: state.currentStep + 1 };
		case "PREV_STEP":
			return { ...state, currentStep: Math.max(1, state.currentStep - 1) };
		case "GO_TO_STEP":
			return { ...state, currentStep: action.payload };
		default:
			return state;
	}
}

interface EvaluationWizardProps {
	context: EvaluationWizardContextData;
	onClose: () => void;
}

export function EvaluationWizard({ context, onClose }: EvaluationWizardProps) {
	const period = derivePeriod(context.goalsRawMarkdown);
	const [state, dispatch] = useReducer(reducer, period, createInitialState);

	const renderStep = () => {
		switch (state.currentStep) {
			case 1:
				return (
					<EvalStep1Materials
						state={state}
						context={context}
						onNext={(selfEval, supplement) =>
							dispatch({
								type: "SET_MATERIALS",
								payload: {
									selfEvaluation: selfEval,
									managerSupplementary: supplement,
								},
							})
						}
					/>
				);
			case 2:
				return (
					<EvalStep2AIDraft
						state={state}
						context={context}
						onDraftGenerated={(draft) =>
							dispatch({ type: "SET_AI_DRAFT", payload: draft })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 3:
				return (
					<EvalStep3Review
						state={state}
						onConfirm={(draft) =>
							dispatch({
								type: "SET_CONFIRMED_DRAFT",
								payload: draft,
							})
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 4:
				return (
					<EvalStep4Comment
						state={state}
						context={context}
						onComplete={(comment) =>
							dispatch({ type: "SET_COMMENT", payload: comment })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 5:
				return (
					<EvalCompletionScreen
						state={state}
						context={context}
						onClose={onClose}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="fixed inset-0 left-80 z-50 bg-white flex flex-col border-t-2 border-brand-500">
			{/* Header */}
			<div className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white">
				<h1 className="text-3xl font-bold text-brand-900">
					{context.memberName}さんの評価（{period}）
				</h1>
				<button
					type="button"
					onClick={onClose}
					className="text-gray-400 hover:text-gray-700 transition-colors text-xl font-medium"
				>
					✕ 閉じる
				</button>
			</div>

			{/* Stepper */}
			{state.currentStep <= 4 && (
				<div className="px-10 py-5 border-b border-gray-100 bg-[#FAFBFC]">
					<EvaluationStepper currentStep={state.currentStep} />
				</div>
			)}

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-[1400px] mx-auto px-10 py-8">{renderStep()}</div>
			</div>
		</div>
	);
}
