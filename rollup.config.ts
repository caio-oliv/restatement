import { readFileSync } from 'node:fs';
import { type RollupOptions } from 'rollup';
import typescript from '@rollup/plugin-typescript';
// import packageJson from './package.json' assert { type: 'json' };

// type ProjectPackageJson = typeof packageJson;

interface PackageJson {
	type: 'module';
	source: string;
	main: string;
	module: string;
	types: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

const packageJson = JSON.parse(readFileSync('package.json', { encoding: 'utf-8' })) as PackageJson;
const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});

const config: RollupOptions = {
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

export default config;
