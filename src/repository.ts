
import { singular } from "pluralize"
import { FilterGroup, Dictionary } from "@sparkwave/standard"
import { DTOsMap, IOProvider, Ctor, CacheEntry, EntityCache } from "./types"

export interface RepositoryReadonly<D extends DTOsMap, E extends keyof D> {
	/** find one entity object with a specific id, throws exception if not found */
	findAsync(id: string): Promise<D[E]["fromStorage"]>

	/** get entity objects with optional parent and additional filters ... */
	getAsync(args: { parentId: string, filters?: FilterGroup<D[E]["fromStorage"]> }): Promise<D[E]["fromStorage"][]>

	/** A method to remove an entry from the cache */
	bustCache(entry: CacheEntry<D, E>): () => void
}
export interface RepositoryEditable<D extends DTOsMap, E extends keyof D> extends RepositoryReadonly<D, E> {
	saveAsync: (obj: D[E]["toStorage"][]) => Promise<D[E]["fromStorage"][]>
}
export interface Repository<D extends DTOsMap, E extends keyof D> extends RepositoryEditable<D, E> {
	deleteAsync: (id: string) => Promise<D[E]["fromStorage"]>
	deleteManyAsync?: (args: { parentId: string } | { ids: string[] }) => Promise<D[E]["fromStorage"][]>
}
export type RepositoryGroup<D extends DTOsMap> = {
	[key in keyof D]: Repository<D, keyof D>
} & {
	bustCache: BustCache<D>
}

/** Each entity has an entry: key is the entity name, value is the entity parent's name (empty string if no parent) */
type DTOInfo<D extends DTOsMap> = { [key in keyof D]: string }
type BustCache<D extends DTOsMap> = (entityName: keyof D, entryToBust: CacheEntry<D, keyof D>) => void

/** Generates a repository group from the io provider
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function generate<X, D extends DTOsMap>(ioProviderClass: Ctor<object, IOProvider<X, D>>): new (config: object, dtoInfo: DTOInfo<D>, cached: boolean) => RepositoryGroup<D> {
	type DTOIndex = keyof D
	return class {
		[key: string]: any
		readonly io: Readonly<IOProvider<X>>
		cache?: EntityCache<D>
		bustCache: BustCache<D>

		constructor(config: object, dtoInfo: { [key in keyof D]: string }, cached: boolean) {
			try {
				this.io = new ioProviderClass({ ...config })
				const emptyCache = Dictionary.fromKeyValues(Object.keys(dtoInfo).map(key => [key, [] as CacheEntry<D, keyof D>[]])).asObject() as EntityCache<D>
				this.cache = cached === true ? emptyCache : undefined
			}
			catch (err) {
				throw new Error(`Repository group constructor : ${err} `)
			}
			console.assert(this.io !== undefined, `Repository group this.io after construction is still undefined`)
			Object.keys(dtoInfo).forEach(dtoName => {
				this[dtoName] = this.createRepository({ name: dtoName as DTOIndex, parentName: dtoInfo[dtoName] as DTOIndex })
			})
			this.bustCache = (entityName: keyof D, entryToBust: CacheEntry<D, keyof D>) => {
				if (this.cache) {
					const entries = [...this.cache[entityName]]
					this.cache[entityName].length = 0

					entries.filter(entry => {
						if (entryToBust.type === "single") {
							return !(entry.type === "single" && entry.entityId === entryToBust.entityId)
						}
						else {
							return !(entry.type === "multiple"
								&& entry.parentEntityId === entryToBust.parentEntityId)
						}
					}).forEach(entry => this.cache![entityName].push(entry))
				}
			}
		}
		protected createRepository<E extends Extract<keyof D, "string">>(dto: { name: DTOIndex, parentName: DTOIndex }) {
			return {
				findAsync: async (id: string) => {
					if (this.cache !== undefined) {
						if (this.cache[dto.name].find(entry => entry.type === "single" && entry.entityId === id) === undefined) {
							this.cache[dto.name].push({ type: "single", entityId: id, content: this.io.findAsync({ entity: dto.name as string, id: id }) })
						}
						return this.cache[dto.name].find(entry => entry.type === "single" && entry.entityId === id)?.content
					} else {
						return this.io.findAsync({ entity: dto.name as string, id: id })
					}
				},
				getAsync: async (selector: { parentId?: string, filters?: FilterGroup<D[E]["fromStorage"]> }) => {
					if (this.cache !== undefined) {
						if (this.cache[dto.name].find(entry => entry.type === "multiple"
							&& entry.parentEntityId === selector.parentId
							&& entry.filters === JSON.stringify(selector.filters)
						) === undefined) {
							this.cache[dto.name].push({
								type: "multiple",
								parentEntityId: selector.parentId || "",
								filters: JSON.stringify(selector.filters),
								content: this.io.getAsync({ entity: dto.name as string, parentId: selector?.parentId, filters: selector?.filters })
							})
						}
						return this.cache[dto.name].find(entry => entry.type === "multiple"
							&& entry.parentEntityId === selector.parentId
							&& entry.filters === JSON.stringify(selector.filters)
						)?.content
					}
					else {
						return this.io.getAsync({ entity: dto.name as string, parentId: selector?.parentId, filters: selector?.filters })
					}
				},
				saveAsync: async (obj: D[E]["toStorage"][]) => {
					const resultPromise = obj[0].id
						? this.io.saveAsync({ entity: dto.name as string, obj: obj, mode: "update" })
						: this.io.saveAsync({ entity: dto.name as string, obj: obj, mode: "insert" })

					resultPromise.then(results => {
						results.forEach(result => {
							// We invalidate the findAsync cache of all entities with that id (so that updates work)
							result.id !== undefined ? this.bustCache(dto.name, { type: "single", entityId: result.id as string }) : undefined

							// We invalidate all getAsync cache entries for entities with the same parent (when adding a table, the getTable of that project will be refreshed)
							const effectiveParentId = dto.parentName !== "" ? result[`${singular(dto.parentName as string)}Id`].toString() : ""
							this.bustCache(dto.name, { type: "multiple", parentEntityId: effectiveParentId })
						})
					})
					return resultPromise
				},
				deleteAsync: async (id: string) => {
					const deletedEntity = await this.io.deleteAsync({ entity: dto.name as string, id: id })
					// We invalidate the findAsync cache of all entities with that id (so that updates work)
					this.bustCache(dto.name, { type: "single", entityId: id })

					// We invalidate all getAsync cache entries for entities with the same parent (when adding a table, the getTable of that project will be refreshed)
					const effectiveParentId = dto.parentName !== "" ? deletedEntity[`${singular(dto.parentName as string)}Id`].toString() : ""
					this.bustCache(dto.name, { type: "multiple", parentEntityId: effectiveParentId })
					return deletedEntity
				},
				deleteManyAsync: async (args: { parentId: string } | { ids: string[] }) => this.io.deleteManyAsync
					? this.io.deleteManyAsync({
						entity: dto.name as string,
						..."parentId" in args
							? { parentId: args["parentId"] }
							: { ids: args["ids"] }
					})
					: undefined
			} as Repository<D, E>
		}

		get extensions() { return this.io.extensions }
	} as any
}