/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
import { Obj, Tuple, ExtractByType, KeysByType } from "@sparkwave/standard/utility"
import { FilterGroup } from "@sparkwave/standard/collections/"

export interface Ctor<TArgs = unknown, TObj = Obj> { new(args: TArgs): TObj }


type PrimitiveTypeString = "string" | "number" | "boolean" | "unknown"
export type PrimitiveField = PrimitiveTypeString | { type: PrimitiveTypeString, nullable?: boolean }
export type ObjectField = "object" | { type: "object", valueType: Field, nullable?: boolean }
export type ArrayField = "array" | { type: "array", arrayType: Field, nullable?: boolean }
export type Field = PrimitiveField | ArrayField | ObjectField | Obj<PrimitiveField | ArrayField | ObjectField>

export type NullableType<T, Nullable extends boolean | undefined> = Nullable extends true ? (T | undefined | void) : T

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

export type EntityType<E extends Entity> = { [k in keyof E["fields"]]: FieldType<E["fields"][k]> }

export type Schema = Obj<Entity>

type T<S extends Schema, E extends keyof S> = EntityType<S[E]>

export interface IOProvider<S extends Schema, X extends Obj = Obj> {
	findAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<T<S, E>>
	getAsync: <E extends keyof S>(_: { entity: E, filters?: FilterGroup<T<S, E>> }) => Promise<T<S, E>[]>

	insertAsync: <E extends keyof S>(_: { entity: E, objects: T<S, E>[] }) => Promise<void>
	updateAsync: <E extends keyof S>(_: { entity: E, objects: T<S, E>[] }) => Promise<void>

	deleteAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<void>

	extensions: X
}

export interface RepositoryReadonly<T extends Obj> {
	/** Get one entity object with a specific id from underlying data-source
	 * Throws exception if not found
	 */
	findAsync(id: string): Promise<T>

	/** Get entity objects from underlying data-source with optional filters ... */
	getAsync(filters?: FilterGroup<T>): Promise<T[]>
}
export interface Repository<T extends Obj /*& { id: string | number }*/> extends RepositoryReadonly<T> {
	/** Insert one or more entity objects in underlying data source
	 * Throws an exception if any id conflict occurs 
	 */
	insertAsync: (objects: T[]) => Promise<void>

	/** Update one or more objects in underlying data source
	 * Throws an exception if any id is not found in the data source 
	 */
	updateAsync: (objects: T[]) => Promise<void>

	/** Delete one of more entity objects, identified by the passed ids, in underlying data source.
	 * Throws an error if any of the ids are not found
	 */
	deleteAsync: (id: string) => Promise<void>
}

export type RepositoryGroup<S extends Schema, X extends Obj | undefined = {}> = {
	[key in keyof S]: (
		S[key]["readonly"] extends false
		? Repository<T<S, key>>
		: RepositoryReadonly<T<S, key>>
	)
} & {
	/*invalidateCache: (entity: keyof S, info?: {
		parentId?: string,
		operation: "delete" | "insert" | "update",
		objecIds: string[] | number[]
	}) => void*/

	extensions: X
}

type FilterKey = string | "N/A"
type ObjectId = string
export type EntityCacheGroup<S extends Schema> = {
	[e in keyof S]: {
		objects: Obj<[entity: T<S, e>, timeStamp: number], ObjectId>,
		vectors: Obj<[vector: Promise<T<S, e>[]>, timeStamp: number], FilterKey>
	}
}
