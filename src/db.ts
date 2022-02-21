/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-misused-new */
import { IOProvider, Schema, Entity, EntityType } from "./types"
import { Primitive, Obj, Filter, FilterGroup, toSnakeCase, keys } from "@agyemanjp/standard"

export function dbToIO<S extends Schema, Cfg>(dbProvider: DbProviderCtor<Cfg>): IOProvider<Cfg, S> {
	return ((config: Cfg) => {
		const db = new dbProvider(config)
		return {
			findAsync: async (args) => db.queryOne(db.select(String(args.entity), { fieldName: "id", operator: "equal", value: args.id })),
			getAsync: async (args) => db.queryMany(db.select(String(args.entity), args.filters)),
			insertAsync: async (args) => db.queryAny(db.insert(String(args.entity), args.obj)),
			updateAsync: async (args) => db.queryAny(db.update(String(args.entity), args.obj)),
			deleteAsync: async (args) => db.queryAny(db.delete(String(args.entity), args.id))
		}
	}) as IOProvider<Cfg, S>
}

export interface DbProvider {
	queryOne<T extends Obj>(sql: string): Promise<T>
	queryMany<T extends Obj>(sql: string): Promise<T[]>
	queryAny(sql: string): any

	insert<T extends Obj>(tablename: string, data: T): string
	update<T extends Obj>(tablename: string, data: T): string
	delete(tablename: string, id: any): string
	select(rowsetName: string, filters?: Filter | FilterGroup): string
}
export interface DbProviderCtor<Cfg> {
	new(config: Cfg): DbProvider
}

export abstract class PostgresDbProvider implements DbProvider {

	abstract queryOne<T>(sql: string): Promise<T>
	abstract queryMany<T>(sql: string): Promise<T[]>
	abstract queryAny(sql: string): any

	/** Turn the input value into a string that can be directly interpolated into an sql string */
	protected interpolatableValue(value: any): string {
		return typeof value === "number" ? `${value}` : `'${String(value)}'`
	}
	/** Turn the input column name into a string that can be directly interpolated into an sql string */
	protected interpolatableColumnName(columnName: string): string {
		return toSnakeCase(columnName).toLowerCase()
	}

	/** Turn the input rowset (table, view, tablevalued UDF, etc) name into a string that can be directly interpolated into an sql string */
	protected interpolatableRowsetName(rowsetName: string): string {
		return toSnakeCase(rowsetName).toLowerCase()
	}

	protected predicateTemplates(): Obj<undefined | ((x: Primitive | null) => string), Required<Filter>["operator"]> {
		return {
			equal: x => x ? `= ${this.interpolatableValue(x)}` : `is NULL`,
			not_equal: x => x ? `<> ${this.interpolatableValue(x)}` : `is not NULL`,
			greater: x => `> ${this.interpolatableValue(x)}`,
			less: x => `< ${this.interpolatableValue(x)}`,
			greater_or_equal: x => `>= ${this.interpolatableValue(x)}`,
			less_or_equal: x => `<= ${this.interpolatableValue(x)}`,
			contains: x => `like '%${x?.toString()}%'`,
			ends_with: x => `like '%${x?.toString()}'`,
			starts_with: x => `like '${x?.toString()}%'`,
			is_outlier_by: undefined,
			blank: undefined,
			"is-contained": undefined
		}
	}

	insert<T extends Obj>(tablename: string, data: T): string {
		const columns = keys(data).map(k => this.interpolatableColumnName(k)).join(", ")
		const values = keys(data).map(k => this.interpolatableValue(data[k])).join(", ")
		return `INSERT INTO ${this.interpolatableRowsetName(tablename)}(${columns}) VALUES (${values}) ($1)`
	}

	update<T extends Obj>(tablename: string, data: T): string {
		const assignments = keys(data).map(k => `${this.interpolatableColumnName(k)} = ${this.interpolatableValue(data[k])}`).join(", ")
		return `UPDATE ${this.interpolatableRowsetName(tablename)} SET ${assignments}`
	}

	delete(tablename: string, id: any): string {
		return `DELETE FROM ${this.interpolatableRowsetName(tablename)} WHERE id=${this.interpolatableValue(id)}`
	}

	select(rowsetName: string, filter?: Filter | FilterGroup): string {
		return `SELECT * FROM ${this.interpolatableRowsetName(rowsetName)}() WHERE ${this.getWhereClause(filter)}`
	}

	getWhereClause(filter?: Filter | FilterGroup): string {
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
						return `${f.negated ? "NOT " : ""}${this.interpolatableColumnName(f.fieldName)} ${exprTemplate(f.value)}`
					}
					else {
						return `(${this.getWhereClause(f)})`
					}
				})
				.join(` ${(filterGroup.combinator as string || "and")} `)
	}
}


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
