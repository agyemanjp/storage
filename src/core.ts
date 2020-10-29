/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable brace-style */

import { Obj, Tuple, hasValue } from "@sparkwave/standard/utility"
import { FilterGroup } from "@sparkwave/standard/collections/containers/table"
import { keys, fromKeyValues as objFromKeyValues } from "@sparkwave/standard/collections/object"

import {
	EntityCache,
	ToStorage, FromStorage,
	Schema, IOProvider,
	Repository, RepositoryReadonly, RepositoryGroup
} from "./types"


/** Generates a repository group from the io provider
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function repositoryGroupFactory<S extends Schema, Cfg extends Obj | void = void, X extends Obj = {}>(args:
	{ ioProvider: (cfg: Cfg) => IOProvider<ToStorage<S, keyof S>, FromStorage<S, keyof S>, X>, schema: S }): (cfg: Cfg) => RepositoryGroup<S, X> {

	return (config: Cfg) => {
		const cache: EntityCache<S> = objFromKeyValues(keys(args.schema).map(e => new Tuple(e, ({
			objects: {},
			collections: {}
		}))))

		try {
			const io = args.ioProvider(config)

			// eslint-disable-next-line no-shadow
			const makeRepository = <E extends keyof S>(e: E, cache?: EntityCache<S>) => {
				return {
					findAsync: async (id: string) => {
						if (hasValue(cache) && hasValue(cache[e])) {
							if (!hasValue(cache[e].objects[id])) {
								// eslint-disable-next-line fp/no-mutation
								cache[e].objects[id] = io.findAsync({ entity: e, id: id })
							}
							return cache[e].objects[id]
						}
						else {
							return io.findAsync({ entity: e, id: id })
						}
					},

					getAsync: async (selector: { parentId?: string, filters?: FilterGroup<FromStorage<S, E>> }) => {
						if (hasValue(cache) && hasValue(cache[e])) {
							const cacheIndex = (selector.parentId || "") + "|" + JSON.stringify(selector.filters)
							if (!hasValue(cache[e].collections[cacheIndex])) {
								// eslint-disable-next-line fp/no-mutation
								cache[e].collections[cacheIndex] = io.getAsync({
									entity: e,
									parentId: selector?.parentId,
									filters: selector?.filters
								})
							}

							return cache[e].collections[cacheIndex]
						}
						else {
							return io.getAsync({
								entity: e,
								parentId: selector?.parentId,
								filters: selector?.filters
							})
						}
					},

					...("toStorage" in args.schema[e] ?
						{
							saveAsync: async (obj: S[E]["toStorage"][], mode: "insert" | "update") => {
								return mode === "update"
									? io.saveAsync({ entity: e, data: obj, mode: "update" })
									: io.saveAsync({ entity: e, data: obj, mode: "insert" })
							},

							deleteAsync: async (id: string) => io.deleteAsync({ entity: e, id: id }),
							// eslint-disable-next-line no-shadow
							deleteManyAsync: async (args: { parentId: string } | { ids: string[] }) => io.deleteManyAsync
								? io.deleteManyAsync({
									entity: e,
									..."parentId" in args
										? { parentId: args["parentId"] }
										: { ids: args["ids"] }
								})
								: undefined
						}
						: {
						}
					)

				} as ToStorage<S, E> extends never
					? RepositoryReadonly<FromStorage<S, E>>
					: Repository<ToStorage<S, E>, FromStorage<S, E>>
			}

			const r: RepositoryGroup<S, X> = {
				...objFromKeyValues(keys(args.schema).map(e => new Tuple(e, makeRepository(e, cache)))),
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				invalidateCache: (entityName: keyof S, key?: { objectId: string } | { parentId: string }) => {
					// eslint-disable-next-line fp/no-mutation
					cache[entityName] = { objects: {}, collections: {} }//[entityObjId]
				},
				extensions: io.extensions
			}
			return r
		}
		catch (err) {
			throw new Error(`Error creating io provider: ${err} `)
		}
	}
}



/*
# Cache system
If the option is enabled, a cache object will be created along with the repository group.
It stores the return values of calls to "getAsync" and "findAsync" functions, to return it faster when the same calls are made afterwards.
### Entries insertion
A call to "findAsync" creates a "single" type cache entry, which stores a single entity.
A call to "getAsync" creates a "multiple" cache entry, which stores all entities returned by the function.
### Entries invalidation
**Automatic**
When the saveAsync and deleteAsync functions are called, all cache entries related to the updated entity will be removed: its "single" type entry if present, and any "multiple" entries that included it in the results.
**Manual**
In addition, every repository exposes a "invalidateCache" function: it should be used to invalidate the cache when the underlying data changed without the "saveAsync" or "deleteAsync" methods involved. For instance, when the database where entities are stored was modified by another user.

*/