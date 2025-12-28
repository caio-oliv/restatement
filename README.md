# restatement

**re**mote **state** manage**ment** for frontend applications.

## Features

- Typed API
- Zero dependencies
- Flexible integration

## Installation

```sh
npm install restatement
```

## Usage

- Setup your cache of choice. [lru-cache](https://www.npmjs.com/package/lru-cache) supported by default.
- Create a config object.
- Start using queries and mutations on your project.

```ts
import { restatementConfig } from 'restatement';
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, number>(/* ... */);
const cacheStore = new LRUCacheAdapter(cache);

const config = restatementConfig(cacheStore);

async function getUserInfo() { /* ... */ }

// in component UserInfo
const queryA = Query.create(makeQueryInput(
	config,
	{ key: ['account', 'user', 123], queryFn: getUserInfo }
));

// in component ShoppingCart
const queryB = Query.create(makeQueryInput(
	config,
	{ key: ['account', 'user', 123], queryFn: getUserInfo }
));
```

This will result in only 1 query being executed, since the `queryA` will cache the value returned by the `getUserInfo`, making `queryB` return the most recent value from the cache.

## Development

Clone the repo and run `pnpm install`.

### Testing

To run the tests, use the package script `test` or `test:cov` for code coverage.

### Building

To build the js files, run `build:js` and `build:type` for typescript declaration files.

For a full build (`.d.ts`, `.js`), run the `build` script.

## License

[MIT License](LICENSE)
