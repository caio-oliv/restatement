import { OptionDefaults } from 'typedoc';

/**
 * Typedoc config
 * @see https://typedoc.org/index.html
 */
const config = {
	plugin: ['typedoc-plugin-markdown', 'typedoc-github-theme'],
	entryPoints: ['src/lib.ts'],
	readme: './README.md',
	includeVersion: true,
	validation: {
		notDocumented: false,
		notExported: true,
		invalidLink: true,
		rewrittenLink: true,
		unusedMergeModuleWith: true,
	},
	jsDocCompatibility: {
		exampleTag: true,
		defaultTag: true,
		inheritDocTag: false,
		ignoreUnescapedBraces: false,
	},
	blockTags: [...OptionDefaults.blockTags, '@description'],
	router: 'kind',
	sort: ['source-order'],
	groupOrder: ['Classes', 'Functions', 'Variables', 'Interfaces', 'Type Aliases', '*'],
	outputs: [
		{
			name: 'html',
			path: 'docs',
			options: {
				navigation: {
					includeCategories: true,
					includeGroups: true,
					excludeReferences: false,
					includeFolders: true,
				},
			},
		},
		// requires typedoc-plugin-markdown
		{ name: 'markdown', path: 'docsmd' },
	],
};

export default config;
