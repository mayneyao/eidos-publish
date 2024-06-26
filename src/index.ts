import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './helper';
import { getNode, publishNode, unpublishNode } from './route/node';
import { checkFile, getFile, uploadFile } from './route/files';
import { register } from './route/register';

const app = new Hono<{ Bindings: Bindings }>();
app.use('/*', cors());

// register subdomain
app.post('/api/register', register);

// file
app.get('/:subdomain/files/:path{.*}', getFile).put(uploadFile);

// check file is exist
app.get('/:subdomain/check-file/:path{.*}', checkFile);

// node
app.get('/:subdomain/:nodeId', getNode).post(publishNode).delete(unpublishNode);

export default app;
