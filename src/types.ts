/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
import { Obj, Tuple, ExtractByType, KeysByType, FilterSimple, FilterGroupSimple } from "@agyemanjp/standard"

export interface Ctor<TArgs = unknown, TObj = Obj> { new(args: TArgs): TObj }
export type NullableType<T, Nullable extends boolean | undefined> = Nullable extends true ? (T | null) : T
export type Primitive = string | number | boolean
type PrimitiveTypeString = "string" | "number" | "boolean"
export type PrimitiveType<T extends PrimitiveTypeString> = (
	T extends "string" ? string :
	T extends "number" ? number
	: boolean
)

export type Field = PrimitiveTypeString | { type: PrimitiveTypeString, nullable?: boolean }
export type FieldType<F extends Field> = (F extends { type: PrimitiveTypeString, nullable?: boolean }
	? NullableType<PrimitiveType<F["type"]>, F["nullable"]>
	: F extends PrimitiveTypeString
	? PrimitiveType<F>
	: never
)

export interface Entity {
	fields: Obj<Field>;
	readonly?: boolean;
	parent?: string
	idField?: keyof this["fields"]
}

export type EntityType<E extends Entity> = { [k in keyof E["fields"]]: FieldType<E["fields"][k]> }

export type Schema = Obj<Entity>

export type IOProvider<S extends Schema = Schema> = {
	findAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<EntityType<S[E]>>
	getAsync: <E extends keyof S>(_: { entity: E, filter?: FilterSimple | FilterGroupSimple }) => Promise<EntityType<S[E]>[]>

	insertAsync: <E extends keyof S>(_: { entity: E, obj: EntityType<S[E]> }) => Promise<void>
	updateAsync: <E extends keyof S>(_: { entity: E, obj: EntityType<S[E]> }) => Promise<void>

	deleteAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<void>

	/** Run a provider-specific operation */
	runAsync: (operation: string, args: any) => Promise<any>
}

export interface RepositoryReadonly<T extends Obj> {
	/** Get one entity object with a specific id from the underlying data-source
	 ** Throws an exception if the entity object is not found.
	 ** @argument refreshCache If true, the cache will be invalidated
	 */
	findAsync(id: string, refreshCache?: boolean): Promise<T>

	/** Get entity objects from the underlying data-source
	 ** @argument filters Optional filters to apply to the objects retrieved
	 ** @argument refreshCache If true, cache will be invalidated before the the objects are retrieved
	 */
	getAsync(filter?: FilterSimple | FilterGroupSimple, refreshCache?: boolean): Promise<T[]>
}
export interface Repository<T extends Obj /*& { id: string | number }*/> extends RepositoryReadonly<T> {
	/** Insert one or more entity objects in underlying data source
	 * Throws an exception if any id conflict occurs 
	 */
	insertAsync: (objects: T) => Promise<void>

	/** Update one or more objects in underlying data source
	 * Throws an exception if any id is not found in the data source 
	 */
	updateAsync: (objects: T) => Promise<void>

	/** Delete one of more entity objects, identified by the passed ids, in underlying data source.
	 * Throws an error if any of the ids are not found
	 */
	deleteAsync: (id: string) => Promise<void>
}

export type RepositoryGroup<S extends Schema, X extends Obj = Obj<never>> = (
	{
		[key in keyof S]: (
			S[key]["readonly"] extends false
			? Repository<EntityType<S[key]>>
			: RepositoryReadonly<EntityType<S[key]>>
		)
	} &
	{
		extensions: X
	}
)
export type RepositoryGroupCtor<Cfg, S extends Schema, X extends Obj = {}> = {
	new(config: Cfg): {
		/** Get one entity object with a specific id from the underlying data-source
		 ** Throws an exception if the entity object is not found.
		 ** @argument refreshCache If true, the cache will be invalidated
		 */
		findAsync<E extends keyof S>(entity: E, id: string, refreshCache?: boolean): Promise<EntityType<S[E]>>

		/** Get entity objects from the underlying data-source
		 ** @argument filters Optional filters to apply to the objects retrieved
		 ** @argument refreshCache If true, cache will be invalidated before the the objects are retrieved
		 */
		getAsync<E extends keyof S>(entity: E, filters?: FilterSimple | FilterGroupSimple, refreshCache?: boolean): Promise<EntityType<S[E]>[]>

		/** Insert one or more entity objects in underlying data source
		 * Throws an exception if any id conflict occurs 
		 */
		insertAsync<E extends keyof S>(entity: E, obj: EntityType<S[E]>): Promise<void>

		/** Update one or more objects in underlying data source
		 * Throws an exception if any id is not found in the data source 
		 */
		updateAsync<E extends keyof S>(entity: E, obj: EntityType<S[E]>): Promise<void>

		/** Delete one of more entity objects, identified by the passed ids, in underlying data source.
		 * Throws an error if any of the ids are not found
		 */
		deleteAsync<E extends keyof S>(entity: E, id: string): Promise<void>

		extensions: X
	}
}


type ObjectId = string
type FilterKey = string | "N/A"
export type EntityCacheGroup<S extends Schema> = {
	[e in keyof S]: {
		objects: Obj<[entity: EntityType<S[e]>, timeStamp: number], ObjectId>,
		vectors: Obj<[vector: Promise<EntityType<S[e]>[]>, timeStamp: number], FilterKey>
	}
}
