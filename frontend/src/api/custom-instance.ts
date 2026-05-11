import type { AxiosRequestConfig } from "axios";
import Axios from "axios";
import { getApiBase, getBearerAuth } from "@/lib/api/config";
import { AUTH_EXPIRED_EVENT } from "@/lib/auth/events";
import { clearTokens } from "@/lib/auth/tokenStore";

const AXIOS_INSTANCE = Axios.create({
	baseURL: getApiBase(),
	timeout: 30_000,
	withCredentials: true,
});

AXIOS_INSTANCE.interceptors.request.use(async (config) => {
	const auth = await getBearerAuth();
	if (auth) {
		config.headers.set("Authorization", auth);
	}
	return config;
});

AXIOS_INSTANCE.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error?.response?.status === 401) {
			clearTokens();
			window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
		}
		return Promise.reject(error);
	},
);

// デモモード用: この関数が設定されていると Axios を経由せずモックデータを返す
let _mockResolver:
	| ((config: AxiosRequestConfig) => Promise<unknown> | null)
	| null = null;

export function setMockResolver(
	resolver: (config: AxiosRequestConfig) => Promise<unknown> | null,
) {
	_mockResolver = resolver;
}

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
	if (_mockResolver) {
		const result = _mockResolver(config);
		if (result) return result as Promise<T>;
	}

	const source = Axios.CancelToken.source();
	const promise = AXIOS_INSTANCE({
		...config,
		cancelToken: source.token,
	}).then(({ data }) => data);

	// @ts-expect-error -- cancel property for react-query
	promise.cancel = () => {
		source.cancel("Query was cancelled");
	};

	return promise;
};

export default customInstance;
