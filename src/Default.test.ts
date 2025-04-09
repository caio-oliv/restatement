import { assert, describe, it } from 'vitest';
import { defaultKeyHashFn } from '@/lib';

describe('default key hash function', () => {
	it('produce different keys for different inputs', () => {
		const input: Array<ReadonlyArray<unknown>> = [
			['string'],
			[{ object: true }],
			[{ object: false }],
			[4, 'list'],
			[3.1415],
		];

		const hashs = input.map(defaultKeyHashFn);

		for (const [index, hash] of hashs.entries()) {
			for (let i = 0; i < input.length; i++) {
				if (index === i) continue;

				assert.notStrictEqual(hash, hashs[i]);
			}
		}
	});

	it('produce same hash for objects with same keys and values', () => {
		const unsorted = [
			{
				car: 'blue',
				apple: 'red',
				banana: 'yellow',
			},
		];
		const sorted = [
			{
				apple: 'red',
				banana: 'yellow',
				car: 'blue',
			},
		];

		const hash1 = defaultKeyHashFn(unsorted);
		const hash2 = defaultKeyHashFn(sorted);

		assert.deepStrictEqual(hash1, hash2);
	});

	it('produce same hash for nested objects with same keys and values', () => {
		const unsorted = [
			{
				car: 'blue',
				apple: 'red',
				banana: 'yellow',
				perfect: {
					midlife: 'crisis',
					heart: 'faith',
					no: 'more',
					age: 10,
					epic: {
						face: 'grab',
						all: 'cant',
					},
				},
			},
		];
		const sorted = [
			{
				apple: 'red',
				banana: 'yellow',
				car: 'blue',
				perfect: {
					age: 10,
					epic: {
						all: 'cant',
						face: 'grab',
					},
					heart: 'faith',
					midlife: 'crisis',
					no: 'more',
				},
			},
		];

		const hash1 = defaultKeyHashFn(unsorted);
		const hash2 = defaultKeyHashFn(sorted);

		assert.deepStrictEqual(hash1, hash2);
	});
});
