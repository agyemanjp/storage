/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable indent */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-unused-expression */

import * as assert from "assert"
import { Schema } from "../dist/types"
import { generateRepositoryGroup } from "../dist/core"

describe('generateRepositoryFactory', () => {
	it("should work", () => {

		const schema = {
			"analyses": {
				toStorage: {
					name: "string",
					goal: { type: "string", isNullable: true },
					variables: {
						type: "array",
						arrayType: {
							name: "string",
							role: "string",
							measureLevel: "string"
						},
						isNullable: true
					},
					filters: {
						type: "array",
						arrayType: {
							field: "string",
							operation: "string",
							value: "string",
							negated: "boolean"
						},
						isNullable: true
					},
					settings: "string"
				},
				fromStorage: {

				}
			},
			"tables": {
				toStorage: {
					name: "string",
					projectId: "string",
					parsedStorageUrl: "string",
					originalSource: "string",
					numRows: "number",
					numColumns: "number",
					whenCreated: "number"
				},
				fromStorage: {
				}
			},

			"project": {
				toStorage: {
					id: "string",
					name: "string",
					description: "string",
					userId: "string",
					isPublic: "boolean",
					whenLastAccessed: "number",
					whenCreated: "number"
				},
				fromStorage: {
					categories: {
						type: "array",
						arrayType: "string"
					},
					userEmailAddress: "string",
				}
			}
		} as const
		const _schema: Schema = schema

		const repoFactory = generateRepositoryGroup({
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			ioProvider: (args: { baseUrl: string }) => ({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				findAsync: () => { return Promise.resolve({}) as any },
				getAsync: () => { return Promise.resolve([]) },
				saveAsync: () => { return Promise.resolve([]) },
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				deleteAsync: () => { return Promise.resolve() as any },
				extensions: {}
			}),
			schema: schema
		})

		const repoGrp = repoFactory({ baseUrl: "" })
		// repoGrp.analyses.getAsync({ parentId: "" }).then(x => x[0].variables[0].role)

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		//const fn = async () => {
		// const table = await repo.tables.findAsync("")
		// const analysis = await repo.analyses.findAsync("")
		// eslint-disable-next-line fp/no-mutation
		// const a = analysis.variables[0].
		// const n = table.numColumns
		//}
		// const repo = repoFactory().
		// const expected = [3, 4, 5, 6]
		// assert.deepEqual(expected, actual)
	})

})
