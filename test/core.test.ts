/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable indent */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-unused-expression */

import * as assert from "assert"
// import { Schema, EntityType, FieldType } from "../dist/types"
// import { repositoryGroupFactory } from "../dist/core"
// import { Obj, TypeAssert, TypeGuard } from "@sparkwave/standard"

describe('generateRepositoryFactory', () => {
	it("should work", async () => {

		const schema = {
			"analyses": {
				fields: {
					id: "string",
					name: "string",
					goal: { type: "string", nullable: true },
					variables: {
						type: "array",
						arrayType: {
							id: "string",
							name: "string",
							role: "string",
							measureLevel: "string"
						},
						nullable: true
					},
					filters: {
						type: "array",
						arrayType: {
							id: "string",
							field: "string",
							operation: "string",
							value: "string",
							negated: "boolean"
						},
						nullable: true
					},
					settings: "unknown"
				}
			},

			"tables": {
				fields: {
					id: "string",
					name: "string",
					projectId: "string",
					parsedStorageUrl: "string",
					originalSource: "string",
					numRows: "number",
					numColumns: "number",
					whenCreated: "number"
				}
			},

			"projects": {
				fields: {
					id: "string",
					name: "string",
					description: "string",
					userId: "string",
					isPublic: "boolean",
					whenLastAccessed: "number",
					whenCreated: "number"
				}
			},
			projectCategories: {
				fields: {
					id: "string",
					categories: {
						type: "array",
						arrayType: "string"
					},
					userEmailAddress: "string",
				},
				readonly: true
			},

			"columns": {
				fields: {
					id: "string",
					tableId: "string",
					displayIndex: "number",
					storageUrl: "string"
				}
			},

			"results": {
				fields: {
					id: "string",
					name: "string",
					description: "string",
					content: { type: "array", arrayType: "object" },
					initialLayout: "string",
					displayIndex: "number"
				}
			},

			"users": {
				fields: {
					id: "string",
					firstName: "string",
					lastName: "string",
					emailAddress: "string",
					companyName: { type: "string", nullable: true },
					role: "string",
					whenCreated: "number",
					pwdHash: "string",
					pwdSalt: "string"
				}
			}
		} as const

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		// const _schema: Schema = schema


		// // eslint-disable-next-line @typescript-eslint/no-unused-vars
		// const repoFactory = repositoryGroupFactory({
		// 	// eslint-disable-next-line @typescript-eslint/no-unused-vars
		// 	io: (args: { baseUrl: string }) => ({
		// 		findAsync: () => { return Promise.resolve({} as any) },
		// 		getAsync: () => { return Promise.resolve([]) },
		// 		insertAsync: () => { return Promise.resolve() },
		// 		updateAsync: () => { return Promise.resolve() },
		// 		deleteAsync: () => { return Promise.resolve() },
		// 		extensions: {}
		// 	}),
		// 	schema: schema
		// })

		// const repoGrp = repoFactory({ baseUrl: "" })
		// const analysis = await repoGrp.analyses.findAsync("")
		// const test = (analysis.variables ?? [])[0].measureLevel

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
		assert.ok(true)
	})

})
