import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
import { URL } from 'node:url';
import typescript from '@rollup/plugin-typescript';
import esbuild from 'rollup-plugin-esbuild';

/**
 * @typedef PackageJson
 * @type {object}
 * @property {'module'} type -
 * @property {string} source -
 * @property {Exports} exports -
 * @property {string} types -
 * @property {Record<string, string> | undefined} dependencies -
 * @property {Record<string, string> | undefined} devDependencies -
 * @property {Record<string, string> | undefined} peerDependencies -
 */

/**
 * @typedef Exports
 * @type {object}
 * @property {SubExports} import -
 * @property {SubExports} require -
 * @property {string} default -
 */

/**
 * @typedef SubExports
 * @type {object}
 * @property {string} types -
 * @property {string} default -
 */

/**
 * @typedef Tsconfig
 * @type {object}
 * @property {CompilerOptions} compilerOptions -
 */

/**
 * @typedef CompilerOptions
 * @type {object}
 * @property {string} target -
 */

const PROJECT_PATH = cwd();

const tsconfigPath = join(PROJECT_PATH, 'tsconfig.json');
const tsconfigRulesPath = new URL('./rules.tsconfig.json', import.meta.url).pathname;
const packageJsonPath = join(PROJECT_PATH, 'package.json');

/**
 * @type {PackageJson}
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const PACKAGE_JSON = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));

/**
 * @type {Tsconfig}
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const TSCONFIG_RULES = JSON.parse(readFileSync(tsconfigRulesPath, { encoding: 'utf-8' }));

/**
 * Get external modules
 * @returns External modules
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function externalModules() {
	const external = [];
	external.push(...Object.keys(PACKAGE_JSON.peerDependencies ?? {}));
	return external;
}

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: PACKAGE_JSON.source,
	external: externalModules(),
	plugins: [
		typescript({
			project: PROJECT_PATH,
			tsconfig: tsconfigPath,
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			composite: false,
			incremental: false,
			declaration: false,
			outputToFilesystem: true,
		}),
		esbuild({
			include: /\.tsx?$/,
			minify: false,
			target: TSCONFIG_RULES.compilerOptions.target,
			jsx: 'transform',
		}),
	],
	output: [
		{
			file: PACKAGE_JSON.exports.require.default,
			sourcemap: true,
			format: 'cjs',
		},
		{
			file: PACKAGE_JSON.exports.import.default,
			sourcemap: true,
			format: 'es',
		},
	],
};

export default config;
