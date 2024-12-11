import colors from "colors"
import pgPromise, { } from "pg-promise"
import {
	type Rec, type RecordFilter, type StdError, type Result,
	ok, err, errorResultCtors, isFilterPair, isFilterSingle, snakeCase,
	stringify,
	type ValueOf,
	keysToCamelCase,
	assert,
	hasValue,
} from "@agyemanjp/standard"

import type { IOProvider, IOProviderFactory } from "./common"
import type { RecWithId } from "./common"


export const ioFactoryForPostgres: IOProviderFactory<{ dbUrl: string, getRowsetName: (entityName: string) => string }> = (cfg) => {
	// console.warn(`Db URL passed to ioFactoryForPostgres: ${cfg.dbUrl}`)
	const { dbUrl, getRowsetName } = cfg
	try {
		const db = pgPromise({})({
			connectionString: dbUrl,
			ssl: { rejectUnauthorized: false },
			connectionTimeoutMillis: 10000,
			query_timeout: 10000,
			max: 75
		})
		db.$config.options.query = e => {
			console.log(colors.cyan(`Executing on Postgres Db: ${JSON.stringify(e.query)}`))
		}
		db.$config.pgp.pg.types.setTypeParser(20, Number.parseInt)

		return ok({
			forSetofRows: <T extends RecWithId>(entityName: string) => {

				return ({
					find: async (id) => {
						const fxName = getRowsetProviderName("get")
						try {
							const ret = await db.one<Rec<T>>({
								text: `SELECT * from ${fxName}() where ${fxName}->>'id' = $1`,
								values: [id]
							})
							return ok(asIoRecord(ret, fxName) as T)
						}
						catch (e) {
							return err(makeStdError(e))
						}
					},

					get: async (filter) => {
						const fxName = getRowsetProviderName("get")
						try {
							const paramsProvider = {
								array: [] as unknown[],
								add(val: unknown) {
									this.array.push(val)
									return this.array.length
								}
							}
							const whereClause = getWhereClause({ filter, paramsProvider, rowsetProviderName: fxName })
							// console.warn(`where clause: ${whereClause},\nparams array: ${paramsProvider.array}`)

							const ret = await db.manyOrNone({
								text: `SELECT * from ${fxName}() WHERE ${whereClause}`,
								values: paramsProvider.array
							})
							return ok(ret.map(rec => asIoRecord(rec, fxName) as T))
						}
						catch (e) {
							return err(makeStdError(e))
						}
					},

					insert: async (objects) => {
						try {
							const ret = await db.manyOrNone<T>({
								text: `SELECT * from ${getRowsetProviderName("insert")}($1) as result`,
								values: [JSON.stringify(objects)]
							})
							return ok(ret)
						}
						catch (e) {
							return err(makeStdError(e))
						}
					},

					update: async (objects) => {
						try {
							const ret = await db.manyOrNone<T>({
								text: `SELECT * from ${getRowsetProviderName("update")}($1) as result`,
								values: [JSON.stringify(objects)]
							})

							return ok(ret)
						}
						catch (e) {
							return err(makeStdError(e))
						}
					},

					remove: async (ids) => {
						try {
							const ret = await db.manyOrNone<string>({
								text: `SELECT * from ${getRowsetProviderName("delete")}($1) as result`,
								values: [JSON.stringify(ids)]
							})

							return ok(ret)
						}
						catch (e) {
							return err(makeStdError(e))
						}
					},

					identifier: `pg-io-for-${entityName}`
				} satisfies IOProvider<T>)

				/** Get name of rowset provider (table, table-valued function, etc ) */
				function getRowsetProviderName(operation: "get" | "insert" | "update" | "delete") {
					return `${operation}_${getRowsetName(entityName)}`
				}
			},

			/** Tests connection and returns Postgres server version, if successful; or else rejects with connection error */
			testConnection: async (): Promise<Result<string>> => {
				try {
					const c = await db.connect() // try to connect
					c.done() // success, release connection
					return ok(c.client.serverVersion) // return server version
				}
				catch (e) {
					return errorResultCtors.unspecified(String(e))
				}
			},
			// driver: db
		})

	}
	catch (e) {
		console.error(`Error creating io postgres factory: ${e}`)
		return err(makeStdError(e))
	}
}

/** Convert results from wrapped JSON form to IO output form */
function asIoRecord(dbRecordMap: Rec<Rec>, rowsetProviderName: string) {
	// extract actual record from json wrapper and convert keys to came case
	const dbRecord = dbRecordMap[rowsetProviderName]
	assert(dbRecord)
	return keysToCamelCase(dbRecord)
}

/** Turns a filter object into a postgres compatible WHERE clause */
function getWhereClause<T extends Rec>(args:
	{
		filter?: RecordFilter<T> | null,
		rowsetProviderName: string,
		paramsProvider?: { array: unknown[], add: (val: unknown) => number }
	}): string {
	const { paramsProvider, filter, rowsetProviderName } = args
	const defaultPredicate = "1 = 1"
	const _paramsProvider = paramsProvider ?? {
		array: [] as unknown[],
		add(val: unknown) {
			this.array.push(val)
			return this.array.length
		}
	}

	switch (true) {
		case hasValue(filter) && isFilterPair(filter): {
			const combinator = filter[1]
			const left = getWhereClause({ filter: filter[0], rowsetProviderName, paramsProvider: _paramsProvider })
			const right = getWhereClause({ filter: filter[2], rowsetProviderName, paramsProvider: _paramsProvider })
			return `(${left} ${combinator} ${right})`
		}
		case hasValue(filter) && isFilterSingle(filter): {
			const fieldDescriptor = `${rowsetProviderName}->>'${snakeCase(String(filter[0]))}'`
			//snakeCase(String(filter[0])).toLocaleLowerCase()

			if (filter.length === 2) {
				switch (filter[1] /* operator */) {
					case "is-null": { return `${fieldDescriptor} IS NULL` }
					case "is-not-null": { return `${fieldDescriptor} IS NOT NULL` }
				}
			}
			else {
				const key = filter[2]
				const indexOfKey = () => _paramsProvider.add(key)
				switch (filter[1] /* operator */) {
					case "equals": { return `${fieldDescriptor} = \$${indexOfKey()}` }
					case "does-not-equal": { return `${fieldDescriptor} <> \$${indexOfKey()}` }
					case "greater-than": { return `${fieldDescriptor} > \$${indexOfKey()}` }
					case "greater-than-or-equals": { return `${fieldDescriptor} >= \$${indexOfKey()}` }
					case "less-than": { return `${fieldDescriptor} < \$${indexOfKey()}` }
					case "less-than-or-equals": { return `${fieldDescriptor} <= \$${indexOfKey()}` }
					case "starts-with": { return `${fieldDescriptor} LIKE \$${`${_paramsProvider.add(key)}%`}` }
					case "doesn't-start-with": { return `${fieldDescriptor} NOT LIKE \$${`${_paramsProvider.add(key)}%`}` }
					case "ends-with": { return `${fieldDescriptor} LIKE \$${`%${_paramsProvider.add(key)}`}` }
					case "doesn't-end-with": { return `${fieldDescriptor} NOT LIKE \$${`%${_paramsProvider.add(key)}`}` }
					case "contains": { return `${fieldDescriptor} NOT LIKE \$${`%${_paramsProvider.add(key)}%`}` }
					case "doesn't-contain": { return `${fieldDescriptor} NOT LIKE \$${`%${_paramsProvider.add(key)}%`}` }
					default: return defaultPredicate
				}
				/*switch (filter[1]) {
					case "is-null": { return `${fieldName} IS NULL` }
					case "is-not-null": { return `${fieldName} IS NOT NULL` }
					case "equals": { return `${fieldName} = ${sqlValue(filter[2])}` }
					case "does-not-equal": { return `${fieldName} <> ${sqlValue(filter[2])}` }
					case "greater-than": { return `${fieldName} > ${sqlValue(filter[2])}` }
					case "greater-than-or-equals": { return `${fieldName} >= ${sqlValue(filter[2])}` }
					case "less-than": { return `${fieldName} < ${sqlValue(filter[2])}` }
					case "less-than-or-equals": { return `${fieldName} <= ${sqlValue(filter[2])}` }
					case "starts-with": { return `${fieldName} LIKE ${sqlValue(`%${filter[2]}`)}` }
					case "doesn't-start-with": { return `${fieldName} NOT LIKE ${sqlValue(`%${filter[2]}`)}` }
					case "ends-with": { return `${fieldName} LIKE ${sqlValue(`${filter[2]}%`)}` }
					case "doesn't-end-with": { return `${fieldName} NOT LIKE ${sqlValue(`${filter[2]}%`)}` }
					case "contains": { return `${fieldName} like ${sqlValue(`%${filter[2]}%`)}` }
					case "doesn't-contain": { return `${fieldName} like ${sqlValue(`%${filter[2]}%`)}` }
				}*/
			}
		}
		default: {
			return defaultPredicate
		}
	}
}

export function makeStdError(err: unknown): StdError {
	const ret: StdError = (isPgError(err)
		? {
			errCode: Object.keys(pgErrorCodes).includes(err.code)
				? pgToStdErrorCodes[pgErrorCodes[err.code as keyof typeof pgErrorCodes]]
				: "general",
			description: (err.message ?? pgErrorCodes[err.code as keyof typeof pgErrorCodes]) //err.hint ?? err.detail
		} satisfies StdError

		: err instanceof Error
			? {
				errCode: String(err).indexOf("ECONNREFUSED") >= 0 ? "no-connection" : "general",
				description: err.message
			}
			: {
				errCode: "general",
				description: stringify(err)
			}
	)

	console.log(`Returning std error: ${stringify(ret)}`)
	return ret

	function isPgError(err: unknown): err is { code: string, hint?: string, severity: string, message?: string } {
		return (err !== null && typeof err === "object" && "code" in err && typeof err.code === "string")
			&& ("severity" in err && typeof err.severity === "string")
			&& ("hint" in err)
		// && Object.keys(pgErrorCodes).includes(err.code)
	}
}
const pgErrorCodes = {
	"28000": "invalid_authorization_specification",
	"23505": "unique_violation",
	"23502": "not_null_violation",
	"P0002": "no_data_found",
	"P0003": "too_many_rows",

	"08000": "connection_exception",
	"08003": "connection_does_not_exist",
	"08006": "connection_failure",

	"44000": "with_check_option_violation",

	"XX000": "internal_error",
	"XX001": "data_corrupted",
	"XX002": "index_corrupted",

	"58000": "system_error",
	"58030": "io_error",
	"23000": "integrity_constraint_violation",

	"53000": "insufficient_resources",
	"53100": "disk_full",
	"53200": "out_of_memory",
	"53300": "too_many_connections",
	"53400": "configuration_limit_exceeded",

	"54000": "program_limit_exceeded",
	"54001": "statement_too_complex",
	"54011": "too_many_columns",
	"54023": "too_many_arguments",

	"0A000": "feature_not_supported"
} as const
const pgToStdErrorCodes: Rec<StdError["errCode"], ValueOf<typeof pgErrorCodes>> = {
	invalid_authorization_specification: "access-denied",
	internal_error: "internal",
	integrity_constraint_violation: "conflict",
	with_check_option_violation: "conflict",
	unique_violation: "conflict",
	not_null_violation: "bad-input",
	insufficient_resources: "resources-exhausted",
	program_limit_exceeded: "resources-exhausted",
	out_of_memory: "resources-exhausted",
	too_many_connections: "resources-exhausted",
	statement_too_complex: "resources-exhausted",
	too_many_arguments: "bad-input",
	connection_exception: "no-connection",
	connection_does_not_exist: "no-connection",
	connection_failure: "no-connection",
	data_corrupted: "internal",
	io_error: "internal",
	disk_full: "resources-exhausted",
	configuration_limit_exceeded: "resources-exhausted",
	index_corrupted: "internal",
	feature_not_supported: "not-implemented",
	no_data_found: "not-found",
	too_many_rows: "bad-input",
	too_many_columns: "bad-input",
	system_error: "internal"
}
