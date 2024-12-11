export * from "./io"

import { forEach, isArray, ok, Tuple, type FilterSingle, type RecordFilter, type Rec, type Result, err, stringify, assert } from "@agyemanjp/standard"
import type { DataMethod, IOProvider, IOProviderFactory, RecWithId } from "./io"

export const getStorageProviderFactory = (io: ReturnType<IOProviderFactory>, opts
	: {
		cacheExpirySeconds: number
		transactionSupport: boolean
	}) => (

	io.isOk()
		? ok(
			<T extends RecWithId>(rowsetName: string) =>
				<M extends DataMethod = DataMethod>(...methods: M[]) =>
					getStorageProvider(io.value.forSetofRows<T>(rowsetName), { methods, ...opts })
		)

		: io.errWithGenericValue()
)

/** Create a storage provider which enhances the passed io with transactions, caching, and typing 
 * @param io IO provider; storage is cache-only if not passed
 * @param options Additonal optional options
 */
export function getStorageProvider<T extends RecWithId = RecWithId, M extends DataMethod = DataMethod>(io: IOProvider<T>,
	options?: {
		methods: M[]
		cacheExpirySeconds?: number
		transactionSupport?: boolean
	}): StorageProvider<T, M> {

	/** 10 minutes cache expiry */
	const DEFAULT_CACHE_EXPIRY_SECONDS = 10 * 60

	/** Cache key for non filtered entities */
	const NO_FILTERS_KEY = "N/A"

	try {
		const cache = { objects: {}, vectors: {} } as Cache<T>
		const cacheExpirySeconds = options?.cacheExpirySeconds ?? DEFAULT_CACHE_EXPIRY_SECONDS

		const stale = <T>(entry: [T, number]) => new Date().getTime() - entry[1] > cacheExpirySeconds * 1000

		const methods = options?.methods ?? []
		const ret: Partial<StorageProvider<T>> = {
			find: methods.length === 0 || methods.includes("find" as M)
				? async (id, refreshCache): Promise<Result<T>> => {
					const objects = cache.objects
					const cacheTuple = objects[id]

					if (cacheTuple === undefined || stale(cacheTuple) || refreshCache === true) {
						const result = await io.find(id)
						if (result.isErr()) { return result }
						else {
							objects[id] = new Tuple(result.value, new Date().getTime())
						}
					}
					const x = (objects[id] ?? [])[0]
					assert(x)
					return ok(x)
				}
				: undefined,

			get: methods.length === 0 || methods.includes("get" as M)
				? async (filter, refreshCache) => {
					const filtersKey = filter ? JSON.stringify(filter) : NO_FILTERS_KEY
					const vectors = cache.vectors
					const cacheTuple = vectors[filtersKey]
					if (cacheTuple === undefined || stale(cacheTuple) || refreshCache === true) {
						const result = await io.get(filter)
						if (result.isErr()) {
							return result
						}
						else {
							vectors[filtersKey] = [
								result.value,
								new Date().getTime()
							]
							// console.log(`cache vector length for "${filtersKey}": ${vectors[filtersKey][0]}`)
						}
					}

					const vec = await (vectors[filtersKey] ?? [])[0] ?? []
					console.log(`${io.identifier}: Cache vector length after get: ${vec.length}`)

					return ok(vec)
				}
				: undefined,

			insert: methods.length === 0 || methods.includes("insert" as M)
				? async objects => {
					const baseVector = cache.vectors[NO_FILTERS_KEY] || [Promise.resolve([]), new Date().getTime()]
					const _objects = isArray(objects) ? objects : [objects]
					const result = await io.insert(_objects)
					return result.isErr()
						? result
						: (
							// Append new objects to base vector cache, and remove all other vectors cache entries
							cache.vectors = {
								[NO_FILTERS_KEY]: [
									Promise.resolve(baseVector[0]).then(vector => {
										const vec = [...vector, ..._objects]
										console.log(`${io.identifier}: New cache vector length after insert: ${vec.length}`)
										return vec
									}),
									baseVector[1]
								]
							},

							forEach(result.value, datum => {
								// const idFieldname = args.schema[entity]?.idField!
								cache.objects[String(datum["id"])] = new Tuple(datum, new Date().getTime())
							}),

							result
						)
				} : undefined,

			update: methods.length === 0 || methods.includes("update" as M)
				? async _objects => {
					const objects = Array.isArray(_objects) ? _objects : [_objects]
					const result = await io.update(objects)
					return result.isErr()
						? result
						: (
							// Remove all vectors cache entries
							cache.vectors = {},

							forEach(objects, datum => {
								// const idFieldname = args.schema[entity]?.idField!
								cache.objects[String(datum["id"])] = new Tuple(datum, new Date().getTime())
							}),

							result
						)
				} : undefined,

			remove: methods.length === 0 || methods.includes("remove" as M)
				? async args => {
					const result = await (/*!isFilterGroup(args)?*/ io.remove(args)
						// : io.get(args).then(_ => _.isErr()
						// 	? _
						// 	: io.remove(_.unwrap().map(x => x["id"]))
						// )
					)
					if (result.isErr())
						return result
					cache.vectors = {}
					forEach(result.unwrap(), id => { delete cache.objects[String(id)] })

					return result
				} : undefined,

			/*save: async objects => {
				const _objects = Array.isArray(objects) ? objects : [objects]
				if (_objects.length === 0) return ok(_objects)
				if (io.upsert) {
					return io.upsert(_objects)
				}
				else {
					const idsExisting = await io
						.get(["id", "in", _objects.map(_ => _["id"])])
						.then(result => result.isErr() ? result : ok(result.value.map(_ => _.id)))

					if (idsExisting.isOk()) {
						const toUpdate = _objects.filter(obj => idsExisting.value.includes(obj["id"]))
						const toInsert = _objects.filter(obj => !idsExisting.value.includes(obj["id"]))
						if (io.transact) {
							return io.transact(() => propagate(io.update(toUpdate), _ => io.insert(toInsert)))
						}
						else {
							const op = toUpdate.length === _objects.length
								? io.update
								: toInsert.length === _objects.length
									? io.insert
									: undefined

							return (op === undefined)
								? err({ code: "Bad-Input" })
								: op(_objects)
						}
					}
					else {
						return idsExisting
					}
				}
			},*/

			// identifier: io.identifier ?? "memory"
		}	//as any//satisfies Partial<StorageProvider<T, M>>

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return ret as any
	}
	catch (err) {
		throw new Error(`Error creating io provider: ${err} `)
	}
}
// let ss = getStorageProvider({} as any, { methods: ["get"] })

export type StorageProvider<T extends RecWithId = RecWithId, M extends DataMethod = DataMethod> = (
	("find" extends M ? {
		/** Get one object with a specific id from the underlying io provider
		 * Throws an exception if the object is not found.
		 * @param invalidateCache If true, the cache will be invalidated
		 */
		find: ((id: string, invalidateCache?: boolean) => Promise<Result<T>>)
	} : {}) &
	("get" extends M ? {
		/** Get entity objects from the underlying data-source
		 * @param filters Optional filters to apply to the objects retrieved
		 * @param invalidateCache If true, cache will be invalidated before the the objects are retrieved
		 */
		get(filter?: RecordFilter<T> | null, invalidateCache?: boolean): Promise<Result<T[]>>
	} : {}) &
	("insert" extends M ? {
		/** Insert one or more records in underlying data source
		 * Throws an exception if any id conflict occurs 
		 */
		insert(objects: T | T[]): Promise<Result<T[]>>
	} : {}) &

	("update" extends M ? {
		/** Update one or more records in underlying data source
		 * Throws an exception if any id is not found in the data source 
		 */
		update(objects: T | T[]): Promise<Result<T[]>>
	} : {}) &
	("remove" extends M ? {
		/** Delete one of more records, identified by Ids or filters, from underlying data source.
		 * Throws an error if any of the ids are not found
		 */
		remove(ids: string[] /*| FilterGroup<T>*/): Promise<Result<string[]>>
	} : {})
	// & (M extends "save" ? {
	// 	/** Update or insert (based on current existence) one or more records in underlying data source
	// 	 * Throws an exception if any id conflict occurs 
	// 	 */
	// 	save(objects: T | T[]): Promise<Result<T[]>>
	// } : {}) &
)
// let x = {} as StorageProvider<{ id: string }, "get" | "insert">
// let y = x.insert([])

export interface StorageProviderReadonly<T extends RecWithId = RecWithId> {
	/** Get one object with a specific id from the underlying io provider
	 * Throws an exception if the object is not found.
	 * @param invalidateCache If true, the cache will be invalidated
	 */
	find(id: string, invalidateCache?: boolean): Promise<Result<T>>

	/** Get entity objects from the underlying data-source
	 * @param filters Optional filters to apply to the objects retrieved
	 * @param invalidateCache If true, cache will be invalidated before the the objects are retrieved
	 */
	get(filter?: FilterSingle<T> | RecordFilter<T>, invalidateCache?: boolean): Promise<Result<T[]>>

	/** Unique identifier for underlying io provider (usually based on config) */
	// ioIdentifier?: string
}


export type RefreshCache = true
type Cache<T extends Rec = Rec> = {
	objects: Rec<[entity: T, timeStamp: number], ObjectId>,
	vectors: Rec<[vector: T[] | Promise<T[]>, timeStamp: number], FilterKey>
}
type FilterKey = string | "N/A"
type ObjectId = string


