import { readFileSync } from 'node:fs';
import typescript from '@rollup/plugin-typescript';

const packageJson = JSON.parse(readFileSync('package.json', { encoding: 'utf-8' }));
const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});

/** @type {import('rollup').RollupOptions} */
export default {
	input: packageJson.source,
	external: peerDependencies,
	plugins: [
		typescript({
			include: ['src/**/*.ts'],
			declaration: false,
		}),
	],
	output: [
		{
			file: packageJson.main,
			sourcemap: true,
			format: 'cjs',
		},
		{
			file: packageJson.module,
			sourcemap: true,
			format: 'es',
		},
	],
};
