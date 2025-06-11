import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const appId =
  typeof __app_id !== "undefined" ? __app_id : "minhas-receitas-app";
let currentUser = null;
let currentRecipeId = null;
let viewingRecipeId = null;
let recipesUnsubscribe = null;
let allUserRecipes = [];
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const recipeFormView = document.getElementById("recipe-form-view");
const recipeDetailView = document.getElementById("recipe-detail-view");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const recipeForm = document.getElementById("recipe-form");
const recipeListContainer = document.getElementById("recipe-list-container");
const detailContent = document.getElementById("detail-content");
const emptyState = document.getElementById("empty-state");
const noSearchResults = document.getElementById("no-search-results");
const addRecipeFab = document.getElementById("add-recipe-fab");
const userEmailDisplay = document.getElementById("user-email-display");
const ingredientsContainer = document.getElementById("ingredients-container");
const stepsContainer = document.getElementById("steps-container");
const imagePreview = document.getElementById("image-preview");
const photoUploadInput = document.getElementById("photo-upload");
const photoUploadPrompt = document.getElementById("photo-upload-prompt");
const loader = document.getElementById("loader");
const modalContainer = document.getElementById("modal-container");
const modalContent = document.getElementById("modal-content");

const userMenuButton = document.getElementById("user-menu-button");
const userMenu = document.getElementById("user-menu");
const changePasswordBtn = document.getElementById("change-password-btn");
const logoutBtn = document.getElementById("logout-btn");
const searchInput = document.getElementById("search-input");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const recipeCategorySelect = document.getElementById("recipe-category");
const favoritesFilter = document.getElementById("favorites-filter");
const categoryFilter = document.getElementById("category-filter");
const recipeCount = document.getElementById("recipe-count");

const RECIPE_CATEGORIES = [
  "Aperitivos e Entradas",
  "Pratos Principais",
  "Acompanhamentos",
  "Saladas",
  "Sopas e Caldos",
  "Lanches",
  "Sobremesas",
  "Bolos e Tortas",
  "Pães",
  "Bebidas",
  "Molhos",
  "Outros",
];

const showLoader = () => loader.classList.remove("hidden");
const hideLoader = () => loader.classList.add("hidden");
const showView = (viewId) => {
  [authView, appView, recipeFormView, recipeDetailView].forEach((v) =>
    v.classList.add("hidden")
  );
  document.getElementById(viewId).classList.remove("hidden");
  if (viewId !== "recipe-detail-view") {
    viewingRecipeId = null;
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
};
const showModal = (
  title,
  message,
  icon = "info",
  buttons = [{ text: "OK", class: "bg-amber-600" }]
) => {
  let iconSvg = "";
  switch (icon) {
    case "success":
      iconSvg = `<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100"><i data-lucide="check" class="h-6 w-6 text-green-600"></i></div>`;
      break;
    case "error":
      iconSvg = `<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100"><i data-lucide="alert-triangle" class="h-6 w-6 text-red-600"></i></div>`;
      break;
    case "confirm":
      iconSvg = `<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100"><i data-lucide="alert-circle" class="h-6 w-6 text-yellow-600"></i></div>`;
      break;
    default:
      iconSvg = `<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100"><i data-lucide="info" class="h-6 w-6 text-blue-600"></i></div>`;
  }
  modalContent.innerHTML = `${iconSvg}<h3 class="mt-3 text-lg leading-6 font-medium text-gray-900">${title}</h3><div class="mt-2 text-sm text-gray-500"><p>${message}</p></div><div class="mt-4 flex justify-center space-x-3">${buttons
    .map(
      (btn) =>
        `<button id="modal-btn-${btn.text
          .toLowerCase()
          .replace(
            / /g,
            "-"
          )}" class="px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${
          btn.class
        } hover:opacity-90">${btn.text}</button>`
    )
    .join("")}</div>`;
  modalContainer.classList.remove("hidden");
  if (typeof lucide !== "undefined") lucide.createIcons();
  buttons.forEach((btn) => {
    const btnEl = document.getElementById(
      `modal-btn-${btn.text.toLowerCase().replace(/ /g, "-")}`
    );
    if (btnEl)
      btnEl.onclick = () => {
        if (btn.action) btn.action();
        modalContainer.classList.add("hidden");
      };
  });
};

const showPasswordModal = () => {
  modalContent.innerHTML = `<div class="text-left"><h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Alterar Senha</h3><form id="change-password-form"><div class="space-y-4"><div><label for="new-password" class="block text-sm font-medium text-gray-700">Nova Senha</label><input type="password" id="new-password" required minlength="6" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Mínimo de 6 caracteres"></div><div><label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label><input type="password" id="confirm-password" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Repita a nova senha"></div></div><div class="mt-6 flex justify-end space-x-3"><button type="button" id="cancel-password-change" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button><button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700">Salvar</button></div></form></div>`;
  modalContainer.classList.remove("hidden");
  document
    .getElementById("cancel-password-change")
    .addEventListener("click", () => modalContainer.classList.add("hidden"));
  document
    .getElementById("change-password-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;
      if (newPassword !== confirmPassword) {
        showModal("Erro", "As senhas não coincidem.", "error");
        return;
      }
      showLoader();
      try {
        await updatePassword(auth.currentUser, newPassword);
        hideLoader();
        modalContainer.classList.add("hidden");
        showModal("Sucesso!", "Sua senha foi alterada.", "success");
      } catch (error) {
        hideLoader();
        console.error("Erro ao alterar senha:", error);
        let errorMessage = "Ocorreu um erro.";
        if (error.code === "auth/requires-recent-login") {
          errorMessage =
            "Esta operação é sensível e exige autenticação recente. Por favor, faça login novamente.";
        }
        modalContainer.classList.add("hidden");
        showModal("Erro ao Alterar Senha", errorMessage, "error");
      }
    });
};

const handleForgotPassword = () => {
  modalContent.innerHTML = `<div class="text-left"><h3 class="text-lg leading-6 font-medium text-gray-900 mb-2">Redefinir Senha</h3><p class="text-sm text-gray-500 mb-4">Insira seu e-mail para receber um link de redefinição.</p><form id="reset-password-form"><div><label for="reset-email" class="sr-only">Email</label><input type="email" id="reset-email" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="seu@email.com"></div><div class="mt-6 flex justify-end space-x-3"><button type="button" id="cancel-reset" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button><button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700">Enviar Link</button></div></form></div>`;
  modalContainer.classList.remove("hidden");
  document
    .getElementById("cancel-reset")
    .addEventListener("click", () => modalContainer.classList.add("hidden"));
  document
    .getElementById("reset-password-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("reset-email").value;
      showLoader();
      try {
        await sendPasswordResetEmail(auth, email);
        hideLoader();
        modalContainer.classList.add("hidden");
        showModal(
          "Verifique seu Email",
          `Se um usuário com o e-mail ${email} existir, um link de redefinição foi enviado.`,
          "success"
        );
      } catch (error) {
        hideLoader();
        modalContainer.classList.add("hidden");
        console.error("Erro ao enviar email:", error);
        showModal(
          "Erro",
          "Não foi possível enviar o email de redefinição.",
          "error"
        );
      }
    });
};

function populateCategorySelects() {
  const selects = [recipeCategorySelect, categoryFilter];
  selects.forEach((select) => {
    if (!select) return;
    select.innerHTML = "";
    const defaultOptionText =
      select.id === "category-filter"
        ? "Todas as Categorias"
        : "Selecione uma categoria";
    const defaultOption = document.createElement("option");
    defaultOption.value = "all";
    defaultOption.textContent = defaultOptionText;
    if (select.id !== "category-filter") {
      defaultOption.disabled = true;
      defaultOption.selected = true;
    }
    select.appendChild(defaultOption);
    RECIPE_CATEGORIES.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userEmailDisplay.textContent = user.email;
    showView("app-view");
    getRecipes();
  } else {
    currentUser = null;
    userEmailDisplay.textContent = "";
    if (recipesUnsubscribe) recipesUnsubscribe();
    recipesUnsubscribe = null;
    allUserRecipes = [];
    loginForm.reset();
    searchInput.value = "";
    showView("auth-view");
  }
  hideLoader();
});
async function uploadImage(file) {
  if (!file || !currentUser) return null;
  showLoader();
  const filePath = `images/${currentUser.uid}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    hideLoader();
    return downloadURL;
  } catch (error) {
    hideLoader();
    console.error("Falha no upload:", error);
    showModal("Erro de Upload", "Não foi possível enviar a imagem.", "error");
    return null;
  }
}
async function deleteImage(photoUrl) {
  if (!photoUrl) return;
  try {
    const imageRef = ref(storage, photoUrl);
    await deleteObject(imageRef);
    console.log("Imagem deletada.");
  } catch (error) {
    if (error.code !== "storage/object-not-found") {
      console.error("Falha ao deletar imagem:", error);
    }
  }
}
function getRecipes() {
  if (recipesUnsubscribe) recipesUnsubscribe();
  const recipesRef = collection(
    db,
    "artifacts",
    appId,
    "users",
    currentUser.uid,
    "recipes"
  );
  const q = query(recipesRef);
  recipesUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      allUserRecipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderRecipeList();
      if (viewingRecipeId) {
        const updatedRecipe = allUserRecipes.find(
          (r) => r.id === viewingRecipeId
        );
        if (updatedRecipe) {
          renderRecipeDetail(updatedRecipe);
        } else {
          viewingRecipeId = null;
          showView("app-view");
        }
      }
    },
    (error) => {
      console.error("Erro ao buscar receitas:", error);
      showModal("Erro", "Não foi possível carregar as receitas.", "error");
    }
  );
}
async function saveRecipe(recipeData, oldPhotoUrl = null) {
  showLoader();
  try {
    const recipesRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      currentUser.uid,
      "recipes"
    );
    if (oldPhotoUrl && oldPhotoUrl !== recipeData.photoUrl) {
      await deleteImage(oldPhotoUrl);
    }
    if (currentRecipeId) {
      const docRef = doc(
        db,
        "artifacts",
        appId,
        "users",
        currentUser.uid,
        "recipes",
        currentRecipeId
      );
      await updateDoc(docRef, { ...recipeData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(recipesRef, {
        ...recipeData,
        isFavorite: false,
        createdAt: serverTimestamp(),
        userId: currentUser.uid,
      });
    }
    hideLoader();
    showModal("Sucesso!", "Sua receita foi salva.", "success");
    showView("app-view");
    resetForm();
  } catch (error) {
    hideLoader();
    console.error("Erro ao salvar receita:", error);
    showModal("Erro", "Não foi possível salvar a receita.", "error");
  }
}
async function deleteRecipe(recipeId) {
  showLoader();
  try {
    const docRef = doc(
      db,
      "artifacts",
      appId,
      "users",
      currentUser.uid,
      "recipes",
      recipeId
    );
    const recipeDoc = await getDoc(docRef);
    if (recipeDoc.exists()) {
      const { photoUrl } = recipeDoc.data();
      if (photoUrl) {
        await deleteImage(photoUrl);
      }
    }
    await deleteDoc(docRef);
    hideLoader();
    showModal("Receita Excluída", "A receita foi removida.", "success");
    showView("app-view");
  } catch (error) {
    hideLoader();
    console.error("Erro ao excluir receita:", error);
    showModal("Erro", "Não foi possível excluir a receita.", "error");
  }
}
async function toggleFavoriteStatus(recipeId, currentStatus) {
  const docRef = doc(
    db,
    "artifacts",
    appId,
    "users",
    currentUser.uid,
    "recipes",
    recipeId
  );
  try {
    await updateDoc(docRef, { isFavorite: !currentStatus });
  } catch (error) {
    console.error("Erro ao favoritar:", error);
    showModal(
      "Erro",
      "Não foi possível atualizar o status de favorito.",
      "error"
    );
  }
}

function validateRecipeForm() {
  const name = document.getElementById("recipe-name").value.trim();
  const category = document.getElementById("recipe-category").value;
  if (!name) {
    showModal("Erro de Validação", "O nome da receita é obrigatório.", "error");
    return false;
  }
  if (!category || category === "all") {
    showModal("Erro de Validação", "Selecione uma categoria.", "error");
    return false;
  }
  return true;
}

recipeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateRecipeForm()) {
    return;
  }
  let newPhotoUrl = null;
  let oldPhotoUrl = null;
  if (currentRecipeId) {
    const docRef = doc(
      db,
      "artifacts",
      appId,
      "users",
      currentUser.uid,
      "recipes",
      currentRecipeId
    );
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      oldPhotoUrl = docSnap.data().photoUrl;
    }
  }
  if (photoUploadInput.files[0]) {
    newPhotoUrl = await uploadImage(photoUploadInput.files[0]);
    if (!newPhotoUrl) return;
  } else {
    const currentPreviewSrc = imagePreview.src;
    if (
      currentPreviewSrc &&
      !currentPreviewSrc.startsWith("https://placehold.co")
    ) {
      newPhotoUrl = currentPreviewSrc;
    }
  }

  const recipeData = {
    name: document.getElementById("recipe-name").value.trim(),
    category: document.getElementById("recipe-category").value,
    photoUrl: newPhotoUrl,
    prepTime: document.getElementById("prep-time").value
      ? parseInt(document.getElementById("prep-time").value, 10)
      : null,
    cookTime: document.getElementById("cook-time").value
      ? parseInt(document.getElementById("cook-time").value, 10)
      : null,
    servings: document.getElementById("servings").value
      ? parseInt(document.getElementById("servings").value, 10)
      : null,
    ingredients: Array.from(
      ingredientsContainer.querySelectorAll(".dynamic-item span")
    )
      .map((span) => span.textContent.trim())
      .filter((val) => val !== ""),
    steps: Array.from(stepsContainer.querySelectorAll(".dynamic-item span"))
      .map((span) => span.textContent.trim())
      .filter((val) => val !== ""),
  };
  saveRecipe(recipeData, oldPhotoUrl);
});

function renderRecipeList() {
  const searchTerm = searchInput.value.toLowerCase();
  const showOnlyFavorites =
    favoritesFilter.getAttribute("aria-checked") === "true";
  const selectedCategory = categoryFilter.value;

  let recipesToDisplay = allUserRecipes;
  if (showOnlyFavorites) {
    recipesToDisplay = recipesToDisplay.filter((recipe) => recipe.isFavorite);
  }
  if (selectedCategory !== "all") {
    recipesToDisplay = recipesToDisplay.filter(
      (recipe) => recipe.category === selectedCategory
    );
  }
  if (searchTerm) {
    recipesToDisplay = recipesToDisplay.filter((recipe) => {
      const nameMatch = recipe.name.toLowerCase().includes(searchTerm);
      const ingredientsMatch = (recipe.ingredients || []).some((ing) =>
        ing.toLowerCase().includes(searchTerm)
      );
      return nameMatch || ingredientsMatch;
    });
  }

  recipeListContainer.innerHTML = "";
  emptyState.classList.add("hidden");
  noSearchResults.classList.add("hidden");
  recipeCount.classList.add("hidden");

  if (allUserRecipes.length === 0) {
    emptyState.classList.remove("hidden");
    addRecipeFab.classList.add("hidden");
  } else if (recipesToDisplay.length === 0) {
    noSearchResults.classList.remove("hidden");
    addRecipeFab.classList.remove("hidden");
  } else {
    addRecipeFab.classList.remove("hidden");
    recipeCount.textContent = `A exibir ${recipesToDisplay.length} de ${allUserRecipes.length} receitas.`;
    recipeCount.classList.remove("hidden");

    recipesToDisplay
      .sort(
        (a, b) =>
          (b.updatedAt || b.createdAt)?.toMillis() -
          (a.updatedAt || a.createdAt)?.toMillis()
      )
      .forEach((recipe, index) => {
        const card = document.createElement("div");
        card.className =
          "bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-200 recipe-card-fade-in";
        card.style.animationDelay = `${index * 50}ms`;

        const timeInfo = recipe.prepTime
          ? `<span><i data-lucide="clock" class="inline-block h-4 w-4 mr-1"></i>${recipe.prepTime} min</span>`
          : "";
        const servingsInfo = recipe.servings
          ? `<span><i data-lucide="users" class="inline-block h-4 w-4 mr-1"></i>${recipe.servings}</span>`
          : "";
        const categoryBadge = recipe.category
          ? `<div class="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">${recipe.category}</div>`
          : "";
        const favoriteIconHTML = `<button data-action="favorite" class="absolute top-2 right-2 p-1 bg-white/70 rounded-full text-red-500 hover:bg-white">${
          recipe.isFavorite
            ? '<i data-lucide="heart" class="h-5 w-5 fill-current"></i>'
            : '<i data-lucide="heart" class="h-5 w-5"></i>'
        }</button>`;

        card.innerHTML = `<div class="relative"><img src="${
          recipe.photoUrl ||
          "https://placehold.co/400x300/e2e8f0/cbd5e0?text=Receita"
        }" alt="Foto de ${
          recipe.name
        }" class="h-40 w-full object-cover">${categoryBadge}${favoriteIconHTML}</div><div class="p-4"><h3 class="font-semibold text-lg truncate">${
          recipe.name
        }</h3><div class="text-sm text-gray-500 mt-2 flex items-center space-x-4">${timeInfo}${servingsInfo}</div></div>`;

        card.addEventListener("click", () => {
          renderRecipeDetail(recipe);
        });

        const favoriteButton = card.querySelector('[data-action="favorite"]');
        favoriteButton.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleFavoriteStatus(recipe.id, recipe.isFavorite);
        });

        recipeListContainer.appendChild(card);
      });
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}
function renderRecipeDetail(recipe) {
  viewingRecipeId = recipe.id;
  const prepTimeHTML = recipe.prepTime
    ? `<div class="flex items-center"><i data-lucide="timer" class="h-5 w-5 mr-2 text-amber-500"></i>Preparo: <strong>${recipe.prepTime} min</strong></div>`
    : "";
  const cookTimeHTML = recipe.cookTime
    ? `<div class="flex items-center"><i data-lucide="flame" class="h-5 w-5 mr-2 text-amber-500"></i>Cozimento: <strong>${recipe.cookTime} min</strong></div>`
    : "";
  const servingsHTML = recipe.servings
    ? `<div class="flex items-center"><i data-lucide="users" class="h-5 w-5 mr-2 text-amber-500"></i>Rendimento: <strong>${recipe.servings} porções</strong></div>`
    : "";
  const categoryHTML = recipe.category
    ? `<div class="flex items-center"><i data-lucide="tag" class="h-5 w-5 mr-2 text-amber-500"></i>Categoria: <strong>${recipe.category}</strong></div>`
    : "";

  detailContent.innerHTML = `<div class="bg-white rounded-lg shadow-xl overflow-hidden"><div class="relative"><img src="${
    recipe.photoUrl || "https://placehold.co/800x400/e2e8f0/cbd5e0?text=Receita"
  }" alt="${
    recipe.name
  }" class="w-full h-64 md:h-80 object-cover"><button id="back-from-detail" class="absolute top-4 left-4 bg-white/80 backdrop-blur-sm rounded-full p-2 text-gray-800 hover:bg-white"><i data-lucide="arrow-left" class="h-6 w-6"></i></button></div><div class="p-6 md:p-8"><div class="flex justify-between items-start mb-4"><h1 class="text-3xl md:text-4xl font-bold text-gray-900">${
    recipe.name
  }</h1><div class="flex-shrink-0 ml-4 flex space-x-2"><button id="print-btn-detail" class="p-2 rounded-full text-gray-600 hover:bg-gray-100"><i data-lucide="printer" class="h-7 w-7"></i></button><button id="favorite-btn-detail" class="p-2 rounded-full text-red-500 hover:bg-red-100">${
    recipe.isFavorite
      ? '<i data-lucide="heart" class="h-7 w-7 fill-current"></i>'
      : '<i data-lucide="heart" class="h-7 w-7"></i>'
  }</button></div></div><div class="flex flex-wrap gap-x-6 gap-y-2 text-gray-600 border-b pb-4 mb-6">${prepTimeHTML}${cookTimeHTML}${servingsHTML}${categoryHTML}</div><div class="space-y-8"><section> <h2 class="text-2xl font-semibold mb-3 text-gray-800">Ingredientes</h2><ul class="list-disc list-inside space-y-2 text-gray-700">${(
    recipe.ingredients || []
  )
    .map((ing) => `<li>${ing}</li>`)
    .join(
      ""
    )}</ul></section><section><h2 class="text-2xl font-semibold mb-3 text-gray-800">Modo de Preparo</h2><ol class="list-decimal list-inside space-y-4 text-gray-700">${(
    recipe.steps || []
  )
    .map((step) => `<li>${step}</li>`)
    .join(
      ""
    )}</ol></section></div><div class="mt-8 pt-6 border-t flex justify-end space-x-3"><button id="edit-recipe-btn-detail" class="inline-flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"><i data-lucide="edit" class="mr-2 h-5 w-5"></i>Editar</button><button id="delete-recipe-btn-detail" class="inline-flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"><i data-lucide="trash-2" class="mr-2 h-5 w-5"></i>Excluir</button></div></div></div>`;
  showView("recipe-detail-view");
  document
    .getElementById("back-from-detail")
    .addEventListener("click", () => showView("app-view"));
  document
    .getElementById("edit-recipe-btn-detail")
    .addEventListener("click", () => showRecipeForm(recipe));
  document
    .getElementById("delete-recipe-btn-detail")
    .addEventListener("click", () => {
      showModal(
        "Confirmar Exclusão",
        `Tem certeza de que deseja excluir a receita "${recipe.name}"?`,
        "confirm",
        [
          { text: "Cancelar", class: "bg-gray-500" },
          {
            text: "Excluir",
            class: "bg-red-600",
            action: () => deleteRecipe(recipe.id),
          },
        ]
      );
    });
  document
    .getElementById("favorite-btn-detail")
    .addEventListener("click", () =>
      toggleFavoriteStatus(recipe.id, recipe.isFavorite)
    );
  document
    .getElementById("print-btn-detail")
    .addEventListener("click", () => window.print());
}
function createEditableListItem(container, placeholder, value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center space-x-2 dynamic-item group";

  const handle = document.createElement("span");
  handle.className =
    "drag-handle cursor-grab text-gray-400 hover:text-gray-600";
  handle.innerHTML =
    '<i data-lucide="grip-vertical" class="h-5 w-5 pointer-events-none"></i>';

  const span = document.createElement("span");
  span.textContent = value;
  span.className = "flex-grow p-2";

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.className =
    "hidden flex-grow block w-full border-gray-300 rounded-md shadow-sm sm:text-sm";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.innerHTML =
    '<i data-lucide="pencil" class="h-5 w-5 text-gray-400 hover:text-amber-500 pointer-events-none"></i>';

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.innerHTML =
    '<i data-lucide="check" class="h-5 w-5 text-gray-400 hover:text-green-500 pointer-events-none"></i>';
  saveBtn.className = "hidden";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.innerHTML =
    '<i data-lucide="x-circle" class="h-5 w-5 text-gray-400 hover:text-red-500 pointer-events-none"></i>';

  const switchToEditMode = () => {
    span.classList.add("hidden");
    editBtn.classList.add("hidden");
    input.classList.remove("hidden");
    saveBtn.classList.remove("hidden");
    input.focus();
    input.select();
  };
  const switchToDisplayMode = () => {
    const newValue = input.value.trim();
    if (newValue === "" && span.textContent === "") {
      wrapper.remove();
      return;
    }
    span.textContent = newValue;
    input.value = newValue;
    span.classList.remove("hidden");
    editBtn.classList.remove("hidden");
    input.classList.add("hidden");
    saveBtn.classList.add("hidden");
  };

  editBtn.addEventListener("click", switchToEditMode);
  saveBtn.addEventListener("click", switchToDisplayMode);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      switchToDisplayMode();
    } else if (e.key === "Escape") {
      input.value = span.textContent;
      switchToDisplayMode();
    }
  });
  removeBtn.addEventListener("click", () => wrapper.remove());

  wrapper.appendChild(handle);
  wrapper.appendChild(span);
  wrapper.appendChild(input);
  wrapper.appendChild(editBtn);
  wrapper.appendChild(saveBtn);
  wrapper.appendChild(removeBtn);

  container.appendChild(wrapper);
  if (typeof lucide !== "undefined") lucide.createIcons();
  if (!value) {
    switchToEditMode();
  }
}
function addDynamicInput(container, placeholder) {
  createEditableListItem(container, placeholder);
}
function addDynamicInputWithValue(container, placeholder, value) {
  createEditableListItem(container, placeholder, value);
}
function resetForm() {
  recipeForm.reset();
  currentRecipeId = null;
  ingredientsContainer.innerHTML = "";
  stepsContainer.innerHTML = "";
  addDynamicInput(ingredientsContainer, "ex: 2 xícaras de farinha");
  addDynamicInput(stepsContainer, "ex: Misture os ingredientes secos");
  imagePreview.src = "";
  imagePreview.classList.add("hidden");
  photoUploadPrompt.classList.remove("hidden");
  photoUploadInput.value = "";
}
function showRecipeForm(recipeToEdit = null) {
  resetForm();
  if (recipeToEdit) {
    currentRecipeId = recipeToEdit.id;
    document.getElementById("form-title").textContent = "Editar Receita";
    document.getElementById("recipe-name").value = recipeToEdit.name || "";
    document.getElementById("recipe-category").value =
      recipeToEdit.category || "";
    document.getElementById("prep-time").value = recipeToEdit.prepTime || "";
    document.getElementById("cook-time").value = recipeToEdit.cookTime || "";
    document.getElementById("servings").value = recipeToEdit.servings || "";
    if (recipeToEdit.photoUrl) {
      imagePreview.src = recipeToEdit.photoUrl;
      imagePreview.classList.remove("hidden");
      photoUploadPrompt.classList.add("hidden");
    }
    ingredientsContainer.innerHTML = "";
    (recipeToEdit.ingredients || []).forEach((ing) =>
      addDynamicInputWithValue(
        ingredientsContainer,
        "ex: 2 xícaras de farinha",
        ing
      )
    );
    stepsContainer.innerHTML = "";
    (recipeToEdit.steps || []).forEach((step) =>
      addDynamicInputWithValue(
        stepsContainer,
        "ex: Misture os ingredientes secos",
        step
      )
    );
  } else {
    document.getElementById("form-title").textContent = "Nova Receita";
  }
  new Sortable(ingredientsContainer, {
    animation: 150,
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
  });
  new Sortable(stepsContainer, {
    animation: 150,
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
  });
  showView("recipe-form-view");
}
window.toggleFavorite = toggleFavoriteStatus;
document.addEventListener("DOMContentLoaded", () => {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoader();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      hideLoader();
      showModal("Erro no Login", error.message, "error");
    }
  });
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoader();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      hideLoader();
      showModal("Erro no Cadastro", error.message, "error");
    }
  });
  userMenuButton.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) {
      userMenu.classList.add("hidden");
    }
  });
  changePasswordBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showPasswordModal();
    userMenu.classList.add("hidden");
  });
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    userMenu.classList.add("hidden");
    showLoader();
    try {
      await signOut(auth);
    } catch (error) {
      hideLoader();
      showModal("Erro ao Sair", error.message, "error");
    }
  });
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    handleForgotPassword();
  });
  document.getElementById("show-signup").addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  });
  document.getElementById("show-login").addEventListener("click", (e) => {
    e.preventDefault();
    signupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });
  [addRecipeFab, document.getElementById("add-recipe-btn-empty")].forEach(
    (btn) => btn.addEventListener("click", () => showRecipeForm())
  );
  document
    .getElementById("add-ingredient-btn")
    .addEventListener("click", () =>
      addDynamicInput(ingredientsContainer, "ex: 1 colher de sal")
    );
  document
    .getElementById("add-step-btn")
    .addEventListener("click", () =>
      addDynamicInput(stepsContainer, "ex: Asse por 30 minutos")
    );
  document
    .getElementById("back-to-list-btn")
    .addEventListener("click", () => showView("app-view"));
  document
    .getElementById("cancel-form-btn")
    .addEventListener("click", () => showView("app-view"));
  photoUploadInput.addEventListener("change", () => {
    const file = photoUploadInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove("hidden");
        photoUploadPrompt.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    }
  });
  searchInput.addEventListener("input", renderRecipeList);
  favoritesFilter.addEventListener("click", () => {
    const isChecked = favoritesFilter.getAttribute("aria-checked") === "true";
    favoritesFilter.setAttribute("aria-checked", !isChecked);
    renderRecipeList();
  });
  categoryFilter.addEventListener("change", renderRecipeList);
  const numericInputs = [
    document.getElementById("prep-time"),
    document.getElementById("cook-time"),
    document.getElementById("servings"),
  ];
  const enforceNumericInput = (event) => {
    event.target.value = event.target.value.replace(/\D/g, "");
  };
  numericInputs.forEach((input) => {
    if (input) {
      input.addEventListener("input", enforceNumericInput);
    }
  });
  populateCategorySelects();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("Service worker registered.", reg))
        .catch((err) => console.log("Service worker not registered.", err));
    });
  }
  showLoader();
  resetForm();
});
