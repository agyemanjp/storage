
import { FilterGroup } from "@sparkwave/standard"
import { DTOsMap, IOProvider, Ctor, CacheEntry } from "./types"

export interface RepositoryReadonly<D extends DTOsMap, E extends Extract<keyof D, "string">> {
	/** find one entity object with a specific id, throws exception if not found */
	findAsync(id: string): Promise<D[E]["fromStorage"]>

	/** get entity objects with optional parent and additional filters ... */
	getAsync(args: { parentId: string, filters?: FilterGroup<D[E]["fromStorage"]> }): Promise<D[E]["fromStorage"][]>
	/** A reference to the cache of the RepositoryGroup */
	cache: CacheEntry<D>[]
	/** A method to remove an entry from the cache */
	bustCache?(entry: CacheEntry<D>): () => void
}
export interface RepositoryEditable<D extends DTOsMap, E extends Extract<keyof D, "string">> extends RepositoryReadonly<D, E> {
	saveAsync: (obj: D[E]["toStorage"][]) => Promise<D[E]["fromStorage"][]>
}
export interface Repository<D extends DTOsMap, E extends Extract<keyof D, "string">> extends RepositoryEditable<D, E> {
	deleteAsync: (id: string) => Promise<D[E]["fromStorage"]>
	deleteManyAsync?: (args: { parentId: string } | { ids: string[] }) => Promise<D[E]["fromStorage"][]>
}
export type RepositoryGroup<D extends DTOsMap> = {
	[key in Extract<keyof D, "string">]: Repository<D, Extract<keyof D, "string">>
} & { cache?: CacheEntry<D>[] }

/** Generates a repository group from the io provider
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function generate<X, D extends DTOsMap>(ioProviderClass: Ctor<object, IOProvider<X, D>>): new (config: object, dtoNames: (Extract<keyof D, "string">)[], cache?: CacheEntry<D>[]) => RepositoryGroup<D> {
	return class {
		[key: string]: any
		readonly io: Readonly<IOProvider<X>>
		cache?: CacheEntry<D>[]

		constructor(config: object, dtoNames: (Extract<keyof D, "string">)[], cache?: CacheEntry<D>[]) {
			try {
				this.io = new ioProviderClass({ ...config, cache: cache })
				this.cache = cache
			}
			catch (err) {
				throw new Error(`Repository group constructor : ${err} `)
			}
			console.assert(this.io !== undefined, `Repository group this.io after construction is still undefined`)
			dtoNames.forEach(prop => {
				this[prop as string] = this.createRepository(prop, this.cache) as Repository<D, typeof prop>
			})
		}
		protected createRepository<E extends Extract<keyof D, "string">>(e: E, cache?: CacheEntry<D>[]) {
			return {
				findAsync: async (id: string) => {
					if (this.cache !== undefined) {
						if (this.cache.find(entry => entry.type === "single" && entry.key === id) === undefined) {
							this.cache.push({ type: "single", key: id, content: this.io.findAsync({ entity: e, id: id }) })
						}
						return this.cache.find(entry => entry.type === "single" && entry.key === id)?.content
					} else {
						return this.io.findAsync({ entity: e, id: id })
					}
				},
				getAsync: async (selector: { parentId?: string, filters?: FilterGroup<D[E]["fromStorage"]> }) => {
					if (this.cache) {
						if (this.cache.find(entry => entry.type === "multiple"
							&& entry.keys.entity === e
							&& entry.keys.parentId === selector.parentId
							&& entry.keys.filters === JSON.stringify(selector.filters)
						) === undefined) {
							this.cache.push({
								type: "multiple",
								keys: { entity: e, parentId: selector.parentId || "", filters: JSON.stringify(selector.filters) },
								content: this.io.getAsync({ entity: e, parentId: selector?.parentId, filters: selector?.filters })
							})
						}
						return this.cache.find(entry => entry.type === "multiple"
							&& entry.keys.entity === e
							&& entry.keys.parentId === selector.parentId
							&& entry.keys.filters === JSON.stringify(selector.filters)
						)?.content
					}
					else {
						return this.io.getAsync({ entity: e, parentId: selector?.parentId, filters: selector?.filters })
					}
				},
				saveAsync: async (obj: D[E]["toStorage"][]) => {
					return obj[0].id
						? this.io.saveAsync({ entity: e, obj: obj, mode: "update" })
						: this.io.saveAsync({ entity: e, obj: obj, mode: "insert" })
				},
				deleteAsync: async (id: string) => this.io.deleteAsync({ entity: e, id: id }),
				deleteManyAsync: async (args: { parentId: string } | { ids: string[] }) => this.io.deleteManyAsync
					? this.io.deleteManyAsync({
						entity: e,
						..."parentId" in args
							? { parentId: args["parentId"] }
							: { ids: args["ids"] }
					})
					: undefined,
				cache: cache
			} as Repository<D, E>
		}

		get extensions() { return this.io.extensions }
	} as any
}