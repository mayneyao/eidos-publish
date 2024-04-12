import { EContext, validateRequest } from '../helper';

// there are some node types
// 1. html default, nodeId is a short uuid
// 2. md markdown, nodeId like md-xxxxxx
// 3. json json, nodeId like json-xxxxxx
enum NodeType {
	HTML = 'html',
	MD = 'md',
	JSON = 'json',
}

const getNodeType = (nodeId: string) => {
	if (nodeId.startsWith('md-')) {
		return NodeType.MD;
	}
	if (nodeId.startsWith('json-')) {
		return NodeType.JSON;
	}
	return NodeType.HTML;
};

export async function publishNode(c: EContext) {
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
	} else {
		await c.env.DB.prepare(`update node set slug = ? where id = ? and subdomain = ?`).bind(slug, nodeId, subdomain).run();
	}
	return c.json({ success: true });
}

export async function unpublishNode(c: EContext) {
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
}

export async function getNode(c: EContext) {
	const subdomain = c.req.param('subdomain');
	const nodeId = c.req.param('nodeId');

	const nodeType = getNodeType(nodeId);
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

	switch (nodeType) {
		case NodeType.MD:
			return c.text(content || '', {
				headers: {
					'content-type': 'text/markdown;charset=UTF-8',
				},
			});
		case NodeType.JSON:
			return c.json(JSON.parse(content || '{}'));
		default:
			return c.text(content || '', {
				headers: {
					'content-type': 'text/html;charset=UTF-8',
				},
			});
	}
}
