# storage
Data source access through the repository pattern in Javascript/TypeScript

# Install
`npm install --save @agyemanjp/storage`

## Cache system specification
If the option is enabled, a cache object will be created along with the repository group.
It stores the return values of calls to "getAsync" and "findAsync" functions, to return it faster when the same calls are made afterwards.

### Entries insertion
A call to "findAsync" creates a "single" type cache entry, which stores a single entity.
A call to "getAsync" creates a "multiple" cache entry, which stores all entities returned by the function.

### Entries invalidation
**Automatic**
When the saveAsync and deleteAsync functions are called, all cache entries related to the updated entity will be removed: its "single" type entry if present, and any "multiple" entries that included it in the results.
**Manual**
In addition, every repository group function has a "refreshCache" boolean argument: it can be used to invalidate the cache when the underlying data changed without the "saveAsync" or "deleteAsync" methods involved. For instance, when the database where entities are stored was modified by another user.
