/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	EIDOS_PUBLISH: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

const getDoc = async (id: string, env: Env) => {
	const content = env.EIDOS_PUBLISH.get(id);
	return content;
};

const putDoc = async (id: string, content: string, env: Env) => {
	return env.EIDOS_PUBLISH.put(id, content);
};

const allowedDomains = ['eidos.space'];
const handleCors = (request: Request) => {
	const origin = request.headers.get('Origin');
	if (origin && allowedDomains.includes(new URL(origin).hostname)) {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
			},
		});
	}
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;
		const id = path.substring(1);
		const origin = request.headers.get('Origin');

		if (method === 'OPTIONS') {
			return handleCors(request);
		}
		if (!id) {
			return new Response('Hello World!');
		}
		if (method === 'GET') {
			const content = await getDoc(id, env);
			if (!content) {
				return new Response('Not Found', {
					status: 404,
					statusText: 'Not Found',
					headers: { 'Content-Type': 'text/plain' },
				});
			}
			return new Response(content, {
				headers: {
					'content-type': 'text/html;charset=UTF-8',
				},
			});
		} else if (method === 'PUT') {
			const content = await request.text();
			await putDoc(id, content, env);
			return new Response(JSON.stringify({ id }), {
				status: 201,
				statusText: 'Created',
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': origin!,
				},
			});
		}
		return new Response('Hello World!');
	},
};
