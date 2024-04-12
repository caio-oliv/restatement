# restatement

**re**mote **state** manage**ment** for frontend applications.

## Features

- Typed API
- Zero dependencies
- Flexible implementation

## Usage

Setup all the shared pieces:

- `Cache` to store all the remote state
- `PubSub` to notify the query instances that the value has changed.

and make a `new RemoteStateQuery()` for all the queries that can be cached.

## Example

```ts
const cacheStore = new CacheStore();
const stateProvider = new PubSub();


async function getUserInfo() { /* ... */ }

// in component UserInfo
const queryA = new RemoteStateQuery({ cacheStore, stateProvider, queryFn: getUserInfo });

// in component ShoppingCart
const queryB = new RemoteStateQuery({ cacheStore, stateProvider, queryFn: getUserInfo });
```

This will result in only 1 query being executed, since the `queryA` will cache the value returned by the `getUserInfo`, making `queryB` return the most recent value from the cache.

## Development

Clone the repo and run `pnpm install`.

### Testing

To run the tests, use the package script `test` or `test --coverage` for code coverage.

### Building

To build the js files, run `build:js` and `build:type` for typescript declaration files.

For a full build (`.d.ts`, `.js`), run the `build` script.

## License

[MIT License](LICENSE)
