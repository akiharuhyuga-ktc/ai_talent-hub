import type { AxiosRequestConfig } from "axios";
import Axios from "axios";

const AXIOS_INSTANCE = Axios.create({
	baseURL: import.meta.env.VITE_API_BASE_URL || "",
	timeout: 30_000,
	withCredentials: true,
});

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
