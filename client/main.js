import {
  createApp,
  reactive,
  ref,
  computed,
  onMounted
} from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function graphqlRequest(operationName, query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ operationName, query, variables })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} ${message}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).join('\n');
    throw new Error(message);
  }

  return payload.data;
}

const BooksQuery = `
  query Books {
    books {
      id
      title
      author
      publishedYear
    }
  }
`;

const AddBookMutation = `
  mutation AddBook($input: AddBookInput!) {
    addBook(input: $input) {
      id
    }
  }
`;

const UpdateBookMutation = `
  mutation UpdateBook($input: UpdateBookInput!) {
    updateBook(input: $input) {
      id
    }
  }
`;

const DeleteBookMutation = `
  mutation DeleteBook($id: ID!) {
    deleteBook(id: $id)
  }
`;

const App = {
  setup() {
    const books = ref([]);
    const loading = ref(false);
    const errorMessage = ref('');

    const createForm = reactive({
      title: '',
      author: '',
      publishedYear: new Date().getFullYear()
    });

    const editForm = reactive({
      id: null,
      title: '',
      author: '',
      publishedYear: new Date().getFullYear()
    });

    const editingId = ref(null);

    const createLoading = ref(false);
    const updateLoading = ref(false);
    const deleteLoading = ref(false);

    const isBusy = computed(
      () => createLoading.value || updateLoading.value || deleteLoading.value
    );

    const resetCreateForm = () => {
      createForm.title = '';
      createForm.author = '';
      createForm.publishedYear = new Date().getFullYear();
    };

    const loadBooks = async () => {
      loading.value = true;
      errorMessage.value = '';
      try {
        const data = await graphqlRequest('Books', BooksQuery);
        books.value = data.books ?? [];
      } catch (error) {
        errorMessage.value = error.message || '无法加载数据';
      } finally {
        loading.value = false;
      }
    };

    const handleCreate = async () => {
      if (!createForm.title.trim() || !createForm.author.trim()) {
        errorMessage.value = '请填写完整的图书信息';
        return;
      }

      createLoading.value = true;
      errorMessage.value = '';
      try {
        await graphqlRequest('AddBook', AddBookMutation, {
          input: {
            title: createForm.title.trim(),
            author: createForm.author.trim(),
            publishedYear: Number(createForm.publishedYear)
          }
        });
        await loadBooks();
        resetCreateForm();
      } catch (error) {
        errorMessage.value = error.message || '新增失败';
      } finally {
        createLoading.value = false;
      }
    };

    const startEdit = (book) => {
      editingId.value = book.id;
      editForm.id = book.id;
      editForm.title = book.title;
      editForm.author = book.author;
      editForm.publishedYear = book.publishedYear;
    };

    const cancelEdit = () => {
      editingId.value = null;
    };

    const handleUpdate = async () => {
      if (!editingId.value) return;

      updateLoading.value = true;
      errorMessage.value = '';
      try {
        await graphqlRequest('UpdateBook', UpdateBookMutation, {
          input: {
            id: editForm.id,
            title: editForm.title.trim(),
            author: editForm.author.trim(),
            publishedYear: Number(editForm.publishedYear)
          }
        });
        editingId.value = null;
        await loadBooks();
      } catch (error) {
        errorMessage.value = error.message || '更新失败';
      } finally {
        updateLoading.value = false;
      }
    };

    const handleDelete = async (id) => {
      deleteLoading.value = true;
      errorMessage.value = '';
      try {
        await graphqlRequest('DeleteBook', DeleteBookMutation, { id });
        if (editingId.value === id) {
          editingId.value = null;
        }
        await loadBooks();
      } catch (error) {
        errorMessage.value = error.message || '删除失败';
      } finally {
        deleteLoading.value = false;
      }
    };

    const refetchBooks = () => {
      if (!loading.value) {
        loadBooks();
      }
    };

    onMounted(loadBooks);

    return {
      books,
      loading,
      errorMessage,
      createForm,
      editForm,
      editingId,
      isBusy,
      handleCreate,
      startEdit,
      cancelEdit,
      handleUpdate,
      handleDelete,
      refetchBooks
    };
  },
  template: `
    <main class="app">
      <h1>GraphQL 图书管理</h1>
      <p class="subtitle">使用 Vue 3 通过 GraphQL 接口完成图书的增删改查操作。</p>

      <section class="card">
        <h2>新增图书</h2>
        <form class="form-grid" @submit.prevent="handleCreate">
          <label>
            书名
            <input v-model="createForm.title" placeholder="请输入书名" required />
          </label>
          <label>
            作者
            <input v-model="createForm.author" placeholder="请输入作者" required />
          </label>
          <label>
            出版年份
            <input v-model.number="createForm.publishedYear" type="number" min="0" required />
          </label>
          <div class="form-actions">
            <button type="submit" class="primary" :disabled="isBusy">
              {{ isBusy ? '提交中...' : '创建' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card">
        <header class="table-header">
          <h2>图书列表</h2>
          <button type="button" class="ghost" @click="refetchBooks" :disabled="loading">刷新</button>
        </header>
        <p v-if="loading" class="info">正在加载数据...</p>
        <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
        <table v-else class="book-table">
          <thead>
            <tr>
              <th>书名</th>
              <th>作者</th>
              <th>年份</th>
              <th class="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="book in books" :key="book.id">
              <td>
                <template v-if="editingId === book.id">
                  <input v-model="editForm.title" required />
                </template>
                <template v-else>
                  {{ book.title }}
                </template>
              </td>
              <td>
                <template v-if="editingId === book.id">
                  <input v-model="editForm.author" required />
                </template>
                <template v-else>
                  {{ book.author }}
                </template>
              </td>
              <td>
                <template v-if="editingId === book.id">
                  <input v-model.number="editForm.publishedYear" type="number" min="0" required />
                </template>
                <template v-else>
                  {{ book.publishedYear }}
                </template>
              </td>
              <td class="actions">
                <div v-if="editingId === book.id" class="action-group">
                  <button type="button" class="primary" @click="handleUpdate" :disabled="isBusy">保存</button>
                  <button type="button" class="ghost" @click="cancelEdit">取消</button>
                </div>
                <div v-else class="action-group">
                  <button type="button" class="ghost" @click="startEdit(book)">编辑</button>
                  <button type="button" class="danger" @click="handleDelete(book.id)" :disabled="isBusy">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="!books.length">
              <td colspan="4" class="empty">暂无数据，请先创建图书。</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  `
};

createApp(App).mount('#app');
