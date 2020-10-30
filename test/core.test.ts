/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable indent */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-unused-expression */

import * as assert from "assert"
import { Schema, EntityType, FieldType } from "../dist/types"
import { repositoryGroupFactory } from "../dist/core"
import { Obj } from "@sparkwave/standard"

describe('generateRepositoryFactory', () => {
	it("should work", async () => {

		const schema = {
			"analyses": {
				toStorage: {
					id: "string",
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
				fromStorage: {}
			},

			"tables": {
				toStorage: {
					id: "string",
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

			"projects": {
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
			},

			"columns": {
				fromStorage: {

				},
				toStorage: {
					id: "string",
					tableId: "string",
					displayIndex: "number",
					storageUrl: "string"
				}
			},

			"results": {
				fromStorage: {},
				toStorage: {
					name: "string",
					description: "string",
					content: { type: "array", arrayType: "object" },
					initialLayout: "string",
					displayIndex: "number"
				}
			},

			"users": {
				fromStorage: {},
				toStorage: {
					id: "string",
					firstName: "string",
					lastName: "string",
					emailAddress: "string",
					companyName: { type: "string", isNullable: true },
					role: "string",
					whenCreated: "number",
					pwdHash: "string",
					pwdSalt: "string"
				}
			}
		} as const
		const _schema: Schema = schema

		type tt = EntityType<typeof schema["analyses"]["toStorage"]>
		const repoFactory = repositoryGroupFactory({
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
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		// const test = (await repoGrp.analyses.findAsync("")).variables[0]


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
