/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
import { Obj, Tuple, ExtractByType, KeysByType, TableFilter, FilterGroup } from "@agyemanjp/standard"

export interface Ctor<TArgs = unknown, TObj = Obj> { new(args: TArgs): TObj }


type PrimitiveTypeString = "string" | "number" | "boolean" | "unknown"
export type PrimitiveField = PrimitiveTypeString | { type: PrimitiveTypeString, nullable?: boolean }
export type ObjectField = "object" | { type: "object", valueType: Field, nullable?: boolean }
export type ArrayField = "array" | { type: "array", arrayType: Field, nullable?: boolean }
export type Field = PrimitiveField | ArrayField | ObjectField | Obj<PrimitiveField | ArrayField | ObjectField>

export type NullableType<T, Nullable extends boolean | undefined> = Nullable extends true ? (T | undefined) : T

export type PrimitiveType<T extends PrimitiveTypeString> = (
	T extends "unknown" ? unknown :
	T extends "string" ? string :
	T extends "number" ? number
	: boolean
)
export type PrimitiveFieldType<F extends PrimitiveField> = (F extends { type: PrimitiveTypeString, nullable?: boolean }
	? NullableType<PrimitiveType<F["type"]>, F["nullable"]>
	: F extends PrimitiveTypeString
	? PrimitiveType<F>
	: never
)
/*export type IdFieldType<F extends IdField> = (F extends { type: "id", idType: "string" | "number" }
	? PrimitiveType<F["idType"]>
	: F extends PrimitiveTypeString
	? PrimitiveType<F>
	: never
)*/
export type ObjectFieldType<F extends ObjectField> = (F extends "object"
	? Obj
	: F extends { type: "object", valueType: PrimitiveField, nullable?: boolean }
	? NullableType<PrimitiveFieldType<F["valueType"]>, F["nullable"]>
	: F extends { type: "object", valueType: ArrayField, nullable?: boolean }
	? ArrayFieldType<F["valueType"]>
	: F extends { type: "object", valueType: ObjectField, nullable?: boolean }
	? Obj<Obj>
	: never
)
export type ArrayFieldType<F extends ArrayField> = (F extends "array"
	? unknown[]
	: F extends { type: "array", arrayType: Field, nullable?: boolean }
	? NullableType<Array<FieldType<F["arrayType"]>>, F["nullable"]>
	: never
)
export type FieldType<F extends Field> = (
	F extends PrimitiveField ? PrimitiveFieldType<F> :
	F extends ObjectField ? ObjectFieldType<F> :
	F extends ArrayField ? ArrayFieldType<F> :
	F extends Obj<PrimitiveField | ArrayField | ObjectField> /*& { id: "string" | "number" }*/ ? EntityType<{ fields: F }> :
	never
)

export interface Entity {
	fields: Obj<Field>;
	readonly?: boolean;
	parent?: string
	idField?: keyof this["fields"]
}

export type Schema = Obj<Entity>
export type EntityType<E extends Entity> = { [k in keyof E["fields"]]: FieldType<E["fields"][k]> }


export type IOProvider<Cfg, S extends Schema> = (config: Cfg) => {
	findAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<EntityType<S[E]>>
	getAsync: <E extends keyof S>(_: { entity: E, filters?: FilterGroup }) => Promise<EntityType<S[E]>[]>

	insertAsync: <E extends keyof S>(_: { entity: E, obj: EntityType<S[E]> }) => Promise<void>
	updateAsync: <E extends keyof S>(_: { entity: E, obj: EntityType<S[E]> }) => Promise<void>

	deleteAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<void>
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
	getAsync(filters?: FilterGroup, refreshCache?: boolean): Promise<T[]>
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

export type RepositoryGroup<Cfg, S extends Schema> = (config: Cfg) => {
	[key in keyof S]: (
		S[key]["readonly"] extends false
		? Repository<EntityType<S[key]>>
		: RepositoryReadonly<EntityType<S[key]>>
	)
}

type ObjectId = string
type FilterKey = string | "N/A"
export type EntityCacheGroup<S extends Schema> = {
	[e in keyof S]: {
		objects: Obj<[entity: EntityType<S[e]>, timeStamp: number], ObjectId>,
		vectors: Obj<[vector: Promise<EntityType<S[e]>[]>, timeStamp: number], FilterKey>
	}
}
