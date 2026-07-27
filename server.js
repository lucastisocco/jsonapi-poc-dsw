const express = require('express');
const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

// Validar Content-Type en requests con body (POST, PATCH)
// La spec dice: si el cliente envía body, DEBE usar application/vnd.api+json
app.use((req, res, next) => {
  if (['POST', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/vnd.api+json')) {
      return res.status(415).set('Content-Type', 'application/vnd.api+json').json({
        errors: [{
          status: '415',
          title: 'Unsupported Media Type',
          detail: 'El Content-Type debe ser application/vnd.api+json'
        }]
      });
    }
  }
  next();
});

// Parsear body como JSON
app.use(express.json({ type: 'application/vnd.api+json' }));

// ─── Datos en memoria ──────────────────────────────────────────────────────────

const users = [
  { id: '1', name: 'Juan Pérez',    email: 'juan@example.com' },
  { id: '2', name: 'María García',  email: 'maria@example.com' },
];

const articles = [
  { id: '1', title: 'Introducción a JSON:API', content: 'JSON:API es una especificación...', authorId: '1' },
  { id: '2', title: 'Ventajas de JSON:API',    content: 'Entre las ventajas encontramos...', authorId: '1' },
  { id: '3', title: 'REST vs JSON:API',        content: 'Una comparación detallada...', authorId: '2' },
];

const comments = [
  { id: '1', body: 'Muy buen artículo!',  articleId: '1', authorId: '2' },
  { id: '2', body: 'Excelente explicación', articleId: '1', authorId: '2' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const JSONAPI_CT = 'application/vnd.api+json';

// Serializa un artículo al formato json:api, respetando sparse fieldsets
// ?fields[articles]=title,content  → solo devuelve esos atributos
function serializeArticle(article, allowedFields = null) {
  const allAttributes = {
    title:   article.title,
    content: article.content,
  };

  const attributes = allowedFields
    ? Object.fromEntries(Object.entries(allAttributes).filter(([k]) => allowedFields.includes(k)))
    : allAttributes;

  return {
    type: 'articles',
    id:   article.id,
    attributes,
    relationships: {
      author: {
        links: { related: `/articles/${article.id}/author` },
        data:  { type: 'users', id: article.authorId },
      },
      comments: {
        links: { related: `/articles/${article.id}/comments` },
        data:  comments.filter(c => c.articleId === article.id)
                       .map(c => ({ type: 'comments', id: c.id })),
      },
    },
    links: { self: `/articles/${article.id}` },
  };
}

function serializeUser(user) {
  return {
    type: 'users',
    id:   user.id,
    attributes: { name: user.name, email: user.email },
    links: { self: `/users/${user.id}` },
  };
}

function serializeComment(comment) {
  return {
    type: 'comments',
    id:   comment.id,
    attributes: { body: comment.body },
    relationships: {
      author:  { data: { type: 'users',    id: comment.authorId  } },
      article: { data: { type: 'articles', id: comment.articleId } },
    },
  };
}

// Resuelve ?include=author,comments → agrega recursos en "included"
function resolveIncluded(includeParam, articleList) {
  if (!includeParam) return undefined;

  const includes = includeParam.split(',').map(s => s.trim());
  const includedMap = new Map(); // evita duplicados

  for (const article of articleList) {
    if (includes.includes('author')) {
      const user = users.find(u => u.id === article.authorId);
      if (user) includedMap.set(`users:${user.id}`, serializeUser(user));
    }
    if (includes.includes('comments')) {
      const articleComments = comments.filter(c => c.articleId === article.id);
      for (const c of articleComments) {
        includedMap.set(`comments:${c.id}`, serializeComment(c));
      }
    }
  }

  return [...includedMap.values()];
}

// Genera los links de paginación
function paginationLinks(base, total, pageNumber, pageSize) {
  const lastPage = Math.ceil(total / pageSize);
  return {
    self:  `${base}?page[number]=${pageNumber}&page[size]=${pageSize}`,
    first: `${base}?page[number]=1&page[size]=${pageSize}`,
    last:  `${base}?page[number]=${lastPage}&page[size]=${pageSize}`,
    prev:  pageNumber > 1        ? `${base}?page[number]=${pageNumber - 1}&page[size]=${pageSize}` : null,
    next:  pageNumber < lastPage ? `${base}?page[number]=${pageNumber + 1}&page[size]=${pageSize}` : null,
  };
}

// ─── Rutas: Articles ───────────────────────────────────────────────────────────

// GET /articles
// Soporta: ?include=author,comments  |  ?fields[articles]=title  |  ?page[number]=1&page[size]=2
app.get('/articles', (req, res) => {
  // Sparse fieldsets
  const fieldsParam = req.query.fields?.articles?.split(',') ?? null;

  // Paginación
  const pageNumber = parseInt(req.query.page?.number ?? '1');
  const pageSize   = parseInt(req.query.page?.size   ?? '10');
  const start  = (pageNumber - 1) * pageSize;
  const paged  = articles.slice(start, start + pageSize);

  const data     = paged.map(a => serializeArticle(a, fieldsParam));
  const included = resolveIncluded(req.query.include, paged);

  const response = {
    data,
    links: paginationLinks('/articles', articles.length, pageNumber, pageSize),
    meta:  { total: articles.length },
    ...(included && { included }),
  };

  res.status(200).set('Content-Type', JSONAPI_CT).json(response);
});

// GET /articles/:id
app.get('/articles/:id', (req, res) => {
  const article = articles.find(a => a.id === req.params.id);

  if (!article) {
    return res.status(404).set('Content-Type', JSONAPI_CT).json({
      errors: [{
        status: '404',
        title:  'Not Found',
        detail: `No existe un artículo con id '${req.params.id}'`,
        source: { parameter: 'id' },
      }]
    });
  }

  const fieldsParam = req.query.fields?.articles?.split(',') ?? null;
  const included    = resolveIncluded(req.query.include, [article]);

  res.status(200).set('Content-Type', JSONAPI_CT).json({
    data: serializeArticle(article, fieldsParam),
    ...(included && { included }),
  });
});

// POST /articles
app.post('/articles', (req, res) => {
  const payload = req.body?.data;

  // Validación básica del payload
  if (!payload || payload.type !== 'articles') {
    return res.status(422).set('Content-Type', JSONAPI_CT).json({
      errors: [{
        status: '422',
        title:  'Unprocessable Entity',
        detail: 'El body debe contener data.type = "articles"',
        source: { pointer: '/data/type' },
      }]
    });
  }

  const { title, content } = payload.attributes ?? {};
  const authorId = payload.relationships?.author?.data?.id;

  if (!title || !content || !authorId) {
    return res.status(422).set('Content-Type', JSONAPI_CT).json({
      errors: [
        !title    && { status: '422', title: 'Atributo requerido', detail: 'title es obligatorio',   source: { pointer: '/data/attributes/title'   } },
        !content  && { status: '422', title: 'Atributo requerido', detail: 'content es obligatorio', source: { pointer: '/data/attributes/content' } },
        !authorId && { status: '422', title: 'Relación requerida', detail: 'author es obligatorio',  source: { pointer: '/data/relationships/author/data/id' } },
      ].filter(Boolean)
    });
  }

  if (!users.find(u => u.id === authorId)) {
    return res.status(404).set('Content-Type', JSONAPI_CT).json({
      errors: [{
        status: '404',
        title:  'Not Found',
        detail: `No existe un usuario con id '${authorId}'`,
        source: { pointer: '/data/relationships/author/data/id' },
      }]
    });
  }

  const newArticle = {
    id: String(Date.now()),
    title,
    content,
    authorId,
  };

  articles.push(newArticle);

  res.status(201)
     .set('Content-Type', JSONAPI_CT)
     .set('Location', `/articles/${newArticle.id}`)
     .json({ data: serializeArticle(newArticle) });
});

// PATCH /articles/:id
app.patch('/articles/:id', (req, res) => {
  const article = articles.find(a => a.id === req.params.id);

  if (!article) {
    return res.status(404).set('Content-Type', JSONAPI_CT).json({
      errors: [{ status: '404', title: 'Not Found', detail: `No existe un artículo con id '${req.params.id}'` }]
    });
  }

  const attrs = req.body?.data?.attributes ?? {};

  // Actualización parcial: solo los campos enviados
  if (attrs.title)   article.title   = attrs.title;
  if (attrs.content) article.content = attrs.content;

  res.status(200).set('Content-Type', JSONAPI_CT).json({ data: serializeArticle(article) });
});

// DELETE /articles/:id
app.delete('/articles/:id', (req, res) => {
  const index = articles.findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).set('Content-Type', JSONAPI_CT).json({
      errors: [{ status: '404', title: 'Not Found', detail: `No existe un artículo con id '${req.params.id}'` }]
    });
  }

  articles.splice(index, 1);
  res.status(204).send(); // 204 No Content: delete exitoso, sin body
});

// ─── Rutas: Users ─────────────────────────────────────────────────────────────

app.get('/users', (req, res) => {
  res.status(200).set('Content-Type', JSONAPI_CT).json({
    data: users.map(serializeUser),
    meta: { total: users.length },
  });
});

app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);

  if (!user) {
    return res.status(404).set('Content-Type', JSONAPI_CT).json({
      errors: [{ status: '404', title: 'Not Found', detail: `No existe un usuario con id '${req.params.id}'` }]
    });
  }

  res.status(200).set('Content-Type', JSONAPI_CT).json({ data: serializeUser(user) });
});

// ─── Inicio ───────────────────────────────────────────────────────────────────

app.listen(3000, () => {
  console.log('Servidor JSON:API corriendo en http://localhost:3000');
});
