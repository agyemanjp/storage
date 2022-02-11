/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable fp/no-delete */
/* eslint-disable fp/no-mutation */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable brace-style */

import { Obj, Tuple, forEach, keys, values, objectFromTuples, DataTable } from "@agyemanjp/standard"
import {
	EntityCacheGroup, EntityType, Schema,
	IOProvider,
	Repository, RepositoryReadonly, RepositoryGroup
} from "./types"

type T<S extends Schema, E extends keyof S> = EntityType<S[E]>


/** Generates a repository group from the io provider
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function repositoryGroupFactory<S extends Schema, Cfg extends Obj | void = void>(schema: S): (cfg: Cfg) => RepositoryGroup<S>
export function repositoryGroupFactory<S extends Schema, Cfg extends Obj | void = void, X extends Obj = Obj>(
	schema: S,
	io: (cfg: Cfg) => IOProvider<S>,
	extensions?: (io: IOProvider<S>) => X
): (cfg: Cfg) => RepositoryGroup<S, typeof extensions extends undefined ? undefined : X>

export function repositoryGroupFactory<S extends Schema, Cfg extends Obj | void = void, X extends Obj = {}>(
	/** Schema that defines the entity model */
	schema: S,

	/** IO provider factory; Repository is cache-only if not provided */
	io?: (cfg: Cfg) => IOProvider<S>,

	extensions?: (io: IOProvider<S>) => X
) {

	return (config: Cfg) => {
		const cache: EntityCacheGroup<S> = objectFromTuples(keys(schema).map(e => new Tuple(e, ({
			objects: {},
			vectors: {}
		}))))

		try {
			const ioProvider = io ? io(config) : undefined

			const repositoryFactory = <E extends keyof S>(e: E, _cache: EntityCacheGroup<S>) => {
				const CACHE_EXPIRATION_MILLISECONDS = 10 * 60 * 1000 // 10 minutes
				const invalidOrStale = <T>(entry?: [T, number]) =>
					(entry === undefined) || (new Date().getTime() - entry[1] > CACHE_EXPIRATION_MILLISECONDS)

				return {
					findAsync: async (id, refreshCache?: boolean) => {
						const objects = _cache[e].objects
						if (ioProvider && (invalidOrStale(objects[id]) || refreshCache)) {
							// eslint-disable-next-line fp/no-mutation
							objects[id] = new Tuple(
								await ioProvider.findAsync({ entity: e, id: id }),
								new Date().getTime()
							)
						}
						return objects[id][0]
					},

					getAsync: async (filter, refreshCache?: boolean) => {
						const filtersKey = filter ? JSON.stringify(filter) : "N/A"
						const vectors = _cache[e].vectors
						if (ioProvider) {
							if (invalidOrStale(vectors[filtersKey]) || refreshCache) {
								vectors[filtersKey] = [
									ioProvider.getAsync({ entity: e, filters: filter }),
									new Date().getTime()
								]
							}
						}
						else {
							if (vectors[filtersKey] === undefined) {
								const vals = vectors["N/A"]
									? await vectors["N/A"][0]
									: values(_cache[e].objects).map(v => v[0])
								const dataTable = DataTable.fromRows(vals)
								const newData = (filter ? dataTable.filter({ filter }) : dataTable).rowObjects
								vectors[filtersKey] = [Promise.resolve([...newData]), new Date().getTime()]
							}
						}
						return vectors[filtersKey][0]
					},

					...(schema[e]["readonly"] === false ?
						{
							insertAsync: async (objects) => {
								if (ioProvider) {
									await ioProvider.insertAsync({ entity: e, objects })
								}

								// Append new objects to base vector cache, and remove all other vectors cache entries
								const baseVector = _cache[e].vectors["N/A"] || [Promise.resolve([]), new Date().getTime()]
								_cache[e].vectors = {
									"N/A": [
										baseVector[0].then(vector => [...vector, ...objects]),
										baseVector[1]
									]
								}

								forEach(objects, (datum) => {
									const idFieldname = schema[e].idField!
									_cache[e].objects[String(datum[idFieldname])] = new Tuple(datum, new Date().getTime())
								})
							},

							updateAsync: async (objects) => {
								if (ioProvider) {
									await ioProvider.updateAsync({ entity: e, objects })
								}

								// Remove all vectors cache entries
								_cache[e].vectors = {}

								forEach(objects, (datum) => {
									const idFieldname = schema[e].idField!
									_cache[e].objects[String(datum[idFieldname])] = new Tuple(datum, new Date().getTime())
								})
							},

							deleteAsync: async (id) => {
								if (ioProvider) {
									await ioProvider.deleteAsync({ entity: e, id })
								}
								_cache[e].vectors = {}
								delete _cache[e].objects[String(id)]
							}
						}

						: {
						}
					)

				} as S[E]["readonly"] extends false ? Repository<T<S, E>> : RepositoryReadonly<T<S, E>>
			}

			const core = objectFromTuples(keys(schema).map(e => new Tuple(e, repositoryFactory(e, cache))))

			return (io && extensions && ioProvider)
				? { ...core, extensions: extensions(ioProvider) } //as RepositoryGroup<S, X>
				: { ...core, extensions: undefined as any } //as RepositoryGroup<S, any>

		}
		catch (err) {
			throw new Error(`Error creating io provider: ${err} `)
		}
	}
}


/*	# Cache system
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
