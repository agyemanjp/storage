/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable fp/no-delete */
/* eslint-disable fp/no-mutation */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable brace-style */

import { Obj, Tuple, keys, values, objectFromTuples, DataTable } from "@agyemanjp/standard"
import {
	EntityCacheGroup, EntityType, Schema,
	IOProvider, Repository, RepositoryReadonly, RepositoryGroup
} from "./types"
// import { asIOProvider, PGPromiseProvider } from "./db"

/** Generates a repository group from the io provider
 * @param schema The entity model schema
 * @param ioProvider IO provider; Repository is cache-only if not provided
 */
export function repositoryGroupFactory<S extends Schema, Cfg extends Obj | void = void>(schema: S, ioProvider?: IOProvider<Cfg, S>): RepositoryGroup<Cfg, S> {

	return (config: Cfg) => {
		const cache: EntityCacheGroup<S> = objectFromTuples(keys(schema).map(e => new Tuple(e, ({
			objects: {},
			vectors: {}
		}))))

		try {
			const io = ioProvider ? ioProvider(config) : undefined
			const repositoryFactory = <E extends keyof S>(e: E, _cache: EntityCacheGroup<S>) => {
				const CACHE_EXPIRATION_MILLISECONDS = 10 * 60 * 1000 // 10 minutes
				const invalidOrStale = <T>(entry?: [T, number]) =>
					(entry === undefined) || (new Date().getTime() - entry[1] > CACHE_EXPIRATION_MILLISECONDS)

				return {
					findAsync: async (id, refreshCache?: boolean) => {
						const objects = _cache[e].objects
						if (io && (invalidOrStale(objects[id]) || refreshCache)) {
							// eslint-disable-next-line fp/no-mutation
							objects[id] = new Tuple(
								await io.findAsync({ entity: e, id: id }),
								new Date().getTime()
							)
						}
						return objects[id][0]
					},

					getAsync: async (filter, refreshCache?: boolean) => {
						const filtersKey = filter ? JSON.stringify(filter) : "N/A"
						const vectors = _cache[e].vectors
						if (io) {
							if (invalidOrStale(vectors[filtersKey]) || refreshCache) {
								vectors[filtersKey] = [
									io.getAsync({ entity: e, filters: filter }),
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
							insertAsync: async (obj) => {
								if (io) {
									await io.insertAsync({ entity: e, obj })
								}

								// Append new objects to base vector cache, and remove all other vectors cache entries
								const baseVector = _cache[e].vectors["N/A"] || [Promise.resolve([]), new Date().getTime()]
								_cache[e].vectors = {
									"N/A": [
										baseVector[0].then(vector => [...vector, obj]),
										baseVector[1]
									]
								}

								// forEach(objects, (datum) => {
								// 	const idFieldname = schema[e].idField!
								// 	_cache[e].objects[String(datum[idFieldname])] = new Tuple(datum, new Date().getTime())
								// })

								const idFieldname = schema[e].idField!
								_cache[e].objects[String(obj[idFieldname])] = new Tuple(obj, new Date().getTime())

							},

							updateAsync: async (obj) => {
								if (io) {
									await io.updateAsync({ entity: e, obj })
								}

								// Remove all vectors cache entries
								_cache[e].vectors = {}

								// forEach(objects, (datum) => {
								// 	const idFieldname = schema[e].idField!
								// 	_cache[e].objects[String(datum[idFieldname])] = new Tuple(datum, new Date().getTime())
								// })
								const idFieldname = schema[e].idField!
								_cache[e].objects[String(obj[idFieldname])] = new Tuple(obj, new Date().getTime())

							},

							deleteAsync: async (id) => {
								if (io) {
									await io.deleteAsync({ entity: e, id })
								}
								_cache[e].vectors = {}
								delete _cache[e].objects[String(id)]
							}
						}

						: {
						}
					)

				} as S[E]["readonly"] extends false ? Repository<EntityType<S[E]>> : RepositoryReadonly<EntityType<S[E]>>
			}

			return objectFromTuples(keys(schema).map(e => new Tuple(e, repositoryFactory(e, cache))))
		}
		catch (err) {
			throw new Error(`Error creating io provider: ${err} `)
		}
	}
}

// const repoGroup = repositoryGroupFactory({}, asIOProvider(PGPromiseProvider))
// repoGroup({ dbUrl: "" }).

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
