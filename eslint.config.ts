/* eslint-disable @typescript-eslint/no-magic-numbers */

import type { Linter } from 'eslint';
import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-plugin-prettier/recommended';

const rootUrl = new URL(import.meta.url);
const gitignoreUrl = new URL('.gitignore', import.meta.url);

const globalIgnore = includeIgnoreFile(gitignoreUrl.pathname);

const jsonConfig: Linter.Config = {
	name: 'restatement/json-files',
	files: ['**/*.json'],
	rules: {
		'prettier/prettier': 'warn',
		'@typescript-eslint/no-unused-expressions': 'off',
	},
};

const testConfig: Linter.Config = {
	name: 'restatement/test',
	files: ['**/*.test.ts'],
	rules: {
		complexity: ['error', 20],
		'max-depth': ['error', 5],
		'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }],
		'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
		'max-nested-callbacks': ['error', 5],
		'max-params': ['error', 6],
		'no-console': 'warn',

		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-useless-constructor': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/no-magic-numbers': 'off',

		'@typescript-eslint/explicit-function-return-type': 'off',

		'jsdoc/require-jsdoc': 'off',
	},
};

const projectConfig: Linter.Config = {
	name: 'restatement/project',
	plugins: {
		'@typescript-eslint': tseslint.plugin,
		jsdoc,
	},
	languageOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
		parser: tseslint.parser,
		parserOptions: {
			projectService: true,
			tsconfigRootDir: rootUrl.pathname,
		},
	},
	files: ['**/*.js', '**/*.ts'],
	rules: {
		'no-constructor-return': 'off', // using @typescript-eslint version
		'no-useless-constructor': 'off', // using @typescript-eslint version
		'no-duplicate-imports': 'error',
		'no-inner-declarations': 'error',
		'no-promise-executor-return': 'error',
		'no-self-compare': 'error',
		'no-unmodified-loop-condition': 'error',
		'no-unreachable-loop': 'error',
		'no-loop-func': 'off', // using @typescript-eslint version
		'no-use-before-define': 'off', // using @typescript-eslint version
		'no-magic-numbers': 'off', // using @typescript-eslint version
		'require-atomic-updates': 'error',

		'class-methods-use-this': 'error',
		'grouped-accessor-pairs': 'error',
		'func-names': 'error',
		'consistent-return': 'error',
		'default-case-last': 'error',
		'require-await': 'off', // using @typescript-eslint version
		eqeqeq: 'error',
		complexity: ['error', 16],
		'max-depth': ['error', 3],
		'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
		'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
		'max-nested-callbacks': ['error', 3],
		'max-params': ['error', 4],
		'no-console': ['error', { allow: ['error'] }],
		'no-empty-function': 'off', // using @typescript-eslint version
		'no-eval': 'error',
		'no-implied-eval': 'error',
		'no-extend-native': 'error',
		strict: 'error',

		'@typescript-eslint/no-array-constructor': 'error',
		'@typescript-eslint/no-duplicate-enum-values': 'error',
		'@typescript-eslint/no-dynamic-delete': 'error',
		'@typescript-eslint/no-empty-object-type': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-extra-non-null-assertion': 'error',
		'@typescript-eslint/no-extraneous-class': 'error',
		'@typescript-eslint/no-invalid-void-type': 'error',
		'@typescript-eslint/no-misused-new': 'error',
		'@typescript-eslint/no-namespace': 'error',
		'@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
		'@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
		'@typescript-eslint/no-non-null-assertion': 'error',
		'@typescript-eslint/no-require-imports': 'error',
		'@typescript-eslint/no-this-alias': 'error',
		'@typescript-eslint/no-unnecessary-type-constraint': 'error',
		'@typescript-eslint/no-unsafe-declaration-merging': 'error',
		'@typescript-eslint/no-unsafe-function-type': 'error',
		'@typescript-eslint/no-unsafe-argument': 'error',
		'@typescript-eslint/no-unsafe-assignment': 'error',
		'@typescript-eslint/no-unsafe-call': 'error',
		'@typescript-eslint/no-unsafe-member-access': 'error',
		'@typescript-eslint/no-unsafe-return': 'error',
		'@typescript-eslint/no-useless-constructor': 'error',
		'@typescript-eslint/no-empty-function': 'error',
		'@typescript-eslint/no-loop-func': 'error',
		'@typescript-eslint/no-magic-numbers': [
			'error',
			{
				ignoreEnums: true,
				ignoreNumericLiteralTypes: true,
				ignoreReadonlyClassProperties: true,
				ignoreTypeIndexes: true,
			},
		],
		'@typescript-eslint/no-use-before-define': 'error',
		'@typescript-eslint/prefer-for-of': 'error',
		'@typescript-eslint/prefer-readonly': 'error',

		'@typescript-eslint/consistent-type-imports': [
			'error',
			{ prefer: 'type-imports', fixStyle: 'separate-type-imports' },
		],
		'@typescript-eslint/explicit-function-return-type': 'error',
		'@typescript-eslint/explicit-module-boundary-types': 'error',
		'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
		'@typescript-eslint/class-methods-use-this': 'error',
		'@typescript-eslint/consistent-generic-constructors': ['error', 'constructor'],
		'@typescript-eslint/array-type': ['error', { default: 'generic' }],
		'@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
		'@typescript-eslint/method-signature-style': ['error', 'method'],
		'@typescript-eslint/return-await': ['warn', 'always'],

		'jsdoc/require-jsdoc': 'warn',

		'prettier/prettier': 'error',
	},
} as Linter.Config;

const configs: Array<Linter.Config> = [
	globalIgnore,
	eslint.configs.recommended,
	...(tseslint.configs.recommended as Array<Linter.Config>),
	jsdoc.configs['flat/recommended-typescript'],
	prettier,
	projectConfig,
	testConfig,
	jsonConfig,
];

export default configs;
