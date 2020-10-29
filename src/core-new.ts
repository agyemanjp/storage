// /* eslint-disable @typescript-eslint/no-empty-function */
// /* eslint-disable @typescript-eslint/ban-types */
// /* eslint-disable brace-style */

// import { Obj, Tuple, hasValue } from "@sparkwave/standard/utility"
// import { FilterGroup } from "@sparkwave/standard/collections/containers/table"
// import { keys, fromKeyValues as objFromKeyValues } from "@sparkwave/standard/collections/object"


// type EntityModel = { [k: string]: { from: Obj, to?: Obj, parent?: Obj } }
// type To<M extends EntityModel, E extends keyof M> = M[E]["to"]
// type From<M extends EntityModel, E extends keyof M> = M[E]["from"]
// type EMTest = {
// 	"projects": {
// 		to: { id: string, name: string, whenCreated: number },
// 		from: { categories: string[] }
// 	},
// 	"tables": {
// 		to: { id: string, name: string, whenCreated: number, projectId: string },
// 		from: { storageUrl: string }
// 	}
// }
// export interface RepoReadonly<Out extends Obj> {
// 	/** find one entity object with a specific id, throws exception if not found */
// 	findAsync(id: string): Promise<Out>

// 	/** get entity objects with optional parent and additional filters ... */
// 	getAsync(args: { parentId: string, filters?: FilterGroup<Out> }): Promise<Out[]>
// }
// export interface Repo<In extends Obj, Out extends Obj> extends RepoReadonly<Out> {
// 	saveAsync: (data: In[], mode: "insert" | "update") => Promise<Out[]>
// 	deleteAsync: (id: string) => Promise<Out>
// 	deleteManyAsync?: (args: { parentId: string } | { ids: string[] }) => Promise<Out[]>
// }
// type RepoGroup<M extends EntityModel, X extends Obj = {}> = {
// 	[key in keyof M]: To<M, key> extends Obj ? Repo<To<M, key>, From<M, key>> : RepoReadonly<From<M, key>>
// } & {
// 	/** A method to remove an entry from the cache */
// 	invalidateCache: (entity: keyof M, key?: { objectId: string } | { parentId: string }) => void,

// 	/** Any extensions */
// 	extensions: X
// }

// export type EntityCache<M extends EntityModel> = {
// 	[e in keyof M]: {
// 		objects: Obj<Promise<From<M, e>>, string /*entityId*/>,
// 		collections: Obj<Promise<From<M, e>[]>, string /* {parentEntityId, filters (as JSON)} */>,
// 	}
// }

// export interface IOProvider<In extends Obj | undefined = undefined, Out extends Obj = Obj, X extends Obj = {}> {
// 	/** Find one entity object; throws exception if not found */
// 	findAsync: (args: { entity: string, id: string }) => Promise<Out>

// 	/** Get a set of entity objects */
// 	getAsync: (args: { entity: string, parentId?: string, filters?: FilterGroup<Out> }) => Promise<Out[]>

// 	/** Insert or update a set of entity objects */
// 	saveAsync: (args: { entity: string, data: In[], mode: "insert" | "update" }) => Promise<Out[]>

// 	deleteAsync: (args: { entity: string, id: string }) => Promise<Out>
// 	deleteManyAsync?: (args: { entity: string } & ({ ids: string[] } | { parentId: string })) => Promise<Out[]>

// 	extensions: X
// }
// type IOFactory<M extends EntityModel, Cfg, X extends Obj> = (cfg: Cfg) => IOProvider<To<M, keyof M>, From<M, keyof M>, X>

// type RepoGroupFactory<M extends EntityModel, C, X extends Obj> = (cfg: C, cache: EntityCache<M>) => RepoGroup<M, X>

// export function generate<M extends EntityModel>() {
// 	return function <C = void, X extends Obj = {}>(io: IOFactory<M, C, X>) {
// 		return (cfg: C, cache: EntityCache<M>): RepoGroup<M, X> => {
// 			try {
// 				const ioProvider = io(cfg)

// 				// eslint-disable-next-line no-shadow
// 				const makeRepository = <E extends keyof M>(e: E) => {
// 					return {
// 						findAsync: async (id: string) => {
// 							if (hasValue(cache) && hasValue(cache[e])) {
// 								if (!hasValue(cache[e].objects[id])) {
// 									// eslint-disable-next-line fp/no-mutation
// 									cache[e].objects[id] = ioProvider.findAsync({ entity: e, id: id })
// 								}
// 								return cache[e].objects[id]
// 							}
// 							else {
// 								return ioProvider.findAsync({ entity: e, id: id })
// 							}
// 						},

// 						getAsync: async (selector: { parentId?: string, filters?: FilterGroup<From<M, E>> }) => {
// 							if (hasValue(cache) && hasValue(cache[e])) {
// 								const cacheIndex = (selector.parentId || "") + "|" + JSON.stringify(selector.filters)
// 								if (!hasValue(cache[e].collections[cacheIndex])) {
// 									// eslint-disable-next-line fp/no-mutation
// 									cache[e].collections[cacheIndex] = ioProvider.getAsync({
// 										entity: e,
// 										parentId: selector?.parentId,
// 										filters: selector?.filters
// 									})
// 								}

// 								return cache[e].collections[cacheIndex]
// 							}
// 							else {
// 								return ioProvider.getAsync({
// 									entity: e,
// 									parentId: selector?.parentId,
// 									filters: selector?.filters
// 								})
// 							}
// 						},

// 						...("to" in cache[e] ?
// 							{
// 								saveAsync: async (obj: M[E]["to"][], mode: "insert" | "update") => {
// 									return mode === "update"
// 										? ioProvider.saveAsync({ entity: e, data: obj, mode: "update" })
// 										: ioProvider.saveAsync({ entity: e, data: obj, mode: "insert" })
// 								},

// 								deleteAsync: async (id: string) => ioProvider.deleteAsync({ entity: e, id: id }),
// 								// eslint-disable-next-line no-shadow
// 								deleteManyAsync: async (args: { parentId: string } | { ids: string[] }) => ioProvider.deleteManyAsync
// 									? ioProvider.deleteManyAsync({
// 										entity: e,
// 										..."parentId" in args
// 											? { parentId: args["parentId"] }
// 											: { ids: args["ids"] }
// 									})
// 									: undefined
// 							}
// 							: {
// 							}
// 						)

// 					} as To<M, E> extends Obj ? Repo<To<M, E>, From<M, E>> : RepoReadonly<From<M, E>>
// 				}

// 				const r = {
// 					...objFromKeyValues(keys(cache).map(e => new Tuple(e, makeRepository(e)))),
// 					// eslint-disable-next-line @typescript-eslint/no-unused-vars
// 					invalidateCache: (entityName: keyof M, key?: { objectId: string } | { parentId: string }) => {
// 						// eslint-disable-next-line fp/no-mutation
// 						cache[entityName] = { objects: {}, collections: {} }//[entityObjId]
// 					},
// 					extensions: ioProvider.extensions
// 				}
// 				return r
// 			}
// 			catch (err) {
// 				throw new Error(`Error creating io provider: ${err} `)
// 			}
// 		}
// 	}
// }


// /*
// # Cache system
// If the option is enabled, a cache object will be created along with the repository group.
// It stores the return values of calls to "getAsync" and "findAsync" functions, to return it faster when the same calls are made afterwards.
// ### Entries insertion
// A call to "findAsync" creates a "single" type cache entry, which stores a single entity.
// A call to "getAsync" creates a "multiple" cache entry, which stores all entities returned by the function.
// ### Entries invalidation
// **Automatic**
// When the saveAsync and deleteAsync functions are called, all cache entries related to the updated entity will be removed: its "single" type entry if present, and any "multiple" entries that included it in the results.
// **Manual**
// In addition, every repository exposes a "invalidateCache" function: it should be used to invalidate the cache when the underlying data changed without the "saveAsync" or "deleteAsync" methods involved. For instance, when the database where entities are stored was modified by another user.

// */