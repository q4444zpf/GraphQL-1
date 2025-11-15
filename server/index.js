import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, 'data');
const booksFile = join(dataDir, 'books.json');

const DEFAULT_BOOKS = [
  { id: 'book-1', title: 'GraphQL入门', author: 'Alice', publishedYear: 2020 },
  { id: 'book-2', title: '精通Vue3', author: 'Bob', publishedYear: 2022 }
];

const ensureDataDir = () => {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
};

const sanitizeBook = (book) => {
  if (!book || typeof book !== 'object') return null;

  const year = Number(book.publishedYear);
  if (Number.isNaN(year)) return null;

  const id = book.id ?? randomUUID();
  const title = book.title ?? '';
  const author = book.author ?? '';

  if (!String(title).trim() || !String(author).trim()) return null;

  return {
    id: String(id),
    title: String(title),
    author: String(author),
    publishedYear: Math.trunc(year)
  };
};

const saveBooksFile = (list) => {
  ensureDataDir();
  writeFileSync(booksFile, JSON.stringify(list, null, 2), 'utf8');
};

const loadBooksFile = () => {
  ensureDataDir();
  if (!existsSync(booksFile)) {
    const fallback = DEFAULT_BOOKS.map((book) => ({ ...book }));
    saveBooksFile(fallback);
    return fallback;
  }

  try {
    const raw = readFileSync(booksFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('books.json must contain an array.');
    }

    const sanitized = parsed
      .map(sanitizeBook)
      .filter((book) => book !== null);

    if (sanitized.length === 0) {
      throw new Error('books.json does not contain valid entries.');
    }

    return sanitized;
  } catch (error) {
    console.warn('[GraphQL] Failed to load books.json, recreating defaults:', error.message);
    const fallback = DEFAULT_BOOKS.map((book) => ({ ...book }));
    saveBooksFile(fallback);
    return fallback;
  }
};

let books = loadBooksFile();

const persistBooks = (onFailure) => {
  try {
    saveBooksFile(books);
    return true;
  } catch (error) {
    console.error('[GraphQL] Failed to persist books.json:', error.message);
    if (typeof onFailure === 'function') {
      onFailure();
    }
    return false;
  }
};

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const getOperationName = (query = '', providedName) => {
  if (providedName) return providedName;
  const match = query.match(/\b(?:query|mutation)\s+(\w+)/i);
  return match ? match[1] : null;
};

const resolvers = {
  Books: () => ({ data: { books } }),
  Book: ({ variables }) => ({
    data: {
      book: books.find((book) => book.id === variables?.id) ?? null
    }
  }),
  AddBook: ({ variables }) => {
    const input = variables?.input;
    if (!input) {
      return {
        errors: [{ message: 'Missing input for addBook mutation.' }],
        data: { addBook: null }
      };
    }

    const title = String(input.title ?? '').trim();
    const author = String(input.author ?? '').trim();
    const year = Number(input.publishedYear);

    if (!title || !author || !Number.isFinite(year)) {
      return {
        errors: [{ message: 'Invalid input for addBook mutation.' }],
        data: { addBook: null }
      };
    }

    const newBook = {
      id: randomUUID(),
      title,
      author,
      publishedYear: Math.trunc(year)
    };
    books.push(newBook);
    if (!persistBooks(() => {
      if (books[books.length - 1]?.id === newBook.id) {
        books.pop();
        return;
      }
      const index = books.findIndex((book) => book.id === newBook.id);
      if (index !== -1) {
        books.splice(index, 1);
      }
    })) {
      return {
        errors: [{ message: 'Failed to persist new book. Please retry later.' }],
        data: { addBook: null }
      };
    }

    return { data: { addBook: newBook } };
  },
  UpdateBook: ({ variables }) => {
    const input = variables?.input;
    const bookId = input?.id;
    if (!bookId) {
      return {
        errors: [{ message: 'Missing id for updateBook mutation.' }],
        data: { updateBook: null }
      };
    }
    const index = books.findIndex((book) => book.id === bookId);
    if (index === -1) {
      return {
        errors: [{ message: 'Book not found.' }],
        data: { updateBook: null }
      };
    }
    const updates = {};

    if (input.title !== undefined) {
      const nextTitle = String(input.title).trim();
      if (!nextTitle) {
        return {
          errors: [{ message: 'Title cannot be empty.' }],
          data: { updateBook: null }
        };
      }
      updates.title = nextTitle;
    }

    if (input.author !== undefined) {
      const nextAuthor = String(input.author).trim();
      if (!nextAuthor) {
        return {
          errors: [{ message: 'Author cannot be empty.' }],
          data: { updateBook: null }
        };
      }
      updates.author = nextAuthor;
    }

    if (input.publishedYear !== undefined) {
      const year = Number(input.publishedYear);
      if (!Number.isFinite(year)) {
        return {
          errors: [{ message: 'Published year must be a number.' }],
          data: { updateBook: null }
        };
      }
      updates.publishedYear = Math.trunc(year);
    }

    if (Object.keys(updates).length === 0) {
      return {
        errors: [{ message: 'No fields provided to update.' }],
        data: { updateBook: null }
      };
    }

    const updated = {
      ...books[index],
      ...updates
    };

    const previous = books[index];
    books[index] = updated;
    if (!persistBooks(() => {
      books[index] = previous;
    })) {
      return {
        errors: [{ message: 'Failed to persist updated book. Please retry later.' }],
        data: { updateBook: null }
      };
    }

    return { data: { updateBook: updated } };
  },
  DeleteBook: ({ variables }) => {
    const id = variables?.id;
    if (!id) {
      return {
        errors: [{ message: 'Missing id for deleteBook mutation.' }],
        data: { deleteBook: false }
      };
    }
    const index = books.findIndex((book) => book.id === id);
    if (index === -1) {
      return {
        errors: [{ message: 'Book not found.' }],
        data: { deleteBook: false }
      };
    }
    const [removed] = books.splice(index, 1);
    if (!persistBooks(() => {
      books.splice(index, 0, removed);
    })) {
      return {
        errors: [{ message: 'Failed to persist deletion. Please retry later.' }],
        data: { deleteBook: false }
      };
    }

    return { data: { deleteBook: true } };
  }
};

const server = createServer(async (req, res) => {
  if (req.url !== '/graphql') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      errors: [{ message: 'GraphQL endpoint only supports POST requests.' }],
      data: null
    });
    return;
  }

  try {
    const body = await parseBody(req);
    const { query = '', variables = {}, operationName } = body;
    const opName = getOperationName(query, operationName);

    if (!opName || !resolvers[opName]) {
      sendJson(res, 400, {
        errors: [{ message: 'Unsupported GraphQL operation.' }],
        data: null
      });
      return;
    }

    const result = resolvers[opName]({ variables, query });
    if (result.errors) {
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      errors: [{ message: error.message || 'Internal server error.' }],
      data: null
    });
  }
});

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => {
  console.log(`GraphQL server is running on http://localhost:${port}/graphql`);
});
