
import { DTOsMap, IOProvider, Ctor, FilterGroup } from "./types"

export interface RepositoryReadonly<D extends DTOsMap, E extends keyof D> {
	/** find one entity object with a specific id, throws exception if not found */
	findAsync(id: string): Promise<D[E]["fromStorage"]>

	/** get entity objects with optional parent and additional filters ... */
	getAsync(args: { parentId: string, filters?: FilterGroup<D[E]["fromStorage"]> }): Promise<D[E]["fromStorage"][]>
}
export interface RepositoryEditable<D extends DTOsMap, E extends keyof D> extends RepositoryReadonly<D, E> {
	saveAsync: (obj: D[E]["toStorage"]) => Promise<D[E]["fromStorage"]>
}
export interface Repository<D extends DTOsMap, E extends keyof D> extends RepositoryEditable<D, E> {
	deleteAsync: (id: string) => Promise<void>
}
export type RepositoryGroup<D extends DTOsMap> = { [key in keyof D]: Repository<D, Extract<keyof D, string>> }

/**
 * 
 * @param ioProviderClass 
 * @param repos The individual repositories: tables, users...
 */
export function generate<X, D extends DTOsMap>(ioProviderClass: Ctor<object, IOProvider<X, D>>): new (config: object, dtoNames: Extract<keyof D, string>[]) => RepositoryGroup<D> {
	return class {
		readonly io: Readonly<IOProvider<X>>

		constructor(config: object, dtoNames: Extract<keyof D, string>[]) {
			try {
				this.io = new ioProviderClass(config)
			}
			catch (err) {
				throw new Error(`Repository group constructor : ${err} `)
			}
			console.assert(this.io !== undefined, `Repository group this.io after construction is still undefined`)
			dtoNames.forEach(prop => {
				this[prop as string] = this.createRepository(prop) as Repository<D, typeof prop>
			})
		}
		protected createRepository<E extends Extract<keyof D, string>>(e: E) {
			return {
				findAsync: async (id: string) => this.io.findAsync({ entity: e, id: id }),
				getAsync: async (selector?: { parentId?: string, filters?: FilterGroup<D[E]["fromStorage"]> }) => {
					return this.io.getAsync({ entity: e, parentId: selector?.parentId, filters: selector?.filters })
				},
				saveAsync: async (obj: D[E]["toStorage"]) => {
					return obj.id
						? this.io.saveAsync({ entity: e, obj, mode: "update" })
						: this.io.saveAsync({ entity: e, obj, mode: "insert" })
				},
				// updateAsync: async (obj: ToStore<E>) => this.io.saveAsync({ entity: e, obj, mode: "update" }),
				deleteAsync: async (id: string) => this.io.deleteAsync({ entity: e, id })
			} as Repository<D, E>
		}

		get extensions() { return this.io.extensions }
	} as any
}