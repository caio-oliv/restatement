/// <reference types="vitest" />
import type { UserConfig } from 'vite';

// https://vitejs.dev/config/
export const config: UserConfig = {
	plugins: [],
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
			'@test': new URL('./test', import.meta.url).pathname,
		},
	},

	test: {
		include: ['src/**/*.test.ts?(x)'],
		globals: false,
		environment: 'node',
		coverage: {
			include: ['src/**/*.[jt]s'],
			exclude: ['src/**/*.mock.*', 'src/**/*.test.*'],
			provider: 'v8',
			reportsDirectory: 'coverage',
			reporter: ['text', 'html', 'lcov'],
			clean: true,
		},
	},
};

export default config;
