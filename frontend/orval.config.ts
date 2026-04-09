import { defineConfig } from "orval";

export default defineConfig({
	api: {
		input: {
			target: "../openapi/openapi.json",
		},
		output: {
			client: "react-query",
			target: "./src/api/generated/endpoints",
			schemas: "./src/api/generated/types",
			fileExtension: ".gen.ts",
			mode: "tags",
			indexFiles: true,
			override: {
				mutator: {
					path: "./src/api/custom-instance.ts",
					name: "customInstance",
				},
				query: {
					useQuery: true,
					useSuspenseQuery: true,
				},
			},
			mock: {
				type: "msw",
				delay: 500,
				useExamples: false,
			},
		},
	},
});
