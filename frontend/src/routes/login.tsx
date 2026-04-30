import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isAuthConfigured } from "@/lib/auth/config";

interface LoginSearch {
	redirect?: string;
}

// `redirect` は同一オリジン内の絶対パスのみ許可。
// `https://...` / `//evil.com` / `\\evil.com` などのオリジン跨ぎを弾いて open redirect を防ぐ。
function sanitizeRedirect(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	if (!value.startsWith("/")) return undefined;
	if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
	return value;
}

export const Route = createFileRoute("/login")({
	validateSearch: (search): LoginSearch => ({
		redirect: sanitizeRedirect(search.redirect),
	}),
	component: LoginPage,
});

function LoginPage() {
	const { user, deviceCode, login } = useAuth();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const configured = isAuthConfigured();

	useEffect(() => {
		if (user) {
			navigate({ to: search.redirect ?? "/" });
		}
	}, [user, navigate, search.redirect]);

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// ignore
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-surface px-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
				<div className="text-center space-y-2">
					<img
						src="/logo.png"
						alt="KTC Talent Hub"
						className="h-12 mx-auto object-contain"
					/>
					<h1 className="text-2xl font-bold text-gray-900">サインイン</h1>
					<p className="text-sm text-gray-500">
						Microsoft アカウントでログインしてください。
					</p>
				</div>

				{!configured && (
					<div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
						Azure AD の設定が見つかりません。
						<code className="font-mono">.env.local</code>に{" "}
						<code className="font-mono">VITE_AZURE_CLIENT_ID</code> と{" "}
						<code className="font-mono">VITE_AZURE_TENANT_ID</code>{" "}
						を設定してください。
					</div>
				)}

				{deviceCode.phase === "waiting" ? (
					<div className="space-y-4">
						<p className="text-sm text-gray-600">
							下記のコードをコピーし、別ブラウザで Microsoft
							の認証ページを開いて入力してください。
						</p>
						<div className="bg-gray-50 rounded-xl p-4 space-y-3">
							<div>
								<div className="text-xs text-gray-500 mb-1">確認コード</div>
								<div className="flex items-center gap-3">
									<code className="text-2xl font-mono font-bold tracking-widest text-gray-900">
										{deviceCode.userCode}
									</code>
									<button
										type="button"
										onClick={() => handleCopy(deviceCode.userCode)}
										className="ml-auto text-xs text-brand-600 hover:text-brand-700"
									>
										コピー
									</button>
								</div>
							</div>
							<div>
								<div className="text-xs text-gray-500 mb-1">認証 URL</div>
								<a
									href={deviceCode.verificationUri}
									target="_blank"
									rel="noreferrer noopener"
									className="text-sm text-brand-600 hover:underline break-all"
								>
									{deviceCode.verificationUri}
								</a>
							</div>
						</div>
						<p className="text-xs text-gray-500 text-center">
							認証が完了するまでこのページでお待ちください…
						</p>
					</div>
				) : (
					<button
						type="button"
						disabled={!configured || deviceCode.phase === "starting"}
						onClick={() => login()}
						className="w-full bg-brand-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{deviceCode.phase === "starting"
							? "準備中…"
							: "Microsoft でログイン"}
					</button>
				)}

				{deviceCode.phase === "error" && (
					<div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
						{deviceCode.message}
					</div>
				)}
			</div>
		</div>
	);
}
