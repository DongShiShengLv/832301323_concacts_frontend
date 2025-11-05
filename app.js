
const BASE_URL = "http://localhost:3485";

async function request(path, { method = "GET", query, body } = {}) {
  const url = new URL(path, BASE_URL);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json;
}

const API = {
  list: async ({ q = "", favoriteOnly = false, page = 1, pageSize = 8 }) => {
    const json = await request("/api/contacts", {
      query: { q, favoriteOnly: favoriteOnly ? 1 : 0, page, pageSize }
    });
    return { data: json.data, total: json.total, page: json.page, pageSize: json.pageSize };
  },
  create: async ({ name, phone, favorite = false }) => {
    const json = await request("/api/contacts", {
      method: "POST",
      body: { name, phone, favorite }
    });
    return json.data;
  },
  update: async (id, patch) => {
    const json = await request(`/api/contacts/${id}`, {
      method: "PATCH",
      body: patch
    });
    return json.data;
  },
  remove: async (id) => {
    await request(`/api/contacts/${id}`, { method: "DELETE" });
    return true;
  }
};


const state = {
  q: "",
  favoriteOnly: false,
  page: 1,
  pageSize: 8,
  total: 0,
  items: []
};

const listEl = document.getElementById("list");
const pageInfoEl = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const searchInput = document.getElementById("searchInput");
const favOnlyEl = document.getElementById("favOnly");
const addBtn = document.getElementById("addBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const nameInput = document.getElementById("nameInput");
const phoneInput = document.getElementById("phoneInput");
const favoriteInput = document.getElementById("favoriteInput");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

let editingId = null;

function openModal({ title, data } = {}) {
  modalTitle.textContent = title || "Add Contact";
  nameInput.value = data?.name ?? "";
  phoneInput.value = data?.phone ?? "";
  favoriteInput.checked = !!data?.favorite;
  modal.classList.remove("hidden");
  nameInput.focus();
}
function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
}

function renderList() {
  listEl.innerHTML = "";
  state.items.forEach(item => {
    const li = document.createElement("li");
    li.className = "card";

    const title = document.createElement("h4");
    title.textContent = item.name || "未命名";

    const meta = document.createElement("div");
    meta.className = "meta";
    const dt = new Date(item.updatedAt || Date.now());
    meta.textContent = `Updated: ${dt.toLocaleString()}`;

    const row1 = document.createElement("div");
    row1.className = "row";
    const phonePill = document.createElement("span");
    phonePill.className = "pill";
    phonePill.textContent = `Number： ${item.phone || "-"}`;
    const favPill = document.createElement("span");
    favPill.className = "pill";
    favPill.textContent = item.favorite ? "★" : "☆";
    row1.appendChild(phonePill);
    row1.appendChild(favPill);

    const ops = document.createElement("div");
    ops.className = "ops";
    const editBtn = document.createElement("button");
    editBtn.className = "primary";
    editBtn.textContent = "编辑";
    editBtn.onclick = () => {
      editingId = item.id;
      openModal({ title: "编辑联系人", data: item });
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.onclick = async () => {
      if (!confirm("是否删除？")) return;
      await API.remove(item.id);
      await refresh();
    };
    const toggleFavBtn = document.createElement("button");
    toggleFavBtn.textContent = item.favorite ? "移出收藏" : "放入收藏";
    toggleFavBtn.onclick = async () => {
      await API.update(item.id, { favorite: !item.favorite });
      await refreshKeepingPage();
    };

    ops.appendChild(editBtn);
    ops.appendChild(delBtn);
    ops.appendChild(toggleFavBtn);

    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(row1);
    li.appendChild(ops);
    listEl.appendChild(li);
  });

  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  pageInfoEl.textContent = `页码 ${state.page} / ${totalPages} `;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
}

async function refresh() {
  state.page = 1;
  const { data, total, page, pageSize } = await API.list({
    q: state.q,
    favoriteOnly: state.favoriteOnly,
    page: state.page,
    pageSize: state.pageSize
  });
  state.items = data;
  state.total = total;
  state.page = page;
  state.pageSize = pageSize;
  renderList();
}

async function refreshKeepingPage() {
  const { data, total, page, pageSize } = await API.list({
    q: state.q,
    favoriteOnly: state.favoriteOnly,
    page: state.page,
    pageSize: state.pageSize
  });
  state.items = data;
  state.total = total;
  state.page = page;
  state.pageSize = pageSize;
  renderList();
}


addBtn.onclick = () => {
  editingId = null;
  openModal({ title: "添加联系人" });
};

cancelBtn.onclick = () => closeModal();

saveBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const favorite = !!favoriteInput.checked;

  if (editingId) {
    await API.update(editingId, { name, phone, favorite });
  } else {
    await API.create({ name, phone, favorite });
  }
  closeModal();
  await refresh();
};

searchInput.addEventListener("input", async (e) => {
  state.q = e.target.value.trim();
  await refresh();
});
favOnlyEl.addEventListener("change", async (e) => {
  state.favoriteOnly = e.target.checked;
  await refresh();
});
prevBtn.onclick = async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await refreshKeepingPage();
};
nextBtn.onclick = async () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  if (state.page >= totalPages) return;
  state.page += 1;
  await refreshKeepingPage();
};

refresh();