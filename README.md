# json:api — Prueba de Concepto

Implementación de una API REST usando la especificación [JSON:API v1.1](https://jsonapi.org), desarrollada para la materia **Desarrollo de Software** — UTN FRRo 2026.

## Informe

[https://docs.google.com/document/d/1jfk39FzaX4qtlqZfzJDLnnvNngLfEQyN/edit?usp=sharing&ouid=106429366101685113208&rtpof=true&sd=true](https://docs.google.com/document/d/1jfk39FzaX4qtlqZfzJDLnnvNngLfEQyN/edit?usp=sharing&ouid=106429366101685113208&rtpof=true&sd=true)

## Presentación

[https://docs.google.com/presentation/d/10K6AzxEq0znFf1y2bEKAwk09Cpq2bS9u/edit?usp=sharing&ouid=106429366101685113208&rtpof=true&sd=true](https://docs.google.com/presentation/d/10K6AzxEq0znFf1y2bEKAwk09Cpq2bS9u/edit?usp=sharing&ouid=106429366101685113208&rtpof=true&sd=true)

## Integrantes

| Apellido, Nombre |
| --- | 
| Romero Emmanuel |
| Tisocco Lucas |
| Cuesta Juan |

---

## ¿Qué es JSON:API?

JSON:API es una **especificación** (no una librería) que estandariza la forma en que una API HTTP estructura sus requests y responses JSON. Define convenciones para recursos, relaciones, paginación, filtros y manejo de errores, eliminando decisiones de diseño ad-hoc.

El media type que identifica la spec es `application/vnd.api+json`.

Un documento JSON:API tiene esta forma:

```json
{
  "data": {
    "type": "articles",
    "id": "1",
    "attributes": {
      "title": "Introducción a JSON:API"
    },
    "relationships": {
      "author": {
        "data": { "type": "users", "id": "1" }
      }
    }
  },
  "included": [
    {
      "type": "users",
      "id": "1",
      "attributes": { "name": "Juan Pérez" }
    }
  ]
}
```

---

## Proyecto

API de blog con dos recursos (`articles` y `users`) que demuestra las principales features de la especificación.

### Stack

- **Runtime:** Node.js
- **Framework:** Express

### Estructura

```
.
├── server.js       # Servidor principal
├── package.json
└── README.md
```

### Features demostradas

| Feature | Descripción | Ejemplo |
| --- | --- | --- |
| Media type obligatorio | Requests con body deben usar `application/vnd.api+json` | `POST /articles` sin header → 415 |
| Estructura estándar | `data`, `attributes`, `relationships`, `links` | `GET /articles/1` |
| Compound documents | Recursos relacionados en una sola respuesta | `?include=author,comments` |
| Sparse fieldsets | El cliente elige qué atributos recibir | `?fields[articles]=title` |
| Paginación con links | `first`, `last`, `prev`, `next` en cada respuesta | `?page[number]=1&page[size]=2` |
| Errores estructurados | Array `errors[]` con `title`, `detail` y `source.pointer` | `GET /articles/99` → 404 |
| CRUD completo | GET, POST, PATCH, DELETE | Ver endpoints |

---

## Uso

```bash
npm install
npm start
# → http://localhost:3000
```

---

## Endpoints

### Articles

#### `GET /articles` — listado con paginación

```bash
curl http://localhost:3000/articles
```

Con paginación:

```bash
curl "http://localhost:3000/articles?page[number]=1&page[size]=2"
```

Con recursos relacionados incluidos:

```bash
curl "http://localhost:3000/articles?include=author,comments"
```

Solo algunos atributos (sparse fieldsets):

```bash
curl "http://localhost:3000/articles?fields[articles]=title"
```

#### `GET /articles/:id` — artículo por ID

```bash
curl "http://localhost:3000/articles/1?include=author"
```

#### `POST /articles` — crear artículo

```bash
curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "articles",
      "attributes": {
        "title": "Nuevo artículo",
        "content": "Contenido del artículo"
      },
      "relationships": {
        "author": {
          "data": { "type": "users", "id": "1" }
        }
      }
    }
  }'
```

#### `PATCH /articles/:id` — actualización parcial

```bash
curl -X PATCH http://localhost:3000/articles/1 \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "articles",
      "id": "1",
      "attributes": {
        "title": "Título actualizado"
      }
    }
  }'
```

#### `DELETE /articles/:id` — eliminar artículo

```bash
curl -X DELETE http://localhost:3000/articles/1
# → 204 No Content
```

### Users

```bash
curl http://localhost:3000/users
curl http://localhost:3000/users/1
```

---

## Ejemplos de respuestas

### Error 404 — recurso no encontrado

```json
{
  "errors": [
    {
      "status": "404",
      "title": "Not Found",
      "detail": "No existe un artículo con id '99'",
      "source": { "parameter": "id" }
    }
  ]
}
```

### Error 415 — Content-Type incorrecto

```bash
curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "errors": [
    {
      "status": "415",
      "title": "Unsupported Media Type",
      "detail": "El Content-Type debe ser application/vnd.api+json"
    }
  ]
}
```

### Error 422 — payload inválido

```json
{
  "errors": [
    {
      "status": "422",
      "title": "Atributo requerido",
      "detail": "title es obligatorio",
      "source": { "pointer": "/data/attributes/title" }
    }
  ]
}
```
