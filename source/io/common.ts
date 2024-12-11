import type { FilterSingle, RecordFilter, Result } from "@agyemanjp/standard"

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type IOProviderFactory<Cfg = any> = (cfg: Cfg) => Result<{
	forSetofRows: <T extends RecWithId>(rowsetName: string) => IOProvider<T>,
	// testConnection?: () => Promise<Result<string>>,
	// driver: Drv
}>

export type IOProvider<T extends RecWithId = RecWithId> = {
	get: (filter?: FilterSingle<T> | RecordFilter<T> | null) => Promise<Result<T[]>>
	find: (id: string) => Promise<Result<T>>
	insert: (objects: T[]) => Promise<Result<T[]>>
	update: (objects: T[]) => Promise<Result<T[]>>
	remove: (ids: string[]) => Promise<Result<string[]>>
	// save: (objects: T[]) => Promise<Result<T[]>>

	/** Unique identifier (usually based on config) */
	identifier: string
}

export type RecWithId = { id: string }

export type DataMethod = "find" | "get" | "insert" | "update" | "remove" // | "save"
