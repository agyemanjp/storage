/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-misused-new */
import { IOProvider, Schema } from "./types"
import { Obj, Filter, FilterGroup, keys, hasValue } from "@agyemanjp/standard"

export function asIOProvider<S extends Schema, Cfg>(dbProvider: DbProviderCtor<Cfg>): (_: Cfg) => IOProvider<S> {
	return ((config: Cfg) => {
		const db = new dbProvider(config)
		return {
			findAsync: async (args) => db.queryOne(db.select(String(args.entity), { fieldName: "id", operator: "equals", value: args.id })),
			getAsync: async (args) => {
				return db.queryMany(db.select(String(args.entity), args.filter as any))
			},
			insertAsync: async (args) => db.queryAny(db.insert(String(args.entity), args.obj)),
			updateAsync: async (args) => db.queryAny(db.update(String(args.entity), args.obj)),
			deleteAsync: async (args) => db.queryAny(db.delete(String(args.entity), args.id))
		}
	}) as (_: Cfg) => IOProvider<S>
}

export interface DbProvider {
	queryOne<T extends Obj<DbPrimitive>>(sql: string): Promise<T>
	queryMany<T extends Obj<DbPrimitive>>(sql: string): Promise<T[]>
	queryAny(sql: string): unknown

	insert<T extends Obj<DbPrimitive>>(tablename: string, data: T): string
	update<T extends Obj<DbPrimitive>>(tablename: string, data: T): string
	delete(tablename: string, id: any): string
	select<F extends Filter<Obj<DbPrimitive>> | FilterGroup<Obj<DbPrimitive>>>(rowsetName: string, filters?: F): string
}
export interface DbProviderCtor<Cfg> {
	new(config: Cfg): DbProvider
}

export abstract class PostgresDbProvider implements DbProvider {
	abstract queryOne<T>(sql: string): Promise<T>
	abstract queryMany<T>(sql: string): Promise<T[]>
	abstract queryAny(sql: string): any

	/** Turn the input value into a string that can be directly interpolated into an sql string */
	protected interpolatableValue(value: Exclude<DbPrimitive, null>): string {
		return typeof value === "number" ? `${value}` : `'${String(value)}'`
	}
	/** Turn the input column name into a string that can be directly interpolated into an sql string */
	protected interpolatableColumnName(columnName: string): string {
		return columnName
		// return toSnakeCase(columnName).toLowerCase()
	}

	/** Turn the input rowset (table, view, tablevalued UDF, etc) name into a string that can be directly interpolated into an sql string */
	protected interpolatableRowsetName(rowsetName: string): string {
		return rowsetName
		// return toSnakeCase(rowsetName).toLowerCase()
	}

	protected predicateTemplates(): Obj<undefined | ((x: DbPrimitive) => string), Required<Filter>["operator"]> {
		return {
			equals: x => hasValue(x) ? `= ${this.interpolatableValue(x)}` : `is NULL`,
			not_equal_to: x => hasValue(x) ? `<> ${this.interpolatableValue(x)}` : `is not NULL`,
			greater_than: x => hasValue(x) ? `> ${this.interpolatableValue(x)}` : `> NULL`,
			less_than: x => hasValue(x) ? `< ${this.interpolatableValue(x)}` : `< NULL`,
			greater_than_or_equals: x => hasValue(x) ? `>= ${this.interpolatableValue(x)}` : `>= NULL`,
			less_than_or_equals: x => hasValue(x) ? `<= ${this.interpolatableValue(x)}` : `<= NULL`,
			contains: x => hasValue(x) ? `like ${this.interpolatableValue('%' + String(x) + '%')}` : `like ${this.interpolatableValue('')}`,
			ends_with: x => hasValue(x) ? `like ${this.interpolatableValue('%' + String(x))}` : `like ${this.interpolatableValue('')}`,
			starts_with: x => hasValue(x) ? `like ${this.interpolatableValue(String(x))}` : `like ${this.interpolatableValue('')}`,
			is_outlier_by: undefined,
			is_blank: undefined,
			is_contained_in: undefined,
			"in": undefined
		}
	}

	insert<T extends Obj<DbPrimitive>>(tablename: string, data: T): string {
		const columns = keys(data).map(k => this.interpolatableColumnName(k)).join(", ")
		const values = keys(data).map(k => this.interpolatableValue(data[k] ?? `NULL`)).join(", ")
		return `INSERT INTO ${this.interpolatableRowsetName(tablename)}(${columns}) VALUES (${values}) ($1)`
	}

	update<T extends Obj<DbPrimitive>>(tablename: string, data: T): string {
		const assignments = keys(data).map(k => `${this.interpolatableColumnName(k)} = ${this.interpolatableValue(data[k] ?? `NULL`)}`).join(", ")
		return `UPDATE ${this.interpolatableRowsetName(tablename)} SET ${assignments}`
	}

	delete(tablename: string, id: any): string {
		return `DELETE FROM ${this.interpolatableRowsetName(tablename)} WHERE id=${this.interpolatableValue(id)}`
	}

	select(rowsetName: string, filter?: Filter<Obj<DbPrimitive>> | FilterGroup<Obj<DbPrimitive>>): string {
		return `SELECT * FROM ${this.interpolatableRowsetName(rowsetName)}() WHERE ${this.getWhereClause(filter)}`
	}

	getWhereClause(filter?: Filter<Obj<DbPrimitive>> | FilterGroup<Obj<DbPrimitive>>): string {
		const filterGroup = filter
			? "combinator" in filter
				? filter
				: { filters: [filter] }
			: undefined


		return !filterGroup || filterGroup.filters.length == 0
			? `1=1`
			: filterGroup.filters
				.map(f => {
					if ('fieldName' in f) { // this is a Filter object, not a FilterGroup
						const exprTemplate = this.predicateTemplates()[f.operator]
						if (exprTemplate === undefined)
							throw new Error(`SQL Filtering operator "${f.operator}"`)
						return `${f.negated ? "NOT " : ""}${this.interpolatableColumnName(f.fieldName)} ${exprTemplate("value" in f ? f.value as DbPrimitive : null as DbPrimitive)}`
					}
					else {
						return `(${this.getWhereClause(f)})`
					}
				})
				.join(` ${(filterGroup.combinator as string || "and")} `)
	}
}

type DbPrimitive = string | number | boolean | null

/*type Driver<S extends Schema, Cfg extends Obj | void> = ((config: Cfg) => (query: string) => any) & {
	sqlBuilders: {
		query: (args: {
			rowset: string,
			filter?: FilterGroup,
			groupExpressions: string[],
			sortExpressions: string[]
		}) => string,
		insert: <T> (args: { table: string, record: T, }) => string,
		update: <T> (args: { table: string, record: T, }) => string,
		delete: (args: { table: string, id: any, }) => string,
	}
}*/


