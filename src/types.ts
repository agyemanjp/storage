/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/ban-types */
import { Obj } from "@sparkwave/standard/utility"
import { FilterGroup } from "@sparkwave/standard/collections/"

export interface Ctor<TArgs = unknown, TObj = Obj> { new(args: TArgs): TObj }

export interface IOProvider<S extends Schema, X extends Obj = Obj> {
	/** Find one entity object; throws exception if not found */
	findAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<From<S, E>>

	/** Get a set of entity objects */
	getAsync: <E extends keyof S>(_: { entity: E, parentId?: string, filters?: FilterGroup<From<S, E>> }) => Promise<From<S, E>[]>

	/** Insert or update a set of entity objects */
	saveAsync: <E extends keyof S>(_: { entity: E, data: To<S, E>[], mode: "insert" | "update" }) => Promise<From<S, E>[]>

	deleteAsync: <E extends keyof S>(_: { entity: E, id: string }) => Promise<From<S, E>>
	deleteManyAsync?: <E extends keyof S>(_: { entity: E } & ({ ids: string[] } | { parentId: string })) => Promise<From<S, E>[]>

	extensions: X
}

export type EntityCache<S extends Schema> = {
	[e in keyof S]: {
		objects: Obj<Promise<EntityType<S[e]["fromStorage"]>>, string /*entityId*/>,
		collections: Obj<Promise<EntityType<S[e]["fromStorage"]>[]>, string /* {parentEntityId, filters (as JSON)} */>,
	}
}

export interface RepositoryReadonly<Out extends Obj> {
	/** find one entity object with a specific id, throws exception if not found */
	findAsync(id: string): Promise<Out>

	/** get entity objects with optional parent and additional filters ... */
	getAsync(args: { parentId: string, filters?: FilterGroup<Out> }): Promise<Out[]>
}

export interface Repository<In extends Obj, Out extends Obj> extends RepositoryReadonly<Out> {
	saveAsync: (data: In[], mode: "insert" | "update") => Promise<Out[]>
	deleteAsync: (id: string) => Promise<Out>
	deleteManyAsync?: (args: { parentId: string } | { ids: string[] }) => Promise<Out[]>
}

type PrimitiveTypeString = "string" | "number" | "boolean"
type PrimitiveType<T extends PrimitiveTypeString> = (T extends "string" ? string : T extends "number" ? number : boolean)

/** Entity specification in terms of fields. By convention, "id" field, if present, is the primary key */
type PrimitiveField = PrimitiveTypeString | { type: PrimitiveTypeString, isNullable?: boolean }
type ObjectField = "object" | { type: "object", valueType: Field, isNullable?: boolean }
type ArrayField = "array" | { type: "array", arrayType: Field, isNullable?: boolean }
type Field = PrimitiveField | ArrayField | ObjectField | Obj<PrimitiveField | ArrayField | ObjectField>

type PrimitiveFieldType<F extends PrimitiveField> = (F extends { type: PrimitiveTypeString, isNullable?: boolean }
	? PrimitiveType<F["type"]>
	: F extends PrimitiveTypeString
	? PrimitiveType<F>
	: never
)
type ObjectFieldType<F extends ObjectField> = (F extends "object"
	? Obj
	: F extends { type: "object", valueType: PrimitiveField, isNullable?: boolean }
	? PrimitiveFieldType<F["valueType"]>
	: F extends { type: "object", valueType: ArrayField, isNullable?: boolean }
	? ArrayFieldType<F["valueType"]>
	: F extends { type: "object", valueType: ObjectField, isNullable?: boolean }
	? Obj<Obj>
	: never
)
type ArrayFieldType<F extends ArrayField> = (F extends "array"
	? unknown[]
	: F extends { type: "array", arrayType: Field, isNullable?: boolean }
	? Array<FieldType<F["arrayType"]>>
	: never
)
type FieldType<F extends Field> = (
	F extends PrimitiveField ? PrimitiveFieldType<F> :
	F extends ObjectField ? ObjectFieldType<F> :
	F extends ArrayField ? ArrayFieldType<F> :
	never
)

export type Entity = Obj<Field>
export type EntityType<E extends Entity | undefined> = {
	[k in keyof E]: E[k] extends Field
	? FieldType<E[k]>
	: never
}

export type Schema = Obj<{
	/** Entity type to storage, if entity is read-write */
	toStorage?: Entity
	/** Entity type from storage, merged with toStorage type, if present; So no need to repeat fields from toStorage */
	fromStorage: Entity
}>

export type To<S extends Schema, E extends keyof S> = EntityType<S[E]["toStorage"]>
export type From<S extends Schema, E extends keyof S> = To<S, E> & EntityType<S[E]["fromStorage"]>

export type RepositoryGroup<S extends Schema, X extends Obj = {}> = {
	[key in keyof S]: (
		To<S, key> extends never
		? RepositoryReadonly<From<S, key>>
		: Repository<To<S, key>, From<S, key>>
	)
} & {
	/** A method to remove an entry from the cache */
	invalidateCache: (entity: keyof S, key?: { objectId: string } | { parentId: string }) => void
} & {
	extensions: X
}



// Test

// eslint-disable-next-line @typescript-eslint/no-unused-vars, init-declarations, fp/no-let

/*export interface IOProvider<M extends Schema, X extends Obj = Obj> {
	// find one entity object; throws exception if not found
	findAsync: <E extends keyof M>(args: { entity: E, id: string }) => Promise<M[E]["fromStorage"]>

	// get a set of entity objects
	getAsync: <E extends keyof M>(args: { entity: E, parentId?: string, filters?: FilterGroup<M[E]["fromStorage"]> }) => Promise<M[E]["fromStorage"][]>

	saveAsync: <E extends keyof M>(args: { entity: E, obj: M[E]["toStorage"][], mode: "insert" | "update" }) => Promise<M[E]["fromStorage"][]>
	deleteAsync: <E extends keyof M>(args: { entity: E, id: string }) => Promise<M[E]["fromStorage"]>
	deleteManyAsync?: <E extends keyof M>(args: { entity: E } & ({ ids: string[] } | { parentId: string })) => Promise<M[E]["fromStorage"][]>
	extensions: X
}*/
