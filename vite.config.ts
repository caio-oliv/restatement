/// <reference types="vitest" />
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [],
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
			'@test': new URL('./test', import.meta.url).pathname,
		},
	},

	test: {
		include: ['src/**/*.test.[jt]s'],
		globals: false,
		environment: 'node',
		coverage: {
			include: ['src/**/*.[jt]s'],
			exclude: ['src/**/*.mock.[jt]s', 'src/**/*.test.[jt]s'],
			provider: 'v8',
			reportsDirectory: 'coverage',
			reporter: ['text', 'html', 'lcov'],
			clean: true,
		},
	},
});
