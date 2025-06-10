// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// =================================================================
// CÓDIGO JAVASCRIPT COMPLETO (o mesmo que estava no index.html)
// COLE TODO O CONTEÚDO DO SCRIPT ANTERIOR AQUI
// =================================================================
// ... (COLE TODO O JAVASCRIPT AQUI) ...

// **IMPORTANTE**: Lembre-se de colocar sua configuração do Firebase aqui!
const firebaseConfig = {
  apiKey: "AIzaSyBVhmXtfKGR6jQSRY4jHQu39m1wT4hSiCM",
  authDomain: "minhas-receitas-app-456de.firebaseapp.com",
  projectId: "minhas-receitas-app-456de",
  storageBucket: "minhas-receitas-app-456de.firebasestorage.app",
  messagingSenderId: "795944851200",
  appId: "1:795944851200:web:b68c53e0250342896a45e5",
  measurementId: "G-8FHCCGYNW8",
};

// Se __firebase_config estiver disponível, use-o.
try {
  const externalConfig = JSON.parse(
    typeof __firebase_config !== "undefined" ? __firebase_config : "{}"
  );
  if (externalConfig.apiKey) {
    Object.assign(firebaseConfig, externalConfig);
  }
} catch (e) {
  console.error("Could not parse external Firebase config:", e);
}

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const appId =
  typeof __app_id !== "undefined" ? __app_id : "minhas-receitas-app";

// --- State Management ---
let currentUser = null;
let currentRecipeId = null; // Used for editing
let recipesUnsubscribe = null; // To detach Firestore listener on logout

// --- DOM Elements ---
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
const addRecipeFab = document.getElementById("add-recipe-fab");

const userEmailDisplay = document.getElementById("user-email-display");
const ingredientsContainer = document.getElementById("ingredients-container");
const stepsContainer = document.getElementById("steps-container");
const imagePreview = document.getElementById("image-preview");
const photoUploadInput = document.getElementById("photo-upload");

const loader = document.getElementById("loader");
const modalContainer = document.getElementById("modal-container");
const modalContent = document.getElementById("modal-content");

// --- UI Control Functions ---
const showLoader = () => loader.classList.remove("hidden");
const hideLoader = () => loader.classList.add("hidden");

const showView = (viewId) => {
  [authView, appView, recipeFormView, recipeDetailView].forEach((v) =>
    v.classList.add("hidden")
  );
  document.getElementById(viewId).classList.remove("hidden");
  lucide.createIcons(); // Re-render icons when view changes
};

const showModal = (
  title,
  message,
  icon = "info",
  buttons = [{ text: "OK", class: "bg-indigo-600" }]
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

  modalContent.innerHTML = `
        ${iconSvg}
        <h3 class="mt-3 text-lg leading-6 font-medium text-gray-900">${title}</h3>
        <div class="mt-2 text-sm text-gray-500">
            <p>${message}</p>
        </div>
        <div class="mt-4 flex justify-center space-x-3">
            ${buttons
              .map(
                (btn) =>
                  `<button id="modal-btn-${btn.text.toLowerCase()}" class="px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${
                    btn.class
                  } hover:opacity-90">${btn.text}</button>`
              )
              .join("")}
        </div>
    `;
  modalContainer.classList.remove("hidden");
  lucide.createIcons();

  buttons.forEach((btn) => {
    const btnEl = document.getElementById(
      `modal-btn-${btn.text.toLowerCase()}`
    );
    if (btnEl) {
      btnEl.onclick = () => {
        if (btn.action) btn.action();
        modalContainer.classList.add("hidden");
      };
    }
  });
};

// --- Authentication Logic ---
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
    showView("auth-view");
  }
  hideLoader();
});

// --- Firestore Logic ---
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
      const recipes = [];
      snapshot.forEach((doc) => {
        recipes.push({ id: doc.id, ...doc.data() });
      });
      renderRecipeList(recipes);
    },
    (error) => {
      console.error("Error fetching recipes: ", error);
      showModal("Erro", "Não foi possível carregar as receitas.", "error");
    }
  );
}

async function saveRecipe(recipeData) {
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
    console.error("Error saving recipe: ", error);
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
    await deleteDoc(docRef);
    hideLoader();
    showModal(
      "Receita Excluída",
      "A receita foi removida com sucesso.",
      "success"
    );
    showView("app-view");
  } catch (error) {
    hideLoader();
    console.error("Error deleting recipe: ", error);
    showModal("Erro", "Não foi possível excluir a receita.", "error");
  }
}

// --- Image Upload Logic ---
async function uploadImage(file) {
  if (!file) return null;
  showLoader();
  const storageRef = ref(
    storage,
    `images/${currentUser.uid}/${Date.now()}_${file.name}`
  );
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    hideLoader();
    return downloadURL;
  } catch (error) {
    hideLoader();
    console.error("Image upload failed:", error);
    showModal("Erro de Upload", "Não foi possível enviar a imagem.", "error");
    return null;
  }
}

// --- Rendering Logic ---
function renderRecipeList(recipes) {
  recipeListContainer.innerHTML = "";
  if (recipes.length === 0) {
    emptyState.classList.remove("hidden");
    addRecipeFab.classList.add("hidden");
  } else {
    emptyState.classList.add("hidden");
    addRecipeFab.classList.remove("hidden");
    recipes.sort(
      (a, b) =>
        (b.updatedAt || b.createdAt)?.toMillis() -
        (a.updatedAt || a.createdAt)?.toMillis()
    );

    recipes.forEach((recipe) => {
      const card = document.createElement("div");
      card.className =
        "bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-200";
      card.innerHTML = `
                <img src="${
                  recipe.photoUrl ||
                  "https://placehold.co/400x300/e2e8f0/cbd5e0?text=Receita"
                }" alt="Foto de ${
        recipe.name
      }" class="h-40 w-full object-cover">
                <div class="p-4">
                    <h3 class="font-semibold text-lg truncate">${
                      recipe.name
                    }</h3>
                    <div class="text-sm text-gray-500 mt-2 flex items-center space-x-4">
                        ${
                          recipe.prepTime
                            ? `<span><i data-lucide="clock" class="inline-block h-4 w-4 mr-1"></i>${recipe.prepTime}</span>`
                            : ""
                        }
                        ${
                          recipe.servings
                            ? `<span><i data-lucide="users" class="inline-block h-4 w-4 mr-1"></i>${recipe.servings}</span>`
                            : ""
                        }
                    </div>
                </div>
            `;
      card.addEventListener("click", () => renderRecipeDetail(recipe));
      recipeListContainer.appendChild(card);
    });
  }
  lucide.createIcons();
}

function renderRecipeDetail(recipe) {
  detailContent.innerHTML = `
        <div class="relative">
            <img src="${
              recipe.photoUrl ||
              "https://placehold.co/800x400/e2e8f0/cbd5e0?text=Receita"
            }" alt="${recipe.name}" class="w-full h-64 md:h-80 object-cover">
            <button id="back-from-detail" class="absolute top-4 left-4 bg-white bg-opacity-75 rounded-full p-2 text-gray-800 hover:bg-opacity-100">
                <i data-lucide="arrow-left" class="h-6 w-6"></i>
            </button>
            <div class="absolute top-4 right-4 flex space-x-2">
                 <button id="edit-recipe-btn-detail" class="bg-white bg-opacity-75 rounded-full p-2 text-gray-800 hover:bg-opacity-100">
                    <i data-lucide="edit" class="h-6 w-6"></i>
                </button>
                 <button id="delete-recipe-btn-detail" class="bg-white bg-opacity-75 rounded-full p-2 text-red-600 hover:bg-opacity-100">
                    <i data-lucide="trash-2" class="h-6 w-6"></i>
                </button>
            </div>
        </div>
        <div class="p-6 md:p-8">
            <h1 class="text-3xl md:text-4xl font-bold mb-4">${recipe.name}</h1>
            <div class="flex flex-wrap gap-x-6 gap-y-2 text-gray-600 border-b pb-4 mb-6">
                ${
                  recipe.prepTime
                    ? `<div class="flex items-center"><i data-lucide="timer" class="h-5 w-5 mr-2 text-indigo-500"></i>Preparo: <strong>${recipe.prepTime}</strong></div>`
                    : ""
                }
                ${
                  recipe.cookTime
                    ? `<div class="flex items-center"><i data-lucide="flame" class="h-5 w-5 mr-2 text-indigo-500"></i>Cozimento: <strong>${recipe.cookTime}</strong></div>`
                    : ""
                }
                ${
                  recipe.servings
                    ? `<div class="flex items-center"><i data-lucide="users" class="h-5 w-5 mr-2 text-indigo-500"></i>Rendimento: <strong>${recipe.servings}</strong></div>`
                    : ""
                }
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1">
                    <h2 class="text-2xl font-semibold mb-3">Ingredientes</h2>
                    <ul class="space-y-2">
                        ${recipe.ingredients
                          .map(
                            (ing) =>
                              `<li class="flex items-start"><span class="mr-2 mt-1 text-indigo-500">•</span><span>${ing}</span></li>`
                          )
                          .join("")}
                    </ul>
                </div>
                <div class="md:col-span-2">
                    <h2 class="text-2xl font-semibold mb-3">Modo de Preparo</h2>
                    <ol class="space-y-4">
                        ${recipe.steps
                          .map(
                            (step, index) =>
                              `<li class="flex items-start"><div class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white font-bold mr-4">${
                                index + 1
                              }</div><p class="pt-1">${step}</p></li>`
                          )
                          .join("")}
                    </ol>
                </div>
            </div>
        </div>
    `;
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
}

function addDynamicInput(container, placeholder) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center space-x-2";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.className =
    "block w-full border-gray-300 rounded-md shadow-sm sm:text-sm";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.innerHTML =
    '<i data-lucide="x-circle" class="h-5 w-5 text-gray-400 hover:text-red-500"></i>';
  removeBtn.onclick = () => wrapper.remove();
  wrapper.appendChild(input);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
  lucide.createIcons();
  input.focus();
}

function addDynamicInputWithValue(container, placeholder, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center space-x-2";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.value = value;
  input.className =
    "block w-full border-gray-300 rounded-md shadow-sm sm:text-sm";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.innerHTML =
    '<i data-lucide="x-circle" class="h-5 w-5 text-gray-400 hover:text-red-500"></i>';
  removeBtn.onclick = () => wrapper.remove();
  wrapper.appendChild(input);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
  lucide.createIcons();
}

// --- Form Logic ---
function resetForm() {
  recipeForm.reset();
  currentRecipeId = null;
  ingredientsContainer.innerHTML = "";
  stepsContainer.innerHTML = "";
  addDynamicInput(ingredientsContainer, "ex: 2 xícaras de farinha");
  addDynamicInput(stepsContainer, "ex: Misture os ingredientes secos");
  imagePreview.src = "https://placehold.co/400x300/e2e8f0/cbd5e0?text=Sua+Foto";
  photoUploadInput.value = "";
}

function showRecipeForm(recipeToEdit = null) {
  resetForm();
  if (recipeToEdit) {
    currentRecipeId = recipeToEdit.id;
    document.getElementById("form-title").textContent = "Editar Receita";
    document.getElementById("recipe-name").value = recipeToEdit.name || "";
    document.getElementById("prep-time").value = recipeToEdit.prepTime || "";
    document.getElementById("cook-time").value = recipeToEdit.cookTime || "";
    document.getElementById("servings").value = recipeToEdit.servings || "";
    imagePreview.src =
      recipeToEdit.photoUrl ||
      "https://placehold.co/400x300/e2e8f0/cbd5e0?text=Sua+Foto";
    ingredientsContainer.innerHTML = "";
    recipeToEdit.ingredients.forEach((ing) =>
      addDynamicInputWithValue(
        ingredientsContainer,
        "ex: 2 xícaras de farinha",
        ing
      )
    );
    stepsContainer.innerHTML = "";
    recipeToEdit.steps.forEach((step) =>
      addDynamicInputWithValue(
        stepsContainer,
        "ex: Misture os ingredientes secos",
        step
      )
    );
  } else {
    document.getElementById("form-title").textContent = "Nova Receita";
  }
  showView("recipe-form-view");
}

// --- Event Listeners and Initial Load ---
document.addEventListener("DOMContentLoaded", () => {
  // Auth form toggling
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

  // Recipe form submission
  recipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    let photoUrl = imagePreview.src;
    if (photoUploadInput.files[0]) {
      photoUrl = await uploadImage(photoUploadInput.files[0]);
      if (!photoUrl) return;
    }

    const recipeData = {
      name: document.getElementById("recipe-name").value,
      photoUrl:
        photoUrl && !photoUrl.startsWith("https://placehold.co")
          ? photoUrl
          : null,
      prepTime: document.getElementById("prep-time").value,
      cookTime: document.getElementById("cook-time").value,
      servings: document.getElementById("servings").value,
      ingredients: Array.from(ingredientsContainer.querySelectorAll("input"))
        .map((input) => input.value)
        .filter((val) => val.trim() !== ""),
      steps: Array.from(stepsContainer.querySelectorAll("input"))
        .map((input) => input.value)
        .filter((val) => val.trim() !== ""),
    };
    saveRecipe(recipeData);
  });

  // Other buttons
  [addRecipeFab, document.getElementById("add-recipe-btn-empty")].forEach(
    (btn) => {
      btn.addEventListener("click", () => showRecipeForm());
    }
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
    .getElementById("select-image-btn")
    .addEventListener("click", () => photoUploadInput.click());
  document
    .getElementById("back-to-list-btn")
    .addEventListener("click", () => showView("app-view"));
  document
    .getElementById("cancel-form-btn")
    .addEventListener("click", () => showView("app-view"));

  // Image preview handler
  photoUploadInput.addEventListener("change", () => {
    const file = photoUploadInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // PWA Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("Service worker registered.", reg))
        .catch((err) => console.log("Service worker not registered.", err));
    });
  }

  // Initial Load
  showLoader();
  resetForm();
  lucide.createIcons();
});

// Auth form submissions
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

document.getElementById("logout-btn").addEventListener("click", async () => {
  showLoader();
  try {
    await signOut(auth);
  } catch (error) {
    hideLoader();
    showModal("Erro ao Sair", error.message, "error");
  }
});
