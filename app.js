import { firebaseConfig, MASTER_EMAIL } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CHUNK_SIZE = 550000;

let currentUser = null;
let currentDocId = null;
let currentOwnerEmail = null;
let masterMode = false;

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const frame = document.getElementById("panelFrame");
const saveStatus = document.getElementById("saveStatus");

function setStatus(text){
  saveStatus.textContent = text || "";
}

function isMaster(user){
  return user && user.email === MASTER_EMAIL;
}

function showApp(user){
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  document.getElementById("userInfo").innerHTML = `<small>${user.email}</small>`;
}

function setActiveButton(docId){
  document.querySelectorAll(".player-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.docId === docId);
  });
}

async function loadPortrait(docId){
  const chunksRef = collection(db, "panels", docId, "portraitChunks");
  const snap = await getDocs(chunksRef);

  if(snap.empty) return null;

  const parts = [];
  snap.forEach(d => {
    parts[Number(d.id)] = d.data().data || "";
  });

  return parts.join("");
}

async function savePortrait(docId, dataUrl){
  const chunksRef = collection(db, "panels", docId, "portraitChunks");

  const oldChunks = await getDocs(chunksRef);
  for(const d of oldChunks.docs){
    await deleteDoc(doc(db, "panels", docId, "portraitChunks", d.id));
  }

  if(!dataUrl || !String(dataUrl).startsWith("data:image/")) return false;

  const total = Math.ceil(dataUrl.length / CHUNK_SIZE);

  for(let i = 0; i < total; i++){
    const chunk = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await setDoc(doc(db, "panels", docId, "portraitChunks", String(i).padStart(3, "0")), {
      data: chunk,
      updatedAt: new Date().toISOString()
    });
  }

  return true;
}

async function openPanel(docId, ownerEmail){
  currentDocId = docId;
  currentOwnerEmail = ownerEmail || currentUser.email;
  setActiveButton(docId);
  setStatus("Carregando...");

  const ref = doc(db, "panels", docId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  const payload = data.panelData || {};
  const portrait = await loadPortrait(docId);
  if(portrait) payload.portrait = portrait;

  frame.contentWindow.postMessage({ type: "TFD_LOAD_PANEL", payload }, "*");
  setStatus("Painel carregado");
}

async function openOwnPanel(){
  currentDocId = currentUser.uid;
  currentOwnerEmail = currentUser.email;

  const ref = doc(db, "panels", currentUser.uid);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    await setDoc(ref, {
      ownerEmail: currentUser.email,
      ownerUid: currentUser.uid,
      name: currentUser.email,
      panelData: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  await openPanel(currentUser.uid, currentUser.email);
}

async function loadMasterPanel(){
  const block = document.getElementById("masterBlock");
  const list = document.getElementById("playerList");
  const btn = document.getElementById("masterBtn");

  block.classList.remove("hidden");
  btn.classList.remove("hidden");
  list.innerHTML = "";

  const snap = await getDocs(collection(db, "panels"));

  if(snap.empty){
    list.innerHTML = "<small>Nenhum painel salvo ainda.</small>";
    return;
  }

  snap.forEach(d => {
    const data = d.data();
    const button = document.createElement("button");
    button.className = "player-btn";
    button.dataset.docId = d.id;
    button.textContent = data.name || data.ownerEmail || d.id;
    button.onclick = () => openPanel(d.id, data.ownerEmail);
    list.appendChild(button);
  });
}

async function requestSave(){
  if(!currentDocId){
    alert("Nenhum painel selecionado.");
    return;
  }

  setStatus("Preparando...");
  frame.contentWindow.postMessage({ type: "TFD_REQUEST_EXPORT" }, "*");
}

window.addEventListener("message", async (event) => {
  if(event.data?.type !== "TFD_PANEL_EXPORT") return;

  try{
    setStatus("Salvando...");
    const panelData = event.data.payload || {};
    const portrait = panelData.portrait || null;
    delete panelData.portrait;

    const hasPortrait = await savePortrait(currentDocId, portrait);

    await setDoc(doc(db, "panels", currentDocId), {
      ownerEmail: currentOwnerEmail || currentUser.email,
      ownerUid: currentDocId,
      name: panelData.nameInput || currentOwnerEmail || "Sem Nome",
      panelData,
      hasPortrait,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    setStatus("Salvo online");
    alert("Painel salvo online.");

    if(masterMode) await loadMasterPanel();
  }catch(e){
    console.error(e);
    setStatus("Erro ao salvar");
    alert("Não foi possível salvar. Verifique as regras do Firestore.");
  }
});

document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");

  msg.textContent = "Verificando credenciais...";

  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch(e){
    console.error(e);
    msg.textContent = "E-mail ou senha inválidos.";
  }
};

document.getElementById("saveBtn").onclick = requestSave;
document.getElementById("reloadBtn").onclick = () => currentDocId ? openPanel(currentDocId, currentOwnerEmail) : openOwnPanel();
document.getElementById("logoutBtn").onclick = () => signOut(auth);
document.getElementById("masterBtn").onclick = async () => {
  await loadMasterPanel();
};

onAuthStateChanged(auth, async (user) => {
  if(!user){
    currentUser = null;
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    return;
  }

  currentUser = user;
  masterMode = isMaster(user);
  showApp(user);

  if(masterMode){
    document.getElementById("masterBtn").classList.remove("hidden");
    document.getElementById("masterBlock").classList.remove("hidden");
    await openOwnPanel();
    await loadMasterPanel();
  }else{
    document.getElementById("masterBtn").classList.add("hidden");
    document.getElementById("masterBlock").classList.add("hidden");
    await openOwnPanel();
  }
});
