import { useReducer, useState } from "react";
import { PolicyStepComplete } from "./PolicyStepComplete";
import { PolicyStepper } from "./PolicyStepper";
import { PolicyStep1Year } from "./steps/PolicyStep1Year";
import { PolicyStep2AReview } from "./steps/PolicyStep2AReview";
import { PolicyStep2BCurrentState } from "./steps/PolicyStep2BCurrentState";
import { PolicyStep3AThemes } from "./steps/PolicyStep3AThemes";
import { PolicyStep3BUpperPolicy } from "./steps/PolicyStep3BUpperPolicy";
import { PolicyStep4Direction } from "./steps/PolicyStep4Direction";
import { PolicyStep5Draft } from "./steps/PolicyStep5Draft";
import { PolicyStep6Refine } from "./steps/PolicyStep6Refine";
import { PolicyStep7Confirm } from "./steps/PolicyStep7Confirm";

// ---- Types (exported for step components) ----

export type PolicyFlowMode = "continuous" | "initial";

export interface PolicyWizardState {
	currentStep: number; // 1-8 (8=complete)
	flowMode: PolicyFlowMode | null;
	targetYear: number;
	baseYear: number;
	baseContent: string;
	// Continuous flow (Step2A, Step3A)
	review: { whatWorked: string; whatDidntWork: string; leftBehind: string };
	continuousThemes: {
		envChanges: string;
		techChanges: string;
		focusThemes: string;
	};
	// Initial flow (Step2B, Step3B)
	currentState: {
		teamInfo: string;
		techDomains: string;
		challenges: string;
		strengths: string;
		mission: string;
		themes: string;
	};
	upperPolicy: string;
	// Common (Step4+)
	direction: string | null;
	aiDraft: string | null;
	currentDraft: string;
	saved: boolean;
}

type Action =
	| {
			type: "SET_FLOW_MODE";
			payload: {
				targetYear: number;
				flowMode: PolicyFlowMode;
				baseContent: string;
			};
	  }
	| {
			type: "SET_REVIEW";
			payload: {
				whatWorked: string;
				whatDidntWork: string;
				leftBehind: string;
			};
	  }
	| {
			type: "SET_CURRENT_STATE";
			payload: {
				teamInfo: string;
				techDomains: string;
				challenges: string;
				strengths: string;
				mission: string;
				themes: string;
			};
	  }
	| {
			type: "SET_CONTINUOUS_THEMES";
			payload: {
				envChanges: string;
				techChanges: string;
				focusThemes: string;
			};
	  }
	| { type: "SET_UPPER_POLICY"; payload: string }
	| { type: "SET_DIRECTION"; payload: string }
	| { type: "SET_AI_DRAFT"; payload: string }
	| { type: "UPDATE_DRAFT"; payload: string }
	| { type: "CONFIRM_DRAFT"; payload: string }
	| { type: "MARK_SAVED" }
	| { type: "PREV_STEP" };

const initialState: PolicyWizardState = {
	currentStep: 1,
	flowMode: null,
	targetYear: 0,
	baseYear: 0,
	baseContent: "",
	review: { whatWorked: "", whatDidntWork: "", leftBehind: "" },
	continuousThemes: { envChanges: "", techChanges: "", focusThemes: "" },
	currentState: {
		teamInfo: "",
		techDomains: "",
		challenges: "",
		strengths: "",
		mission: "",
		themes: "",
	},
	upperPolicy: "",
	direction: null,
	aiDraft: null,
	currentDraft: "",
	saved: false,
};

function reducer(state: PolicyWizardState, action: Action): PolicyWizardState {
	switch (action.type) {
		case "SET_FLOW_MODE": {
			const { targetYear, flowMode, baseContent } = action.payload;
			const baseYear = targetYear - 1;
			// Clear opposite flow's fields
			if (flowMode === "continuous") {
				return {
					...state,
					currentStep: 2,
					flowMode,
					targetYear,
					baseYear,
					baseContent,
					currentState: {
						teamInfo: "",
						techDomains: "",
						challenges: "",
						strengths: "",
						mission: "",
						themes: "",
					},
					upperPolicy: "",
					direction: null,
					aiDraft: null,
					currentDraft: "",
				};
			}
			return {
				...state,
				currentStep: 2,
				flowMode,
				targetYear,
				baseYear,
				baseContent,
				review: { whatWorked: "", whatDidntWork: "", leftBehind: "" },
				continuousThemes: {
					envChanges: "",
					techChanges: "",
					focusThemes: "",
				},
				direction: null,
				aiDraft: null,
				currentDraft: "",
			};
		}
		case "SET_REVIEW":
			return { ...state, review: action.payload, currentStep: 3 };
		case "SET_CURRENT_STATE":
			return { ...state, currentState: action.payload, currentStep: 3 };
		case "SET_CONTINUOUS_THEMES":
			return {
				...state,
				continuousThemes: action.payload,
				currentStep: 4,
				direction: null,
				aiDraft: null,
			};
		case "SET_UPPER_POLICY":
			return {
				...state,
				upperPolicy: action.payload,
				currentStep: 4,
				direction: null,
				aiDraft: null,
			};
		case "SET_DIRECTION":
			return {
				...state,
				direction: action.payload,
				currentStep: 5,
				aiDraft: null,
			};
		case "SET_AI_DRAFT":
			return {
				...state,
				aiDraft: action.payload,
				currentDraft: action.payload,
				currentStep: 6,
			};
		case "UPDATE_DRAFT":
			return { ...state, currentDraft: action.payload };
		case "CONFIRM_DRAFT":
			return { ...state, currentDraft: action.payload, currentStep: 7 };
		case "MARK_SAVED":
			return { ...state, saved: true, currentStep: 8 };
		case "PREV_STEP": {
			const prevStep = Math.max(1, state.currentStep - 1);
			// When going back from Step4+, clear direction and aiDraft
			if (state.currentStep >= 4) {
				return {
					...state,
					currentStep: prevStep,
					direction: null,
					aiDraft: null,
				};
			}
			return { ...state, currentStep: prevStep };
		}
		default:
			return state;
	}
}

interface PolicyWizardProps {
	availableYears: number[];
	criteria?: string;
	guidelines?: string;
	onClose: () => void;
}

export function PolicyWizard({
	availableYears,
	criteria: _criteria,
	guidelines: _guidelines,
	onClose,
}: PolicyWizardProps) {
	const [state, dispatch] = useReducer(reducer, initialState);
	const [showExitConfirm, setShowExitConfirm] = useState(false);

	const handleClose = () => {
		// Show confirmation if user has entered data (Step2+)
		if (state.currentStep >= 2 && !state.saved) {
			setShowExitConfirm(true);
		} else {
			onClose();
		}
	};

	const renderStep = () => {
		switch (state.currentStep) {
			case 1:
				return (
					<PolicyStep1Year
						availableYears={availableYears}
						onNext={(targetYear, flowMode, baseContent) =>
							dispatch({
								type: "SET_FLOW_MODE",
								payload: { targetYear, flowMode, baseContent },
							})
						}
					/>
				);
			case 2:
				if (state.flowMode === "continuous") {
					return (
						<PolicyStep2AReview
							onNext={(data) => dispatch({ type: "SET_REVIEW", payload: data })}
							onBack={() => dispatch({ type: "PREV_STEP" })}
						/>
					);
				}
				return (
					<PolicyStep2BCurrentState
						onNext={(data) =>
							dispatch({ type: "SET_CURRENT_STATE", payload: data })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 3:
				if (state.flowMode === "continuous") {
					return (
						<PolicyStep3AThemes
							onNext={(data) =>
								dispatch({
									type: "SET_CONTINUOUS_THEMES",
									payload: data,
								})
							}
							onBack={() => dispatch({ type: "PREV_STEP" })}
						/>
					);
				}
				return (
					<PolicyStep3BUpperPolicy
						onNext={(policy) =>
							dispatch({ type: "SET_UPPER_POLICY", payload: policy })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 4:
				return (
					<PolicyStep4Direction
						state={state}
						onConfirm={(direction) =>
							dispatch({ type: "SET_DIRECTION", payload: direction })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 5:
				return (
					<PolicyStep5Draft
						state={state}
						onDraftGenerated={(draft) =>
							dispatch({ type: "SET_AI_DRAFT", payload: draft })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 6:
				return (
					<PolicyStep6Refine
						state={state}
						onContentUpdate={(content) =>
							dispatch({ type: "UPDATE_DRAFT", payload: content })
						}
						onNext={(finalContent) =>
							dispatch({ type: "CONFIRM_DRAFT", payload: finalContent })
						}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 7:
				return (
					<PolicyStep7Confirm
						state={state}
						onSave={() => dispatch({ type: "MARK_SAVED" })}
						onBack={() => dispatch({ type: "PREV_STEP" })}
					/>
				);
			case 8:
				return (
					<PolicyStepComplete targetYear={state.targetYear} onClose={onClose} />
				);
			default:
				return null;
		}
	};

	const headerTitle =
		state.targetYear > 0
			? `${state.targetYear}年度 組織方針の作成`
			: "組織方針の作成";

	return (
		<div className="fixed inset-0 left-80 z-50 bg-white flex flex-col border-t-2 border-brand-500">
			{/* Header */}
			<div className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white">
				<h1 className="text-3xl font-bold text-brand-900">{headerTitle}</h1>
				<button
					type="button"
					onClick={handleClose}
					className="text-gray-400 hover:text-gray-700 transition-colors text-xl font-medium"
				>
					✕ 閉じる
				</button>
			</div>

			{/* Stepper */}
			{state.currentStep <= 7 && (
				<div className="px-10 py-5 border-b border-gray-100 bg-[#FAFBFC]">
					<PolicyStepper
						currentStep={state.currentStep}
						flowMode={state.flowMode}
					/>
				</div>
			)}

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{state.currentStep === 6 ? (
					<div className="h-full">{renderStep()}</div>
				) : (
					<div className="max-w-[1400px] mx-auto px-10 py-8">
						{renderStep()}
					</div>
				)}
			</div>

			{/* Exit confirmation dialog */}
			{showExitConfirm && (
				<div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center">
					<div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
						<h3 className="text-xl font-bold text-gray-800 mb-3">
							作成を中止しますか？
						</h3>
						<p className="text-lg text-gray-500 mb-6">
							入力した内容は保存されません。
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => setShowExitConfirm(false)}
								className="flex-1 py-3 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
							>
								続ける
							</button>
							<button
								type="button"
								onClick={onClose}
								className="flex-1 py-3 text-xl bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
							>
								中止する
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
