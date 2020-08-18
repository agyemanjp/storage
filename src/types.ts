export type Obj<TValue = any, TKey extends string = string> = { [key in TKey]: TValue }
export type ExtractByType<TObj, TType> = Pick<TObj, { [k in keyof TObj]-?: TObj[k] extends TType ? k : never }[keyof TObj]>
export type Primitive = number | string

export interface Ctor<TArgs = {}, TObj = {}> { new(args: TArgs): TObj }

type DTO = {
	toStorage: Object & { id?: string }
	fromStorage: Object
}
export type DTOsMap = { [key: string]: DTO }

export interface IOProvider<X = {}, D extends DTOsMap = DTOsMap> {
	/** find one entity object, throws exception if not found */
	findAsync: <E extends Extract<keyof D, string>>(args: { entity: E, id: string }) => Promise<D[E]["fromStorage"]>

	/** get a set of entity objects */
	getAsync: <E extends Extract<keyof D, string>>(args: { entity: E, parentId?: string, filters?: FilterGroup<D[E]["fromStorage"]> }) => Promise<D[E]["fromStorage"][]>

	saveAsync: <E extends Extract<keyof D, string>>(args: {
		entity: E,
		obj: D[E]["toStorage"][],
		mode: "insert" | "update"
	}) => Promise<D[E]["fromStorage"][]>
	deleteAsync: <E extends Extract<keyof D, string>>(args: { entity: E, id: string }) => Promise<void>
	deleteManyAsync?: <E extends Extract<keyof D, string>>(args: { entity: E } & { ids: string[] } | { parentId: string }) => Promise<void>

	extensions: X
}

export namespace Filters {
	export interface Base<TObj extends Obj<Primitive>, TVal extends Primitive | null> {
		fieldName: keyof (ExtractByType<TObj, TVal>),
		value: TVal,
		negated?: boolean
	}
	export interface Categorical<T extends Obj<Primitive>> extends Base<T, Primitive | null> {
		operator: "equal" | "not_equal",
	}
	export interface Ordinal<T extends Obj<Primitive>> extends Base<T, number> {
		operator: "greater" | "greater_or_equal" | "less" | "less_or_equal",
		negated?: boolean
	}
	export interface Textual<T extends Obj<Primitive>> extends Base<T, string> {
		operator: "contains" | "starts_with" | "ends_with",
	}
	export interface Statistical<T extends Obj<Primitive>> extends Base<T, number> {
		operator: "is_outlier_by",
		/** number of std. deviations (possibly fractional) */
		//value: number
	}
}
type Filter<T extends Obj<Primitive> = Obj<Primitive>> = (
	| Filters.Categorical<T>
	| Filters.Ordinal<T>
	| Filters.Textual<T>
	| Filters.Statistical<T>
)

export interface FilterGroup<T extends Obj = Obj> {
	/** combinator default is "and" */
	combinator?: "or" | "and",

	filters: (Filter<T> | FilterGroup<T>)[]
}