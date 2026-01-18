import baseConfig from "@workspace/eslint-config/base";

export default [
	{
		ignores: ["dist/**"],
	},
	...baseConfig,
];
