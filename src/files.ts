import { Env } from '.';
// src/worker.ts
const hasValidHeader = (request: Request, env: Env) => {
	return request.headers.get('X-Custom-Auth-Key') === env.AUTH_KEY_SECRET;
};

function authorizeRequest(request: Request, env: Env, key: string) {
	switch (request.method) {
		case 'OPTIONS':
			return true;
		case 'PUT':
		case 'DELETE':
			return hasValidHeader(request, env);
		case 'GET':
			return true;
		default:
			return false;
	}
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,HEAD,PUT,POST,OPTIONS',
	'Access-Control-Max-Age': '86400',
};
function setCORSResponse(response: Response) {
	const newResponse = new Response(response.body, response);
	newResponse.headers.set('Access-Control-Allow-Origin', '*');
	newResponse.headers.append('Vary', 'Origin');
	newResponse.headers.set('Access-Control-Expose-Headers', '*');
	return newResponse;
}
async function handleOptions(request: Request) {
	if (
		request.headers.get('Origin') !== null &&
		request.headers.get('Access-Control-Request-Method') !== null &&
		request.headers.get('Access-Control-Request-Headers') !== null
	) {
		return new Response(null, {
			headers: {
				...corsHeaders,
				'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers')!,
			},
		});
	} else {
		return new Response(null, {
			headers: {
				Allow: 'GET, HEAD, PUT, POST, OPTIONS',
			},
		});
	}
}

export const handleFile = async (request: Request, env: Env, ctx: ExecutionContext) => {
	const url = new URL(request.url);
	// /files/xxx
	const key = url.pathname.replace('/files', '').slice(1);
	if (!authorizeRequest(request, env, key)) {
		return new Response('Forbidden', { status: 403 });
	}
	switch (request.method) {
		case 'OPTIONS':
			return handleOptions(request);
		case 'PUT':
			await env.EIDOS_PUBLISH_BUCKET.put(key, request.body);
			const res = new Response(`Put ${key} successfully!`);
			return setCORSResponse(res);
		case 'GET':
			const object = await env.EIDOS_PUBLISH_BUCKET.get(key);
			if (object === null) {
				return setCORSResponse(new Response('Object Not Found', { status: 404 }));
			}
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			headers.set('uploaded', object.uploaded.toISOString());
			const res1 = new Response(object.body, {
				headers,
			});
			return setCORSResponse(res1);
		case 'DELETE':
			await env.EIDOS_PUBLISH_BUCKET.delete(key);
			return setCORSResponse(new Response('Deleted!'));
		default:
			return new Response('Method Not Allowed', {
				status: 405,
				headers: {
					Allow: 'PUT, GET, DELETE',
				},
			});
	}
};
