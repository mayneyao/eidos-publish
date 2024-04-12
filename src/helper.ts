import { Context } from 'hono';

export type Bindings = {
	AUTH_KEY_SECRET: string;
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	EIDOS_PUBLISH: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	EIDOS_PUBLISH_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
	DB: D1Database;
};

export type EContext = Context<{
	Bindings: Bindings;
}>;

export const validateRequest = async (subdomain: string, c: Context<{ Bindings: Bindings }>) => {
	const token = c.req.header('x-auth-token');
	if (!token) {
		return false;
	}
	// only subdomain and token match, the request is valid
	const { results } = await c.env.DB.prepare(`select * from subdomain where subdomain = ? and token = ?`).bind(subdomain, token).all();
	if (results.length === 0) {
		return false;
	}
	return true;
};
