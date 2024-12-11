import type { Stream } from "node:stream"
import { ReadableStream } from "node:stream/web"
import { S3, GetObjectCommand } from "@aws-sdk/client-s3"
import { err, hasValue, ok } from "@agyemanjp/standard"

import type { IOProviderFactory, IOProvider, RecWithId } from "./common"


/** S3-compatible IO provider factory */
export const ioFactoryForS3: IOProviderFactory<AWSConfig> = (cfg) => {
	try {
		const { region, bucketName, secretAccessKey, accessKeyId, endpoint } = cfg
		const client = new S3({ endpoint, credentials: { secretAccessKey, accessKeyId }, region })

		return ok({
			forSetofRows: <T extends RecWithId>(rowsetName: string): IOProvider<T> => ({
				find: async (id) => getObject(id).then(_ => JSON.parse(_)),

				get: async (filter) => {
					if (filter === undefined) {
						const strData = await retrieveAllObjectsAsync(rowsetName)
						const strDataHasValue = strData.filter(_ => hasValue(_))
						return strDataHasValue.length === strData.length
							? ok(strDataHasValue.map(_ => JSON.parse(_)))
							: err({ errCode: "general", details: {} })
					}
					else {
						return err({
							errCode: "not-implemented",
							details: { operation: "Filtering argument" }
						})
					}
				},

				insert: async (objects) => {
					try {
						await Promise.all(objects.map(_ => storeObject(`${rowsetName}/${_.id}`, JSON.stringify(_))))
						return ok(objects)
					}
					catch (error) {
						return err({ errCode: "general", details: {} })
					}
				},

				update: async (objects) => {
					try {
						await Promise.all(objects.map(_ => storeObject(`${rowsetName}/${_.id}`, JSON.stringify(_))))
						return ok(objects)
					}
					catch (error) {
						return err({ errCode: "general", details: {} })
					}
				},

				remove: async (ids) => {
					try {
						await Promise.all(ids.map(_ => removeObject(`${rowsetName}/${_}`)))
						return ok(ids)
					}
					catch (error) {
						return err({ errCode: "general", details: {} })
					}
				},

				identifier: `s3-io-for-${rowsetName}`
			})
		})

		/** Store an object in a bucket
		 * @param objName Name of object, e.g., 'index.html'. To put in a folder, use '/'. e.g., 'myApp/package.json'.
		 */
		async function storeObject(objectId: string, content: string) {
			return client.putObject({ Bucket: bucketName, Key: objectId, Body: content })
		}

		/** Get an object from a bucket */
		async function getObject(id: string) {
			const data = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: id }))

			if (data.Body === undefined) return ""
			else if (data.Body instanceof Blob) return data.Body.text()
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			else if (data.Body instanceof ReadableStream) return streamToString(data.Body as any as Stream)
			// return String(await (await data.Body.getReader().read()).value)
			else return streamToString(data.Body as Stream)
		}

		/** Get objects in a bucket with paths beginning with a prefix */
		async function retrieveAllObjectsAsync(prefix: string) {
			try {
				const data = await client.listObjectsV2({ Bucket: bucketName, Prefix: prefix })
				return Promise.all(data.Contents
					? data.Contents.map(_ => client
						.getObject({ Bucket: bucketName, Key: _.Key })
						.then(_ => _.Body?.transformToString()))
					: []
				)
			}
			catch (err) {
				console.error("Error retrieving objects:", err)
				throw err
			}
		}

		/** Remove object */
		async function removeObject(id: string) {
			return client.deleteObject(({ Bucket: bucketName, Key: id }))
		}

		/** Helper function to convert a Stream into a string. */
		function streamToString(stream: Stream) {
			return new Promise<string>((resolve, reject) => {
				const chunks: Uint8Array[] = []
				stream.on("data", chunk => chunks.push(chunk))
				stream.on("error", reject)
				stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
			})
		}
	}
	catch (e) {
		return err({
			errCode: "internal",
			details: { reason: String(e) }
		})
	}
}

export type AWSConfig = {
	endpoint: string
	bucketName: string,
	accessKeyId: string,
	secretAccessKey: string,
	region: string,
	cloudFrontURL?: string
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
