import * as base64 from "js-base64"
import { createStdError, request, type JsonArray } from "@agyemanjp/http"
import { err, hasValue, ok, stringify, trimRight } from "@agyemanjp/standard"

import type { IOProviderFactory, IOProvider, RecWithId } from "./common"


/** JSON API IO provider factory */
export const ioFactoryForAPI: IOProviderFactory<ApiConfig> = (cfg) => {
	const { secretAccessKey, clientId, basePath, getRoutePath } = cfg

	return ok({
		forSetofRows: <T extends RecWithId>(entityName: string): IOProvider<T> => {
			const routePath = getRoutePath(entityName)
			return ({
				find: async (id) => {
					const url = `${basePath}/${routePath}/${id}`
					// console.log(`Making find request on ${entityName} to API at: "${url}"...`)
					return request
						.get({
							url,
							query: {},
							headers: { secretAccessKey, clientId },
							accept: "Json"
						})
						.then(_ => _.isOk() ? ok(_.value as T) : err(createStdError(_.error)))
				},

				get: async (filter) => {
					const url = `${trimRight(basePath, "/")}/${routePath}/`
					// console.log(`Making get request on ${rowsetName} to API at: "${url}"`)
					return request
						.get({
							url,
							headers: { secretAccessKey, clientId },
							query: hasValue(filter) ? { filter: base64.encodeURL(JSON.stringify(filter)) } : undefined,
							accept: "Json"
						})
						.then(_ => {
							if (_.isOk()) {
								return ok(_.value as T[])
							}
							else {
								// console.error(`Error from API network GET request: ${stringify(_.error)}`)
								return err(createStdError(_.error))
							}
						})
				},

				insert: async (objects) => request
					.post({
						url: `${basePath}/${routePath}`,
						headers: { secretAccessKey, clientId },
						body: objects as JsonArray,
						accept: "Json"
					})
					.then(_ => _.isOk()
						? ok(_.value as T[])
						: err(createStdError(_.error))
					),

				update: async (objects) => request
					.put({
						url: `${basePath}/${routePath}`,
						headers: { secretAccessKey, clientId },
						body: objects as JsonArray,
						accept: "Json"
					})
					.then(_ => _.isOk() ? ok(_.value as T[]) : err(createStdError(_.error))),

				remove: async (ids) => request
					.get({
						url: `${basePath}/${routePath}`,
						headers: { secretAccessKey, clientId },
						query: { ids: ids.join(",") },
						accept: "Json"
					})
					.then(_ => _.isOk() ? ok(_.value as string[]) : err(createStdError(_.error))),

				identifier: `api-io-for-${entityName}`
			})
		}
	})
}

export type ApiConfig = {
	basePath: string
	getRoutePath: (entityName: string) => string
	// routePathCasing: "snake" | "dash" | "camel"
	secretAccessKey: string,
	clientId: string,
}

/** Provides methods to store and retrieve data on S3, from the Node.js server. */
/*export class RawStorageS3Node extends RawStorageS3 {
	readonly bucketName: string
	private static _instance: RawStorageS3Node | undefined

	public static get Instance(): RawStorageS3Node {
		const env = getEnv()
		return this._instance ?? (this._instance = new this({
			secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
			bucketName: env.S3_BUCKET_FOR_CORE_DATA,
			region: env.AWS_DEFAULT_REGION,
			accessKeyId: env.AWS_ACCESS_KEY_ID,
			cloudFrontURL: env.S3_CLOUDFRONT_URL
		}))
	}
	private constructor(s3Config: AWSConfig) {
		super({ cloudfrontUrl: s3Config.cloudFrontURL })
		if (s3Config.bucketName !== undefined) {
			this.bucketName = s3Config.bucketName
		}
		else {
			throw new Error("bucketName on raw-io called from server cannot be empty")
		}
		config.update({
			accessKeyId: s3Config.accessKeyId,
			secretAccessKey: s3Config.secretAccessKey,
			region: s3Config.region
		})
	}
	public async generatePresignedUrlAsync(): Promise<{ cloudFrontUrl: string, preSignedUrl: string }> {
		console.log(`Begin new generatePresignedUrlAsync operation at ${new Date().toISOString()}`)
		const ref = this.generateS3ObjectRef()

		const presignedUrl = await new S3().getSignedUrl("putObject", { Bucket: this.bucketName, Key: ref, Expires: 600, ContentType: "text/plain" }) // Valid for 10 minutes
		return { cloudFrontUrl: `${getEnv().S3_CLOUDFRONT_URL}/${ref}`, preSignedUrl: presignedUrl }
	}
	public async deleteAsync(objectId: string): Promise<void> {
		// The current objectId is embedded with CLOUDFRONT_URL, so extract just the deletedId
		const deletedId = this.getObjectId(objectId)
		new S3().deleteObject({ Bucket: this.bucketName, Key: deletedId }, err => {
			console.error(stringifyError(err))
		})
	}
	public async storeAsync(obj: Obj | string): Promise<string> {
		console.log(`Begin new storeAsync operation at ${new Date().toISOString()}`)
		const textData = this.stringifyData(obj)
		const ref = await this.generateS3ObjectRef()

		await new S3().putObject({ Bucket: this.bucketName, Key: ref, Body: textData }, err => {
			throw new Error(err.message)
		}).promise()

		return ref
	}
	public generateS3ObjectRef = () => {
		const id = shortid.generate()

		const specificBucket = /(?<=hypothesize-).*\/.exec(process.env.HEROKU_APP_NAME ?? "")

		const ref = `${specificBucket !== null
			? `${specificBucket[0]}/`
			: process.env.HEROKU_APP_NAME === "hypothesize"
				? ""
				: "dev/"}${id}`
		return ref
	}
}*/
