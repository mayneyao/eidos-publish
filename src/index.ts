import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
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

const app = new Hono<{ Bindings: Bindings }>();
app.use('/*', cors());

// register subdomain
app.post('/api/register', async (c) => {
	const { subdomain } = await c.req.json<{ subdomain: string }>();
	const { results } = await c.env.DB.prepare(`select * from subdomain where subdomain = ?`).bind(subdomain).all();

	// generate a random token for the subdomain
	const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

	if (results.length === 0) {
		await c.env.DB.prepare(`insert into subdomain (subdomain,token) values (?,?)`).bind(subdomain, token).run();
		return c.json({
			success: true,
			token: token,
			message: 'Subdomain registered, keep your token safe, it will be used to authenticate your requests',
		});
	} else {
		return c.json({ success: false, message: 'Subdomain already registered' });
	}
});

// get file
app.get('/:subdomain/files/:path{.*}', async (c) => {
	const path = c.req.param('path');
	const object = await c.env.EIDOS_PUBLISH_BUCKET.get(path);
	if (object === null) {
		return c.text('Not Found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('uploaded', object.uploaded.toISOString());
	return new Response(object.body, {
		headers,
	});
});

// get doc
app.get('/:subdomain/:nodeId', async (c) => {
	const subdomain = c.req.param('subdomain');
	const nodeId = c.req.param('nodeId');

	/**
	 * there are two mode
	 * 1. nodeId is short uuid
	 * 2. nodeId is a slug
	 */
	const isUUID = nodeId.length === 32;
	let content: string | null = '';
	if (isUUID) {
		const { results: results2 } = await c.env.DB.prepare(`select * from node where id = ? and subdomain = ?`).bind(nodeId, subdomain).all();
		if (results2.length === 0) {
			return c.json({ success: false, message: 'Node not found' });
		}
		const key = `${subdomain}/${nodeId}`;
		content = await c.env.EIDOS_PUBLISH.get(key);
	} else {
		const { results: results2 } = await c.env.DB.prepare(`select * from node where slug = ? and subdomain = ?`)
			.bind(nodeId, subdomain)
			.all();
		if (results2.length === 0) {
			return c.json({ success: false, message: 'Node not found' });
		}
		const key = `${subdomain}/${results2[0].id}`;
		content = await c.env.EIDOS_PUBLISH.get(key);
	}

	return c.text(content || '', {
		headers: {
			'content-type': 'text/html;charset=UTF-8',
		},
	});
});

const validateRequest = async (subdomain: string, c: Context<{ Bindings: Bindings }>) => {
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

// put file
app.put('/:subdomain/files/:path{.*}', async (c) => {
	const subdomain = c.req.param('subdomain');
	const path = c.req.param('path');
	const valid = await validateRequest(subdomain, c);
	if (!valid) {
		return c.json({ success: false, message: 'authentication failed' });
	}
	await c.env.EIDOS_PUBLISH_BUCKET.put(path, c.req.raw.body);
	return c.json({ success: true });
});
// ykyn3mndvhqe7sp8grb0d
// publish doc
app.post('/:subdomain/:nodeId', async (c) => {
	const subdomain = c.req.param('subdomain');
	const nodeId = c.req.param('nodeId');
	const valid = await validateRequest(subdomain, c);
	if (!valid) {
		return c.json({ success: false, message: 'authentication failed' });
	}
	const { content, slug = '' } = await c.req.json<{ content: string; slug?: string }>();
	const key = `${subdomain}/${nodeId}`;
	await c.env.EIDOS_PUBLISH.put(key, content);
	const { results } = await c.env.DB.prepare(`select * from node where id = ? and subdomain = ?`).bind(nodeId, subdomain).all();
	if (results.length === 0) {
		await c.env.DB.prepare(`insert into node (id,subdomain,slug) values (?,?,?)`).bind(nodeId, subdomain, slug).run();
	}
	return c.json({ success: true });
});

// unpublish doc
app.delete('/:subdomain/:nodeId', async (c) => {
	const subdomain = c.req.param('subdomain');
	const nodeId = c.req.param('nodeId');
	const valid = await validateRequest(subdomain, c);
	if (!valid) {
		return c.json({ success: false, message: 'authentication failed' });
	}
	const key = `${subdomain}/${nodeId}`;
	await c.env.EIDOS_PUBLISH.delete(key);
	await c.env.DB.prepare(`delete from node where id = ? and subdomain = ?`).bind(nodeId, subdomain).run();
	return c.json({ success: true });
});

export default app;
