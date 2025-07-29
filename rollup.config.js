import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
import typescript from '@rollup/plugin-typescript';

// interface PackageJson {
// 	type: 'module';
// 	source: string;
// 	main: string;
// 	module: string;
// 	types: string;
// 	dependencies?: Record<string, string>;
// 	devDependencies?: Record<string, string>;
// 	peerDependencies?: Record<string, string>;
// }

/**
 * @typedef PackageJson
 * @type {object}
 * @property {'module'} type -
 * @property {string} source -
 * @property {string} main -
 * @property {string} module -
 * @property {string} types -
 * @property {Record<string, string>} dependencies -
 * @property {Record<string, string>} devDependencies -
 * @property {Record<string, string>} peerDependencies -
 */

const projectPath = cwd();

const tsconfigPath = join(projectPath, 'tsconfig.json');
const packageJsonPath = join(projectPath, 'package.json');

/**
 * @type {PackageJson}
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));
const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: packageJson.source,
	external: peerDependencies,
	plugins: [
		typescript({
			project: projectPath,
			tsconfig: tsconfigPath,
			include: ['src/**/*.ts'],
			composite: false,
			incremental: false,
			declaration: false,
			outputToFilesystem: true,
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

export default config;
