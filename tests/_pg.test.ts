import { it, describe } from "bun:test"
import assert from "assert"

import { makeStdError } from "../source/io/_pg"
import type { StdError } from "@agyemanjp/standard"

describe("makeStdError", async () => {
	it("should identify errors with known codes", async () => {
		assert.deepStrictEqual(makeStdError({
			"length": 214,
			"name": "error",
			"severity": "ERROR",
			"code": "42883",
			"detail": "<undefined>",
			"hint": "No function matches the given name and argument types. You might need to add explicit type casts.",
			"position": "15",
			"internalPosition": "<undefined>",
			"internalQuery": "<undefined>",
			"where": "<undefined>",
			"schema": "<undefined>",
			"table": "<undefined>",
			"originalLine": 154,
			"originalColumn": 12,
			"dataType": "<undefined>",
			"constraint": "<undefined>",
			"file": "parse_func.c",
			"routine": "ParseFuncOrColumn",
			"query": {
				"text": "SELECT * from insert_users($1) as result",
				"values": [
					"[{\"id\":\"g6t7mk8vfb8kpmv3n3e2wlsg\",\"emailAddress\":\"a@b.com\",\"pwdSalt\":\"$2a$10$zm03SPP.V/mx7hq/R.27ke\",\"pwdHash\":\"$2a$10$zm03SPP.V/mx7hq/R.27keqeD1suSgaLwWgJ5ihqxxF/9Ti7aMs2O\"}]"
				],
				"callback": "[Function ]"
			},
			"params": "<undefined>"
		}).errCode, "general")
	})
})
