/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable brace-style */

import { Obj, Tuple, hasValue } from "@sparkwave/standard/utility"
import { FilterGroup } from "@sparkwave/standard/collections/containers/table"
import { keys, mapObject, fromKeyValues as objFromKeyValues } from "@sparkwave/standard/collections/object"

import { TypeFromEntity, Entity, IOProvider, Repository, RepositoryReadonly, RepositoryGroup, Schema } from "./types"


type CacheEntry<T extends Obj> = (
	| { type: "single"; entityId: string; content?: Promise<T> }
	| { type: "multiple"; parentEntityId: string; filters?: string; content?: Promise<T[]> }
)
type EntityCache<S extends Schema> = {
	[entityName in keyof S]: CacheEntry<TypeFromEntity<S[entityName]["fromStorage"]>>[]
}

/** Generates a repository group from the io provider
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function generateRepositoryGroup<S extends Schema, Cfg extends Obj | void = void, X extends Obj = {}>(args:
	{ ioProvider: (cf: Cfg) => IOProvider<keyof S, X>, schema: S }): (config: Cfg) => RepositoryGroup<S, X> {

	return (config: Cfg) => {
		const cache: EntityCache<S> = objFromKeyValues(keys(args.schema).map(e => new Tuple(e, [])))

		try {
			const io = args.ioProvider(config)

			// eslint-disable-next-line no-shadow
			const makeRepository = <E extends keyof S>(e: E, cache?: EntityCache<S>) => {
				type FromStorage = TypeFromEntity<S[E]["fromStorage"]>
				type ToStorage = S[E]["toStorage"] extends Entity
					? FromStorage & TypeFromEntity<S[E]["toStorage"]>
					: FromStorage

				return {
					findAsync: async (id: string) => {
						if (hasValue(cache) && hasValue(cache[e])) {
							if (!hasValue(cache[e].find(entry => entry.type === "single" && entry.entityId === id))) {
								// eslint-disable-next-line fp/no-mutating-methods
								cache[e].push({
									type: "single",
									entityId: id,
									content: io.findAsync({ entity: e, id: id })
								})
							}
							return cache[e].find(entry => entry.type === "single" && entry.entityId === id)?.content
						}
						else {
							return io.findAsync({ entity: e, id: id })
						}
					},

					getAsync: async (selector: { parentId?: string, filters?: FilterGroup<FromStorage> }) => {
						if (hasValue(cache) && hasValue(cache[e])) {
							if (!hasValue(cache[e].find(entry => entry.type === "multiple"
								&& entry.parentEntityId === selector.parentId
								&& entry.filters === JSON.stringify(selector.filters)
							))) {

								// eslint-disable-next-line fp/no-mutating-methods
								cache[e].push({
									type: "multiple",
									parentEntityId: selector.parentId || "",
									filters: JSON.stringify(selector.filters),
									content: io.getAsync({
										entity: e,
										parentId: selector?.parentId,
										filters: selector?.filters
									})
								})
							}

							return cache[e].find(entry => entry.type === "multiple"
								&& entry.parentEntityId === selector.parentId
								&& entry.filters === JSON.stringify(selector.filters)
							)?.content
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

				} as ToStorage extends Entity ? Repository<ToStorage, FromStorage> : RepositoryReadonly<FromStorage>
			}

			const repos = {
				...mapObject(args.schema, (entityInfo, e: keyof S) => makeRepository(e, cache))
			}
			return { ...repos, extensions: io.extensions } as RepositoryGroup<S, X>
		}
		catch (err) {
			throw new Error(`Error creating io provider: ${err} `)
		}
	}
}

