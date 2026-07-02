import { useState, useEffect, useMemo } from "react";
import {
  Home, Package, BookOpen, Settings as SettingsIcon, Plus, Camera, X,
  Trash2, Pencil, Sparkles, AlertTriangle, Check, Loader2,
  Upload, Search, UtensilsCrossed, RotateCcw, Users, Globe, Eye
} from "lucide-react";

/* ----------------------------- constantes ----------------------------- */

const CATEGORIES = [
  { id: "proteina_animal", label: "Proteína animal", emoji: "🥩", color: "#C1442B" },
  { id: "proteina_vegetal", label: "Proteína vegetal", emoji: "🌱", color: "#6F8F5C" },
  { id: "verdura", label: "Verdura", emoji: "🥬", color: "#4F6B4B" },
  { id: "fruta", label: "Fruta", emoji: "🍎", color: "#E3A857" },
  { id: "cereal", label: "Cereal / Carbohidrato", emoji: "🌽", color: "#2F4858" },
  { id: "lacteo", label: "Lácteo", emoji: "🥛", color: "#B89B6B" },
  { id: "grasa", label: "Grasa / Aceite", emoji: "🫒", color: "#A6763A" },
  { id: "condimento", label: "Condimento / Especia", emoji: "🌶️", color: "#8A6E4B" },
  { id: "enlatado", label: "Enlatado / Conserva", emoji: "🥫", color: "#5C7A8A" },
  { id: "bebida", label: "Bebida", emoji: "🥤", color: "#3E7CB1" },
  { id: "otro", label: "Otro", emoji: "📦", color: "#9A8E7D" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const UNIDADES = ["g", "ml", "pz", "lata", "paquete", "porción", "taza", "cda", "cdta"];
const UNIDAD_LABEL = { g: "g", ml: "ml", pz: "pieza", lata: "lata", paquete: "paquete", porción: "porción", taza: "taza", cda: "cucharada", cdta: "cucharadita" };

const CUISINE_LABEL = { versatil: "Versátil (cualquiera)", mexicana: "Mexicana", internacional: "Internacional" };
const GOAL_LABEL = { bajar: "Perder peso", mantener: "Mantener peso", subir: "Ganar músculo / masa" };

const DEFAULT_SETTINGS = {
  mode: "monitoreo",
  goalType: "mantener",
  targetCalories: 2200,
  targetProtein: 140,
  targetCarbs: 230,
  targetFat: 70,
  cuisine: "versatil",
};

const DEFAULT_COMMUNITY_PROFILE = { username: "", sharePantry: false, shareMeals: false };
const AVATAR_COLORS = ["#C1442B", "#4F6B4B", "#2F4858", "#E3A857", "#6F8F5C", "#5C7A8A"];

/* ------------------------------- helpers ------------------------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function macroBase(unit) {
  return unit === "g" || unit === "ml" ? 100 : 1;
}
function macroBaseLabel(unit) {
  return unit === "g" ? "100 g" : unit === "ml" ? "100 ml" : `1 ${UNIDAD_LABEL[unit] || unit}`;
}
function round1(n) {
  return Math.round((n || 0) * 10) / 10;
}
function normalizeName(s) {
  return (s || "").trim().toLowerCase();
}
function fmtDateEs(iso) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  } catch (e) {
    return iso;
  }
}
function relTime(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return "Buenos días";
  if (h < 13) return "Buen mediodía";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function getMealContext() {
  const h = new Date().getHours();
  if (h < 11) return "desayuno";
  if (h < 13) return "antes de la comida (almuerzo ligero)";
  if (h < 17) return "comida (mediodía)";
  if (h < 21) return "cena";
  return "colación nocturna";
}
function avatarColor(name) {
  let sum = 0;
  for (let i = 0; i < (name || "").length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function Avatar({ name, size = 32 }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, background: avatarColor(name), fontSize: Math.round(size * 0.45) }}>
      {initial}
    </span>
  );
}

/* --------------------------- almacenamiento ----------------------------- */
/* Datos personales: localStorage (solo en este navegador/dispositivo).     */
/* Datos de comunidad: tu propia API serverless (ver /api/community.js).    */

function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("storage error", key, e);
    return false;
  }
}

async function fetchCommunityFeed() {
  try {
    const res = await fetch("/api/community?action=feed");
    const data = await res.json();
    return { posts: data.posts || [], configured: data.configured !== false };
  } catch (e) {
    return { posts: [], configured: false };
  }
}
async function fetchCommunityUsers() {
  try {
    const res = await fetch("/api/community?action=users");
    const data = await res.json();
    return { users: data.users || [], configured: data.configured !== false };
  } catch (e) {
    return { users: [], configured: false };
  }
}
async function fetchPublicPantry(username) {
  try {
    const res = await fetch(`/api/community?action=pantry&username=${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    return [];
  }
}
async function postCommunityFeed(post) {
  try {
    await fetch("/api/community?action=post", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(post),
    });
  } catch (e) {
    /* publicar es best-effort: si falla, no interrumpimos el registro local */
  }
}
async function postPublicPantry(username, items) {
  try {
    await fetch("/api/community?action=pantry", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, items }),
    });
  } catch (e) {
    /* best-effort */
  }
}
async function postUpsertUser(profile) {
  try {
    await fetch("/api/community?action=upsert-user", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
    });
  } catch (e) {
    /* best-effort */
  }
}

async function callClaudeAPI(content, maxTokens = 1500) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo conectar con el analizador");
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");
}

function safeParseJSON(text) {
  let clean = (text || "").trim();
  clean = clean.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const idxs = [clean.indexOf("{"), clean.indexOf("[")].filter((i) => i >= 0);
    const start = idxs.length ? Math.min(...idxs) : -1;
    const end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw e;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* --------------------------- estimación con IA -------------------------- */

async function estimateMacrosForItem(name, unit) {
  const baseTxt = macroBaseLabel(unit || "g");
  const prompt = `Eres experto en nutrición y en productos de supermercados mexicanos (Walmart, Chedraui, Soriana).
Para el producto "${name}", da una estimación nutricional razonable POR ${baseTxt}.
Responde SOLO con un objeto JSON, sin texto adicional ni markdown, con este formato exacto:
{"category":"una de: proteina_animal,proteina_vegetal,verdura,fruta,cereal,lacteo,grasa,condimento,enlatado,bebida,otro","unit":"una de: g,ml,pz,lata,paquete,porción,taza,cda,cdta","calories":numero,"protein":numero,"carbs":numero,"fat":numero}
El campo "unit" debe ser la unidad más natural para medir ese producto. Los valores de calories/protein/carbs/fat deben corresponder a esa unidad (100 si es g o ml, 1 si es pieza/lata/paquete/porción/taza/cda/cdta).`;
  const text = await callClaudeAPI([{ type: "text", text: prompt }], 400);
  return safeParseJSON(text);
}

async function parseReceiptImage(base64, mediaType) {
  const prompt = `Esta imagen es un ticket de compra de un supermercado mexicano (Walmart, Chedraui u otro similar).
Extrae SOLO los productos alimenticios o comestibles comprados (ignora bolsas, servicio, descuentos, subtotal, total, impuestos, métodos de pago).
Interpreta el nombre abreviado del ticket y conviértelo en un nombre claro en español (ej. "PLAT PECH POLLO" -> "Pechuga de pollo"). Si la cantidad no es clara, asume 1.
Da una estimación nutricional razonable por 100g/100ml (si es un producto que se mide por peso/volumen) o por 1 pieza/lata/paquete/porción (si es un producto discreto), y su categoría.

Responde SOLO con un arreglo JSON, sin texto adicional ni markdown, con este formato exacto:
[{"name":"nombre claro","quantity":numero,"unit":"g|ml|pz|lata|paquete|porción|taza|cda|cdta","category":"proteina_animal|proteina_vegetal|verdura|fruta|cereal|lacteo|grasa|condimento|enlatado|bebida|otro","calories":numero,"protein":numero,"carbs":numero,"fat":numero}]

Si la imagen no es legible o no parece un ticket de compra, responde exactamente: {"error":"no_legible"}`;
  const text = await callClaudeAPI(
    [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: prompt },
    ],
    2500
  );
  return safeParseJSON(text);
}

async function fetchRecommendations({ pantry, settings, todayTotals }) {
  const pantryListText = pantry
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const base = macroBase(p.unit);
      return `- ${p.name}: ${round1(p.quantity)} ${UNIDAD_LABEL[p.unit] || p.unit} (por ${base === 100 ? "100" + p.unit : "1 " + (UNIDAD_LABEL[p.unit] || p.unit)}: ${round1(p.calories)} kcal, ${round1(p.protein)}g prot, ${round1(p.carbs)}g carb, ${round1(p.fat)}g grasa)${p.expirationDate ? " — caduca " + p.expirationDate : ""}`;
    })
    .join("\n");

  const goalLine =
    settings.mode === "objetivo"
      ? `- Objetivo: ${GOAL_LABEL[settings.goalType]}\n- Metas diarias: ${settings.targetCalories} kcal, ${settings.targetProtein}g proteína, ${settings.targetCarbs}g carbohidratos, ${settings.targetFat}g grasa`
      : "- Modo: solo monitoreo, sin meta de peso (el usuario quiere comer balanceado y variado, sin presión numérica estricta)";

  const prompt = `Eres un asistente nutricional. Recomienda comidas usando PRINCIPALMENTE ingredientes que el usuario ya tiene en su alacena (puedes asumir que también tiene sal, aceite, agua y especias básicas aunque no estén listadas).

Alacena disponible:
${pantryListText || "(la alacena está vacía o casi vacía, recomienda comidas simples y de despensa básica mexicana)"}

Contexto:
${goalLine}
- Consumido hoy hasta ahora: ${round1(todayTotals.calories)} kcal, ${round1(todayTotals.protein)}g prot, ${round1(todayTotals.carbs)}g carb, ${round1(todayTotals.fat)}g grasa
- Preferencia de cocina: ${CUISINE_LABEL[settings.cuisine]}
- Momento del día: ${getMealContext()}

Da 3 opciones de comida distintas entre sí, priorizando usar lo que está próximo a caducar. Sé realista con cantidades de alacena disponibles.

Responde SOLO con un JSON, sin texto adicional ni markdown, con este formato exacto:
{"meals":[{"title":"...","description":"1-2 líneas","ingredientsUsed":[{"name":"...","quantity":numero,"unit":"g|ml|pz|lata|paquete|porción|taza|cda|cdta"}],"calories":numero,"protein":numero,"carbs":numero,"fat":numero,"instructions":"pasos breves en 2-4 líneas"}]}`;

  const text = await callClaudeAPI([{ type: "text", text: prompt }], 1800);
  const data = safeParseJSON(text);
  return data.meals || [];
}

/* ------------------------------ componentes ----------------------------- */

function MacroWheel({ protein = 0, carbs = 0, fat = 0, size = 168 }) {
  const r = 64;
  const circumference = 2 * Math.PI * r;
  const kp = protein * 4, kc = carbs * 4, kf = fat * 9;
  const total = kp + kc + kf;
  const segs = total > 0
    ? [{ v: kp, c: "var(--verde)" }, { v: kc, c: "var(--maiz)" }, { v: kf, c: "var(--rojo)" }]
    : [{ v: 1, c: "var(--line)" }];
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
      {segs.map((s, i) => {
        const frac = s.v / (total > 0 ? total : 1);
        const len = frac * circumference;
        const dasharray = `${len} ${circumference - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle
            key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth="16"
            strokeDasharray={dasharray} strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .4s ease" }}
          />
        );
      })}
      <text x="50%" y="46%" textAnchor="middle" className="wheel-kcal">{Math.round(total)}</text>
      <text x="50%" y="61%" textAnchor="middle" className="wheel-kcal-label">kcal hoy</text>
    </svg>
  );
}

function ProgressBar({ label, value, target, color }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="progress-row">
      <div className="progress-label-row">
        <span>{label}</span>
        <span className="mono">{Math.round(value)}{target ? ` / ${target}` : ""} g</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: pct + "%", background: color }} /></div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ text, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal modal-confirm" onMouseDown={(e) => e.stopPropagation()}>
        <p className="confirm-text">{text}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className={"btn " + (danger ? "btn-danger" : "btn-primary")} onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- formulario alta item ------------------------ */

function ItemForm({ initial, onSave, onCancel, saveLabel }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "otro");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unit, setUnit] = useState(initial?.unit || "pz");
  const [calories, setCalories] = useState(initial?.calories ?? 0);
  const [protein, setProtein] = useState(initial?.protein ?? 0);
  const [carbs, setCarbs] = useState(initial?.carbs ?? 0);
  const [fat, setFat] = useState(initial?.fat ?? 0);
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate || "");
  const [estimating, setEstimating] = useState(false);
  const [estError, setEstError] = useState("");

  async function handleEstimate() {
    if (!name.trim()) { setEstError("Escribe primero el nombre del producto."); return; }
    setEstimating(true); setEstError("");
    try {
      const est = await estimateMacrosForItem(name, unit);
      if (est.category && CAT_MAP[est.category]) setCategory(est.category);
      if (est.unit && UNIDADES.includes(est.unit)) setUnit(est.unit);
      setCalories(round1(est.calories)); setProtein(round1(est.protein));
      setCarbs(round1(est.carbs)); setFat(round1(est.fat));
    } catch (e) {
      setEstError("No se pudo estimar. Captura los valores manualmente.");
    } finally {
      setEstimating(false);
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), category, quantity: Number(quantity) || 0, unit,
      calories: Number(calories) || 0, protein: Number(protein) || 0,
      carbs: Number(carbs) || 0, fat: Number(fat) || 0,
      expirationDate: expirationDate || null,
    });
  }

  return (
    <div className="form-stack">
      <label className="field">
        <span className="label">Producto</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pechuga de pollo" />
      </label>

      <div className="field-row">
        <label className="field" style={{ flex: 1 }}>
          <span className="label">Cantidad</span>
          <input className="input" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="label">Unidad</span>
          <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIDADES.map((u) => <option key={u} value={u}>{UNIDAD_LABEL[u]}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="label">Categoría</span>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </label>

      <div className="ai-row">
        <button type="button" className="btn btn-ai" onClick={handleEstimate} disabled={estimating}>
          {estimating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {estimating ? "Estimando..." : "Estimar nutrición con IA"}
        </button>
        {estError && <span className="error-text">{estError}</span>}
      </div>

      <p className="hint-text">Valores nutricionales por {macroBaseLabel(unit)}:</p>
      <div className="field-row">
        <label className="field"><span className="label">Kcal</span><input className="input mono" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
        <label className="field"><span className="label">Prot (g)</span><input className="input mono" type="number" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span className="label">Carbs (g)</span><input className="input mono" type="number" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
        <label className="field"><span className="label">Grasa (g)</span><input className="input mono" type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
      </div>

      <label className="field">
        <span className="label">Caduca (opcional)</span>
        <input className="input" type="date" value={expirationDate || ""} onChange={(e) => setExpirationDate(e.target.value)} />
      </label>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!name.trim()}>{saveLabel || "Guardar"}</button>
      </div>
    </div>
  );
}

/* ------------------------------- flujo ticket ---------------------------- */

function ReceiptFlow({ onConfirm, onCancel }) {
  const [step, setStep] = useState("upload");
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState([]);
  const [errMsg, setErrMsg] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStep("loading");
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const result = await parseReceiptImage(base64, mediaType);
      if (result && result.error === "no_legible") {
        setErrMsg("No pude leer el ticket con claridad. Intenta con otra foto, con mejor luz y enfoque.");
        setStep("error");
        return;
      }
      const arr = Array.isArray(result) ? result : [];
      setItems(
        arr.map((it) => ({
          id: uid(), include: true,
          name: it.name || "Producto", quantity: Number(it.quantity) || 1,
          unit: UNIDADES.includes(it.unit) ? it.unit : "pz",
          category: CAT_MAP[it.category] ? it.category : "otro",
          calories: round1(it.calories), protein: round1(it.protein),
          carbs: round1(it.carbs), fat: round1(it.fat),
        }))
      );
      setStep("review");
    } catch (err) {
      setErrMsg("No se pudo analizar el ticket. Revisa tu conexión e intenta de nuevo.");
      setStep("error");
    }
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  if (step === "upload") {
    return (
      <div className="form-stack">
        <p className="hint-text">Sube una foto clara del ticket de Walmart, Chedraui u otro súper. La IA leerá los productos y estimará su información nutricional.</p>
        <label className="upload-zone">
          <Upload size={26} />
          <span>Tomar foto o subir imagen del ticket</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="form-stack center-stack">
        {preview && <img src={preview} alt="ticket" className="receipt-preview" />}
        <div className="loading-row"><Loader2 size={18} className="spin" /> Leyendo ticket y estimando nutrición...</div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="form-stack">
        <div className="error-banner"><AlertTriangle size={16} /> {errMsg}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => setStep("upload")}>Intentar de nuevo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-stack">
      <p className="hint-text">Revisa lo que detectamos. Puedes editar, quitar artículos o desmarcarlos antes de agregarlos.</p>
      {items.length === 0 && <p className="empty-inline">No se detectaron productos. Cancela e intenta con otra foto.</p>}
      <div className="receipt-list">
        {items.map((it) => (
          <div className={"receipt-row" + (it.include ? "" : " receipt-row-off")} key={it.id}>
            <input type="checkbox" checked={it.include} onChange={(e) => updateItem(it.id, { include: e.target.checked })} />
            <div className="receipt-row-fields">
              <input className="input input-sm" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
              <div className="field-row">
                <input className="input input-sm mono" type="number" min="0" step="any" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                <select className="select input-sm" value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{UNIDAD_LABEL[u]}</option>)}
                </select>
                <select className="select input-sm" value={it.category} onChange={(e) => updateItem(it.id, { category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji}</option>)}
                </select>
              </div>
              <p className="micro-text mono">{round1(it.calories)} kcal · {round1(it.protein)}p · {round1(it.carbs)}c · {round1(it.fat)}g por {macroBaseLabel(it.unit)}</p>
            </div>
            <button className="icon-btn" onClick={() => removeItem(it.id)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onConfirm(items.filter((i) => i.include))} disabled={!items.some((i) => i.include)}>
          Agregar a la alacena
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- vistas -------------------------------- */

function DashboardView({ pantry, settings, todayTotals, recState, onGetRecs, onLogMeal, onOpenAdd, onOpenReceipt, onOpenFreeLog }) {
  const expiring = pantry.filter((p) => {
    if (!p.expirationDate) return false;
    const days = (new Date(p.expirationDate) - new Date()) / 86400000;
    return days <= 3;
  });
  const lowStock = pantry.filter((p) => p.quantity > 0 && p.quantity <= (macroBase(p.unit) === 100 ? 100 : 1));

  return (
    <div className="view-stack">
      <div className="card hero-card">
        <MacroWheel protein={todayTotals.protein} carbs={todayTotals.carbs} fat={todayTotals.fat} />
        <div className="hero-legend">
          {settings.mode === "objetivo" ? (
            <>
              <ProgressBar label="🌱 Proteína" value={todayTotals.protein} target={settings.targetProtein} color="var(--verde)" />
              <ProgressBar label="🌽 Carbohidratos" value={todayTotals.carbs} target={settings.targetCarbs} color="var(--maiz)" />
              <ProgressBar label="🫒 Grasa" value={todayTotals.fat} target={settings.targetFat} color="var(--rojo)" />
            </>
          ) : (
            <>
              <div className="legend-row"><span className="dot" style={{ background: "var(--verde)" }} /> Proteína <span className="mono">{round1(todayTotals.protein)} g</span></div>
              <div className="legend-row"><span className="dot" style={{ background: "var(--maiz)" }} /> Carbohidratos <span className="mono">{round1(todayTotals.carbs)} g</span></div>
              <div className="legend-row"><span className="dot" style={{ background: "var(--rojo)" }} /> Grasa <span className="mono">{round1(todayTotals.fat)} g</span></div>
            </>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={onOpenAdd}><Plus size={16} /> Agregar</button>
        <button className="btn btn-secondary" onClick={onOpenReceipt}><Camera size={16} /> Escanear ticket</button>
        <button className="btn btn-secondary" onClick={onOpenFreeLog}><UtensilsCrossed size={16} /> Registrar comida</button>
      </div>

      <div className="card rec-card">
        <div className="rec-header">
          <h3>¿Qué hay para comer?</h3>
          <button className="btn btn-primary btn-sm" onClick={onGetRecs} disabled={recState.loading}>
            {recState.loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {recState.loading ? "Pensando..." : recState.meals ? "Otras opciones" : "Recomendarme"}
          </button>
        </div>
        {pantry.length === 0 && !recState.meals && <p className="hint-text">Tu alacena está vacía — aun así puedo sugerirte algo básico, o agrega productos primero para mejores ideas.</p>}
        {recState.error && <div className="error-banner"><AlertTriangle size={15} /> {recState.error}</div>}
        {recState.meals && (
          <div className="meal-list">
            {recState.meals.map((m, i) => (
              <div className="meal-item" key={i}>
                <div className="meal-item-head">
                  <h4>{m.title}</h4>
                  <span className="mono meal-kcal">{Math.round(m.calories)} kcal</span>
                </div>
                <p className="meal-desc">{m.description}</p>
                <p className="micro-text mono">P {round1(m.protein)}g · C {round1(m.carbs)}g · G {round1(m.fat)}g</p>
                {m.instructions && <p className="meal-instructions">{m.instructions}</p>}
                <button className="btn btn-ghost btn-sm" onClick={() => onLogMeal(m)}><Check size={14} /> Lo comí</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(expiring.length > 0 || lowStock.length > 0) && (
        <div className="card alert-card">
          {expiring.length > 0 && (
            <div className="alert-block">
              <p className="alert-title"><AlertTriangle size={14} /> Caduca pronto</p>
              <div className="chip-row">{expiring.map((p) => <span className="chip chip-warn" key={p.id}>{p.name}</span>)}</div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="alert-block">
              <p className="alert-title">Se está acabando</p>
              <div className="chip-row">{lowStock.map((p) => <span className="chip" key={p.id}>{p.name}</span>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PantryGrid({ items, onEdit, onDelete }) {
  return (
    <div className="pantry-grid">
      {items.map((p) => {
        const cat = CAT_MAP[p.category] || CAT_MAP.otro;
        return (
          <div className="pantry-card" key={p.id} style={{ "--cat-color": cat.color }}>
            <div className="pantry-card-top">
              <span className="pantry-card-icon">{cat.emoji}</span>
              {(onEdit || onDelete) && (
                <div className="pantry-card-actions">
                  {onEdit && <button className="icon-btn icon-btn-sm" onClick={() => onEdit(p)}><Pencil size={13} /></button>}
                  {onDelete && <button className="icon-btn icon-btn-sm" onClick={() => onDelete(p)}><Trash2 size={13} /></button>}
                </div>
              )}
            </div>
            <p className="pantry-card-name">{p.name}</p>
            <p className="pantry-card-qty mono">{round1(p.quantity)} {UNIDAD_LABEL[p.unit]}</p>
            <p className="micro-text mono">{round1(p.calories)} kcal/{macroBaseLabel(p.unit)}</p>
            {p.expirationDate && <p className="micro-text">Caduca {fmtDateEs(p.expirationDate)}</p>}
          </div>
        );
      })}
    </div>
  );
}

function PantryView({ pantry, onAdd, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("todas");

  const filtered = pantry.filter((p) => {
    const matchesQuery = normalizeName(p.name).includes(normalizeName(query));
    const matchesCat = filterCat === "todas" || p.category === filterCat;
    return matchesQuery && matchesCat;
  });
  const grouped = CATEGORIES.map((c) => ({ cat: c, items: filtered.filter((p) => p.category === c.id) })).filter((g) => g.items.length > 0);

  return (
    <div className="view-stack">
      <div className="search-row">
        <div className="search-input">
          <Search size={15} />
          <input className="input input-plain" placeholder="Buscar producto..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>

      <button className="btn btn-primary full-width" onClick={onAdd}><Plus size={16} /> Agregar producto</button>

      {pantry.length === 0 ? (
        <div className="empty-state">
          <Package size={28} />
          <p>Tu alacena está vacía.</p>
          <p className="hint-text">Agrégala manualmente o escanea un ticket desde la pestaña Hoy.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty-inline">No hay productos que coincidan con tu búsqueda.</p>
      ) : (
        grouped.map(({ cat, items }) => (
          <div key={cat.id} className="pantry-group">
            <p className="group-title">{cat.emoji} {cat.label}</p>
            <PantryGrid items={items} onEdit={onEdit} onDelete={onDelete} />
          </div>
        ))
      )}
    </div>
  );
}

function DiaryView({ log }) {
  const byDate = useMemo(() => {
    const map = {};
    log.forEach((entry) => {
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push(entry);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [log]);

  if (log.length === 0) {
    return (
      <div className="empty-state">
        <BookOpen size={28} />
        <p>Aún no has registrado comidas.</p>
        <p className="hint-text">Cuando registres algo desde "Hoy", aparecerá tu historial aquí.</p>
      </div>
    );
  }

  return (
    <div className="view-stack">
      {byDate.map(([date, entries]) => {
        const totals = entries.reduce((acc, e) => ({
          calories: acc.calories + e.calories, protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        return (
          <div className="card" key={date}>
            <div className="diary-date-row">
              <p className="group-title">{date === todayISO() ? "Hoy" : fmtDateEs(date)}</p>
              <span className="mono micro-text">{Math.round(totals.calories)} kcal</span>
            </div>
            {entries.map((e) => (
              <div className="diary-entry" key={e.id}>
                <p className="pantry-name">{e.label}</p>
                <p className="micro-text mono">{Math.round(e.calories)} kcal · P {round1(e.protein)}g · C {round1(e.carbs)}g · G {round1(e.fat)}g</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SettingsView({ settings, onSave, onReset }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);

  function set(k, v) { setLocal((prev) => ({ ...prev, [k]: v })); }
  function save() { onSave(local); }

  return (
    <div className="view-stack">
      <div className="card">
        <p className="group-title">Modo de seguimiento</p>
        <div className="seg-control">
          <button className={"seg-btn" + (local.mode === "monitoreo" ? " active" : "")} onClick={() => set("mode", "monitoreo")}>Solo monitoreo</button>
          <button className={"seg-btn" + (local.mode === "objetivo" ? " active" : "")} onClick={() => set("mode", "objetivo")}>Con objetivo</button>
        </div>
        <p className="hint-text">{local.mode === "monitoreo" ? "Verás tus macros del día sin metas — ideal si solo quieres conocer lo que comes." : "Define metas diarias y verás tu progreso contra ellas."}</p>

        {local.mode === "objetivo" && (
          <>
            <label className="field">
              <span className="label">Objetivo</span>
              <select className="select" value={local.goalType} onChange={(e) => set("goalType", e.target.value)}>
                {Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="field-row">
              <label className="field"><span className="label">Kcal/día</span><input className="input mono" type="number" value={local.targetCalories} onChange={(e) => set("targetCalories", Number(e.target.value))} /></label>
              <label className="field"><span className="label">Proteína (g)</span><input className="input mono" type="number" value={local.targetProtein} onChange={(e) => set("targetProtein", Number(e.target.value))} /></label>
            </div>
            <div className="field-row">
              <label className="field"><span className="label">Carbs (g)</span><input className="input mono" type="number" value={local.targetCarbs} onChange={(e) => set("targetCarbs", Number(e.target.value))} /></label>
              <label className="field"><span className="label">Grasa (g)</span><input className="input mono" type="number" value={local.targetFat} onChange={(e) => set("targetFat", Number(e.target.value))} /></label>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <p className="group-title">Preferencia de cocina</p>
        <select className="select" value={local.cuisine} onChange={(e) => set("cuisine", e.target.value)}>
          {Object.entries(CUISINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <button className="btn btn-primary full-width" onClick={save}><Check size={16} /> Guardar ajustes</button>

      <button className="btn btn-ghost full-width btn-danger-text" onClick={onReset}><RotateCcw size={15} /> Borrar todos mis datos</button>
    </div>
  );
}

function CommunityView({ profile, onSaveProfile, feed, feedLoading, onRefreshFeed, users, usersLoading, onViewUser, currentUsername, configured }) {
  const [editing, setEditing] = useState(!profile.username);
  const [form, setForm] = useState(profile);
  useEffect(() => { setForm(profile); setEditing(!profile.username); }, [profile.username]);

  const otherPublicUsers = users.filter((u) => u.sharePantry && u.username !== currentUsername);

  return (
    <div className="view-stack">
      {!configured && (
        <div className="notice-banner">
          <Globe size={15} /> La comunidad aún no está configurada en este servidor (faltan credenciales de Upstash). Revisa el README para activarla — mientras tanto, el resto de la app funciona normal.
        </div>
      )}

      <div className="card">
        <p className="group-title"><Users size={14} style={{ verticalAlign: "-2px" }} /> Tu perfil de comunidad</p>
        {!editing ? (
          <div className="profile-summary">
            <Avatar name={profile.username} size={38} />
            <div style={{ flex: 1 }}>
              <p className="pantry-name">@{profile.username}</p>
              <p className="micro-text">
                {profile.sharePantry ? "Alacena pública" : "Alacena privada"} · {profile.shareMeals ? "comidas públicas" : "comidas privadas"}
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Editar</button>
          </div>
        ) : (
          <div className="form-stack">
            <div className="notice-banner"><Globe size={15} /> Lo que actives aquí será visible para cualquier persona que use esta app, no solo tus contactos.</div>
            <label className="field">
              <span className="label">Tu nombre de usuario</span>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, "_").toLowerCase() })} placeholder="ej. ana_mid" />
            </label>
            <label className="toggle-row">
              <span>Compartir mi alacena (otros podrán verla)</span>
              <input type="checkbox" checked={form.sharePantry} onChange={(e) => setForm({ ...form, sharePantry: e.target.checked })} />
            </label>
            <label className="toggle-row">
              <span>Compartir lo que como en el feed</span>
              <input type="checkbox" checked={form.shareMeals} onChange={(e) => setForm({ ...form, shareMeals: e.target.checked })} />
            </label>
            <div className="modal-actions">
              {profile.username && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>}
              <button className="btn btn-primary" disabled={!form.username.trim()} onClick={() => { onSaveProfile(form); setEditing(false); }}>Guardar</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="rec-header">
          <p className="group-title" style={{ margin: 0 }}>Feed de la comunidad</p>
          <button className="icon-btn" onClick={onRefreshFeed} aria-label="Actualizar"><RotateCcw size={15} /></button>
        </div>
        {feedLoading ? (
          <div className="loading-row"><Loader2 size={15} className="spin" /> Cargando feed...</div>
        ) : feed.length === 0 ? (
          <p className="empty-inline">Nadie ha publicado todavía. ¡Sé el primero!</p>
        ) : (
          <div className="feed-list">
            {feed.map((post, i) => (
              <div className="feed-post" key={i}>
                <div className="feed-post-head">
                  <Avatar name={post.username} size={26} />
                  <span style={{ fontWeight: 700 }}>@{post.username}</span>
                  <span className="micro-text" style={{ marginLeft: "auto" }}>{relTime(post.ts)}</span>
                </div>
                <p className="feed-post-label">{post.label}</p>
                <p className="micro-text mono">{Math.round(post.calories)} kcal · P {round1(post.protein)}g · C {round1(post.carbs)}g · G {round1(post.fat)}g</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <p className="group-title">Explorar alacenas públicas</p>
        {usersLoading ? (
          <div className="loading-row"><Loader2 size={15} className="spin" /> Buscando usuarios...</div>
        ) : otherPublicUsers.length === 0 ? (
          <p className="empty-inline">Aún no hay alacenas públicas de otras personas.</p>
        ) : (
          <div className="user-list">
            {otherPublicUsers.map((u) => (
              <button className="user-row" key={u.username} onClick={() => onViewUser(u.username)}>
                <Avatar name={u.username} size={28} />
                <span>@{u.username}</span>
                <Eye size={14} style={{ marginLeft: "auto" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublicPantryModal({ username, items, loading, onClose }) {
  const grouped = CATEGORIES.map((c) => ({ cat: c, items: (items || []).filter((p) => p.category === c.id) })).filter((g) => g.items.length > 0);
  return (
    <Modal title={`Alacena de @${username}`} onClose={onClose} wide>
      {loading ? (
        <div className="loading-row"><Loader2 size={16} className="spin" /> Cargando...</div>
      ) : (items || []).length === 0 ? (
        <p className="empty-inline">Este usuario no tiene productos públicos por ahora.</p>
      ) : (
        <div className="view-stack">
          {grouped.map(({ cat, items }) => (
            <div key={cat.id} className="pantry-group">
              <p className="group-title">{cat.emoji} {cat.label}</p>
              <PantryGrid items={items.map((it, i) => ({ ...it, id: cat.id + i }))} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------- App ----------------------------------- */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("hoy");
  const [pantry, setPantry] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [log, setLog] = useState([]);
  const [communityProfile, setCommunityProfile] = useState(DEFAULT_COMMUNITY_PROFILE);
  const [communityConfigured, setCommunityConfigured] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showFreeLogModal, setShowFreeLogModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [toast, setToast] = useState(null);
  const [recState, setRecState] = useState({ loading: false, meals: null, error: "" });

  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [communityUsers, setCommunityUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingUserItems, setViewingUserItems] = useState([]);
  const [viewingUserLoading, setViewingUserLoading] = useState(false);

  useEffect(() => {
    const p = loadKey("pantry-items", []);
    const s = loadKey("settings", DEFAULT_SETTINGS);
    const l = loadKey("daily-log", []);
    const cp = loadKey("community-profile", DEFAULT_COMMUNITY_PROFILE);
    setPantry(p); setSettings({ ...DEFAULT_SETTINGS, ...s }); setLog(l);
    setCommunityProfile({ ...DEFAULT_COMMUNITY_PROFILE, ...cp });
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (tab === "comunidad") { refreshFeed(); refreshUsers(); }
  }, [tab]);

  function notify(message) {
    setToast({ message });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 2800);
  }

  const todayTotals = useMemo(() => {
    return log.filter((e) => e.date === todayISO()).reduce(
      (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [log]);

  /* ---- pantry ops ---- */
  function persistPantry(next) {
    setPantry(next);
    saveKey("pantry-items", next);
    if (communityProfile.username && communityProfile.sharePantry) {
      publishPantrySnapshot(communityProfile.username, next);
    }
  }

  function upsertPantryItem(data, editId) {
    let next;
    if (editId) {
      next = pantry.map((p) => (p.id === editId ? { ...p, ...data } : p));
    } else {
      const existingIdx = pantry.findIndex((p) => normalizeName(p.name) === normalizeName(data.name) && p.unit === data.unit);
      if (existingIdx >= 0) {
        next = pantry.map((p, i) => i === existingIdx ? { ...p, quantity: round1(p.quantity + data.quantity), expirationDate: data.expirationDate || p.expirationDate } : p);
      } else {
        next = [...pantry, { id: uid(), ...data }];
      }
    }
    persistPantry(next);
    notify(editId ? "Producto actualizado" : "Producto agregado a tu alacena");
  }

  function deletePantryItem(item) {
    setConfirmState({
      text: `¿Eliminar "${item.name}" de tu alacena?`,
      danger: true,
      onConfirm: () => {
        persistPantry(pantry.filter((p) => p.id !== item.id));
        setConfirmState(null);
        notify("Producto eliminado");
      },
    });
  }

  function mergeReceiptItems(items) {
    let next = [...pantry];
    items.forEach((it) => {
      const idx = next.findIndex((p) => normalizeName(p.name) === normalizeName(it.name) && p.unit === it.unit);
      if (idx >= 0) {
        next[idx] = { ...next[idx], quantity: round1(next[idx].quantity + Number(it.quantity)) };
      } else {
        next.push({
          id: uid(), name: it.name, category: it.category, quantity: Number(it.quantity) || 1,
          unit: it.unit, calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat, expirationDate: null,
        });
      }
    });
    persistPantry(next);
    setShowReceiptModal(false);
    notify(`${items.length} producto(s) agregados desde tu ticket`);
  }

  function consumeFromPantry(ingredientsUsed) {
    let next = [...pantry];
    (ingredientsUsed || []).forEach((ing) => {
      const idx = next.findIndex((p) => normalizeName(p.name) === normalizeName(ing.name));
      if (idx >= 0) {
        next[idx] = { ...next[idx], quantity: Math.max(0, round1(next[idx].quantity - Number(ing.quantity || 0))) };
      }
    });
    persistPantry(next);
  }

  /* ---- log ops ---- */
  function persistLog(next) { setLog(next); saveKey("daily-log", next.slice(0, 400)); }

  function logRecommendedMeal(meal) {
    const entry = { id: uid(), date: todayISO(), label: meal.title, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
    persistLog([entry, ...log]);
    consumeFromPantry(meal.ingredientsUsed);
    if (communityProfile.username && communityProfile.shareMeals) publishFeedPost(entry);
    notify("Comida registrada en tu diario");
  }

  function logFreeMeal(data) {
    const entry = { id: uid(), date: todayISO(), label: data.label, calories: Number(data.calories) || 0, protein: Number(data.protein) || 0, carbs: Number(data.carbs) || 0, fat: Number(data.fat) || 0 };
    persistLog([entry, ...log]);
    setShowFreeLogModal(false);
    if (communityProfile.username && communityProfile.shareMeals) publishFeedPost(entry);
    notify("Comida registrada en tu diario");
  }

  /* ---- settings ---- */
  function saveSettings(next) {
    setSettings(next);
    saveKey("settings", next);
    notify("Ajustes guardados");
  }

  function resetAllData() {
    setConfirmState({
      text: "Esto borrará tu alacena, diario y ajustes guardados en este navegador. ¿Continuar?",
      danger: true,
      onConfirm: () => {
        saveKey("pantry-items", []);
        saveKey("daily-log", []);
        saveKey("settings", DEFAULT_SETTINGS);
        setPantry([]); setLog([]); setSettings(DEFAULT_SETTINGS);
        setConfirmState(null);
        notify("Tus datos fueron borrados");
      },
    });
  }

  /* ---- recommendations ---- */
  async function handleGetRecs() {
    setRecState({ loading: true, meals: recState.meals, error: "" });
    try {
      const meals = await fetchRecommendations({ pantry, settings, todayTotals });
      setRecState({ loading: false, meals, error: "" });
    } catch (e) {
      setRecState({ loading: false, meals: null, error: e.message || "No se pudieron generar recomendaciones. Intenta de nuevo." });
    }
  }

  /* ---- community ---- */
  async function publishPantrySnapshot(username, items) {
    const snapshot = items.map((p) => ({ name: p.name, category: p.category, quantity: p.quantity, unit: p.unit, calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat }));
    await postPublicPantry(username, snapshot);
  }

  async function publishFeedPost(entry) {
    await postCommunityFeed({
      username: communityProfile.username, label: entry.label,
      calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, ts: Date.now(),
    });
    refreshFeed();
  }

  async function saveCommunityProfile(profile) {
    setCommunityProfile(profile);
    saveKey("community-profile", profile);
    if (profile.username) {
      await postUpsertUser(profile);
      if (profile.sharePantry) await publishPantrySnapshot(profile.username, pantry);
    }
    notify("Perfil de comunidad guardado");
    refreshUsers();
  }

  async function refreshFeed() {
    setFeedLoading(true);
    const { posts, configured } = await fetchCommunityFeed();
    setFeed(posts);
    setCommunityConfigured(configured);
    setFeedLoading(false);
  }

  async function refreshUsers() {
    setUsersLoading(true);
    const { users, configured } = await fetchCommunityUsers();
    setCommunityUsers(users);
    setCommunityConfigured(configured);
    setUsersLoading(false);
  }

  async function handleViewUser(username) {
    setViewingUser(username);
    setViewingUserLoading(true);
    const items = await fetchPublicPantry(username);
    setViewingUserItems(items);
    setViewingUserLoading(false);
  }

  return (
    <div className="alacena-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        * { box-sizing: border-box; }
        html, body, #root { margin:0; padding:0; }

        .alacena-root { --bg:#F7F2E6; --surface:#FFFFFF; --surface-2:#FBF6EC; --ink:#2B2118; --ink-soft:#6B5E4F;
          --verde:#4F6B4B; --rojo:#C1442B; --azul:#2F4858; --maiz:#E3A857; --line:#E3D9C4;
          background: var(--bg); font-family:'Work Sans', sans-serif; color: var(--ink); display:flex; justify-content:center;
          min-height: 100vh; padding: 0; }
        .alacena-frame { width: 100%; max-width: 460px; min-height: 100vh; background: var(--bg); display:flex; flex-direction:column;
          position: relative; border-left: 1px solid var(--line); border-right: 1px solid var(--line); }

        .app-header { padding: 20px 20px 6px; }
        .app-header .eyebrow { font-family:'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); margin: 0 0 2px; }
        .app-header h1 { font-family:'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; margin: 0; }

        .app-main { flex: 1; padding: 12px 16px 90px; overflow-y: auto; }
        .view-stack { display:flex; flex-direction:column; gap: 14px; }

        .card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 16px; }
        .hero-card { display:flex; align-items:center; gap: 16px; }
        .hero-legend { flex:1; display:flex; flex-direction:column; gap: 8px; }
        .legend-row { display:flex; align-items:center; gap:6px; font-size: 13px; }
        .legend-row .mono { margin-left:auto; }
        .dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }

        .wheel-kcal { font-family:'IBM Plex Mono', monospace; font-size: 22px; font-weight:600; fill: var(--ink); }
        .wheel-kcal-label { font-family:'IBM Plex Mono', monospace; font-size: 9px; fill: var(--ink-soft); letter-spacing:.05em; }

        .mono { font-family:'IBM Plex Mono', monospace; }

        .progress-row { display:flex; flex-direction:column; gap:3px; }
        .progress-label-row { display:flex; justify-content:space-between; font-size:12.5px; }
        .progress-label-row .mono { font-size: 11px; color: var(--ink-soft); }
        .progress-track { height:6px; border-radius:4px; background: var(--line); overflow:hidden; }
        .progress-fill { height:100%; border-radius:4px; transition: width .3s ease; }

        .quick-actions { display:flex; gap:8px; }
        .quick-actions .btn { flex:1; font-size:12px; padding:10px 6px; }

        .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border-radius: 12px; border: none;
          font-family:'Work Sans', sans-serif; font-weight:600; font-size: 14px; padding: 11px 16px; cursor:pointer; transition: transform .08s ease, opacity .15s ease; }
        .btn:active { transform: scale(0.97); }
        .btn:disabled { opacity: .55; cursor: default; }
        .btn-primary { background: var(--verde); color: #fff; }
        .btn-secondary { background: var(--surface-2); color: var(--ink); border: 1px solid var(--line); flex-direction:column; gap:4px; }
        .btn-ghost { background: transparent; color: var(--ink-soft); }
        .btn-danger { background: var(--rojo); color: #fff; }
        .btn-danger-text { color: var(--rojo); }
        .btn-ai { background: var(--surface-2); color: var(--azul); border: 1px dashed var(--azul); font-size:13px; padding:8px 12px; }
        .btn-sm { padding: 7px 12px; font-size: 12.5px; }
        .full-width { width: 100%; }

        .rec-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; }
        .rec-header h3 { font-family:'Space Grotesk', sans-serif; font-size:16px; margin:0; }
        .meal-list { display:flex; flex-direction:column; gap:10px; margin-top: 6px; }
        .meal-item { background: var(--surface-2); border-radius: 14px; padding: 12px; border: 1px solid var(--line); }
        .meal-item-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
        .meal-item-head h4 { font-family:'Space Grotesk', sans-serif; font-size:14.5px; margin:0; }
        .meal-kcal { font-size:12px; color: var(--ink-soft); flex-shrink:0; }
        .meal-desc { font-size: 12.5px; color: var(--ink-soft); margin: 4px 0 6px; }
        .meal-instructions { font-size: 12px; color: var(--ink-soft); margin: 6px 0; line-height:1.5; }

        .alert-card { display:flex; flex-direction:column; gap:10px; }
        .alert-title { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:600; margin:0 0 6px; color: var(--rojo); }
        .alert-block .alert-title:not(:first-child) { color: var(--ink-soft); }
        .chip-row { display:flex; flex-wrap:wrap; gap:6px; }
        .chip { font-size: 11.5px; background: var(--surface-2); border:1px solid var(--line); border-radius: 999px; padding: 4px 10px; }
        .chip-warn { background: #F6E4DD; border-color: #E3B6A4; color: var(--rojo); }

        .search-row { display:flex; gap:8px; }
        .search-input { flex:1; display:flex; align-items:center; gap:6px; background: var(--surface); border:1px solid var(--line); border-radius:12px; padding: 0 10px; }
        .input-plain { border:none; background:transparent; padding: 9px 0; }
        .input-plain:focus { outline:none; }

        .input, .select { width:100%; border: 1px solid var(--line); background: var(--surface); border-radius: 10px; padding: 9px 10px; font-size: 14px; font-family:'Work Sans', sans-serif; color: var(--ink); }
        .input:focus, .select:focus { outline: 2px solid var(--azul); outline-offset: 1px; }
        .input-sm { padding: 7px 8px; font-size: 12.5px; }

        .field { display:flex; flex-direction:column; gap: 4px; }
        .field-row { display:flex; gap: 8px; }
        .label { font-size: 11.5px; color: var(--ink-soft); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
        .form-stack { display:flex; flex-direction:column; gap: 12px; }
        .hint-text { font-size: 12.5px; color: var(--ink-soft); margin: 0; line-height:1.45; }
        .micro-text { font-size: 11.5px; color: var(--ink-soft); margin:0; }
        .error-text { font-size: 11.5px; color: var(--rojo); }
        .error-banner { display:flex; gap:6px; align-items:flex-start; background:#F6E4DD; color:#7A2E1C; border-radius:10px; padding:10px; font-size: 12.5px; }
        .notice-banner { display:flex; gap:8px; align-items:flex-start; background: var(--surface-2); color: var(--ink-soft); border-radius:10px; padding:10px; font-size: 12px; line-height:1.4; }
        .ai-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

        .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top: 4px; }

        .pantry-group { display:flex; flex-direction:column; gap:8px; }
        .group-title { font-family:'Space Grotesk', sans-serif; font-size: 13px; font-weight:700; margin: 4px 0 2px; }
        .pantry-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .pantry-card { background: var(--surface); border:1px solid var(--line); border-top: 3px solid var(--cat-color); border-radius:16px; padding:11px; display:flex; flex-direction:column; gap:3px; }
        .pantry-card-top { display:flex; justify-content:space-between; align-items:flex-start; }
        .pantry-card-icon { font-size: 24px; background: var(--surface-2); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
        .pantry-card-actions { display:flex; gap:0px; }
        .icon-btn-sm { padding:3px; }
        .pantry-card-name { font-size:13px; font-weight:700; margin: 4px 0 0; line-height:1.25; }
        .pantry-card-qty { font-size:12px; color: var(--ink-soft); }
        .pantry-name { font-size: 13.5px; font-weight:600; margin:0; }
        .empty-state { display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; color: var(--ink-soft); padding: 36px 20px; }
        .empty-inline { text-align:center; color: var(--ink-soft); font-size: 13px; padding: 20px 0; }

        .diary-date-row { display:flex; justify-content:space-between; margin-bottom:8px; }
        .diary-entry { padding: 8px 0; border-top: 1px solid var(--line); }
        .diary-entry:first-of-type { border-top:none; }

        .seg-control { display:flex; background: var(--surface-2); border-radius: 12px; padding:3px; margin-bottom:4px; }
        .seg-btn { flex:1; border:none; background:transparent; padding: 8px; border-radius:9px; font-size:13px; font-weight:600; color: var(--ink-soft); cursor:pointer; }
        .seg-btn.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.08); }

        .upload-zone { display:flex; flex-direction:column; align-items:center; gap:8px; border: 1.5px dashed var(--line); border-radius:16px; padding: 30px 16px; text-align:center; color: var(--ink-soft); cursor:pointer; font-size: 13px; }
        .upload-zone:hover { border-color: var(--azul); color: var(--azul); }
        .receipt-preview { max-height: 160px; border-radius: 12px; align-self:center; object-fit:cover; }
        .center-stack { align-items:center; }
        .loading-row { display:flex; align-items:center; gap:8px; font-size: 13.5px; color: var(--ink-soft); }
        .receipt-list { display:flex; flex-direction:column; gap:8px; max-height: 340px; overflow-y:auto; }
        .receipt-row { display:flex; align-items:flex-start; gap:8px; background: var(--surface-2); border-radius: 12px; padding: 10px; border: 1px solid var(--line); }
        .receipt-row-off { opacity: .45; }
        .receipt-row-fields { flex:1; display:flex; flex-direction:column; gap:5px; min-width:0; }

        .icon-btn { background: transparent; border:none; color: var(--ink-soft); cursor:pointer; padding:4px; border-radius:8px; display:flex; align-items:center; }
        .icon-btn:hover { background: var(--surface-2); }

        .tab-bar { position:fixed; bottom:0; left:50%; transform: translateX(-50%); width: 100%; max-width: 460px; display:flex; background: var(--surface); border-top: 1px solid var(--line); padding: 8px 4px calc(env(safe-area-inset-bottom,0px) + 8px); }
        .tab-btn { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; background:transparent; border:none; color: var(--ink-soft); font-size: 10px; font-weight:600; padding: 4px 2px; cursor:pointer; border-radius: 10px; }
        .tab-btn.active { color: var(--verde); }

        .toast { position:fixed; bottom: 78px; left:50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 12.5px; box-shadow: 0 6px 16px rgba(0,0,0,.18); z-index: 50; white-space: nowrap; }

        .modal-overlay { position:fixed; inset:0; background: rgba(43,33,24,0.45); display:flex; align-items:flex-end; justify-content:center; z-index: 100; }
        .modal { background: var(--bg); width:100%; max-width: 460px; max-height: 86%; overflow-y:auto; border-radius: 20px 20px 0 0; padding: 18px; animation: slideUp .2s ease; }
        .modal-wide { max-height: 90%; }
        .modal-confirm { border-radius: 18px; margin: auto; max-width: 320px; }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; }
        .modal-header h3 { font-family:'Space Grotesk', sans-serif; font-size: 17px; margin:0; }
        .confirm-text { font-size: 14px; margin: 4px 0 14px; }
        .confirm-actions { display:flex; gap:8px; justify-content:flex-end; }
        @keyframes slideUp { from { transform: translateY(24px); opacity:0; } to { transform: translateY(0); opacity:1; } }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .avatar { border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-family:'Space Grotesk',sans-serif; flex-shrink:0; }
        .profile-summary { display:flex; align-items:center; gap:10px; }
        .toggle-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:10px; }
        .toggle-row input[type=checkbox] { width:18px; height:18px; accent-color: var(--verde); flex-shrink:0; }
        .feed-list { display:flex; flex-direction:column; gap:8px; }
        .feed-post { background: var(--surface-2); border-radius:12px; padding:10px; border:1px solid var(--line); }
        .feed-post-head { display:flex; align-items:center; gap:8px; font-size:12.5px; margin:0 0 4px; }
        .feed-post-label { font-size:13px; margin:0 0 4px; font-weight:600; }
        .user-list { display:flex; flex-direction:column; gap:6px; }
        .user-row { display:flex; align-items:center; gap:8px; background: var(--surface-2); border:1px solid var(--line); border-radius:10px; padding:9px 10px; font-size:13px; cursor:pointer; text-align:left; color: var(--ink); font-family:'Work Sans',sans-serif; }
        .user-row:hover { border-color: var(--azul); }

        @media (max-width: 380px) { .alacena-frame { max-width: 100%; } }
      `}</style>

      <div className="alacena-frame">
        <header className="app-header">
          <p className="eyebrow">{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{getGreeting()}</h1>
        </header>

        <main className="app-main">
          {!loaded ? (
            <div className="loading-row"><Loader2 size={16} className="spin" /> Cargando tu alacena...</div>
          ) : tab === "hoy" ? (
            <DashboardView
              pantry={pantry} settings={settings} todayTotals={todayTotals} recState={recState}
              onGetRecs={handleGetRecs} onLogMeal={logRecommendedMeal}
              onOpenAdd={() => { setEditingItem(null); setShowAddModal(true); }}
              onOpenReceipt={() => setShowReceiptModal(true)}
              onOpenFreeLog={() => setShowFreeLogModal(true)}
            />
          ) : tab === "alacena" ? (
            <PantryView
              pantry={pantry}
              onAdd={() => { setEditingItem(null); setShowAddModal(true); }}
              onEdit={(item) => { setEditingItem(item); setShowAddModal(true); }}
              onDelete={deletePantryItem}
            />
          ) : tab === "comunidad" ? (
            <CommunityView
              profile={communityProfile} onSaveProfile={saveCommunityProfile}
              feed={feed} feedLoading={feedLoading} onRefreshFeed={refreshFeed}
              users={communityUsers} usersLoading={usersLoading} onViewUser={handleViewUser}
              currentUsername={communityProfile.username} configured={communityConfigured}
            />
          ) : tab === "diario" ? (
            <DiaryView log={log} />
          ) : (
            <SettingsView settings={settings} onSave={saveSettings} onReset={resetAllData} />
          )}
        </main>

        <nav className="tab-bar">
          <button className={"tab-btn" + (tab === "hoy" ? " active" : "")} onClick={() => setTab("hoy")}><Home size={18} /><span>Hoy</span></button>
          <button className={"tab-btn" + (tab === "alacena" ? " active" : "")} onClick={() => setTab("alacena")}><Package size={18} /><span>Alacena</span></button>
          <button className={"tab-btn" + (tab === "comunidad" ? " active" : "")} onClick={() => setTab("comunidad")}><Users size={18} /><span>Comunidad</span></button>
          <button className={"tab-btn" + (tab === "diario" ? " active" : "")} onClick={() => setTab("diario")}><BookOpen size={18} /><span>Diario</span></button>
          <button className={"tab-btn" + (tab === "ajustes" ? " active" : "")} onClick={() => setTab("ajustes")}><SettingsIcon size={18} /><span>Ajustes</span></button>
        </nav>

        {toast && <div className="toast">{toast.message}</div>}

        {showAddModal && (
          <Modal title={editingItem ? "Editar producto" : "Agregar producto"} onClose={() => setShowAddModal(false)}>
            <ItemForm
              initial={editingItem}
              saveLabel={editingItem ? "Guardar cambios" : "Agregar a la alacena"}
              onCancel={() => setShowAddModal(false)}
              onSave={(data) => { upsertPantryItem(data, editingItem?.id); setShowAddModal(false); }}
            />
          </Modal>
        )}

        {showReceiptModal && (
          <Modal title="Escanear ticket" onClose={() => setShowReceiptModal(false)} wide>
            <ReceiptFlow onCancel={() => setShowReceiptModal(false)} onConfirm={mergeReceiptItems} />
          </Modal>
        )}

        {showFreeLogModal && (
          <Modal title="Registrar comida" onClose={() => setShowFreeLogModal(false)}>
            <FreeLogForm onCancel={() => setShowFreeLogModal(false)} onSave={logFreeMeal} />
          </Modal>
        )}

        {viewingUser && (
          <PublicPantryModal username={viewingUser} items={viewingUserItems} loading={viewingUserLoading} onClose={() => setViewingUser(null)} />
        )}

        {confirmState && (
          <ConfirmDialog
            text={confirmState.text} danger={confirmState.danger}
            onCancel={() => setConfirmState(null)} onConfirm={confirmState.onConfirm}
          />
        )}
      </div>
    </div>
  );
}

function FreeLogForm({ onCancel, onSave }) {
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);

  return (
    <div className="form-stack">
      <p className="hint-text">Útil para comidas fuera de tu alacena (restaurante, antojo, etc.).</p>
      <label className="field"><span className="label">¿Qué comiste?</span><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Tacos al pastor" /></label>
      <div className="field-row">
        <label className="field"><span className="label">Kcal</span><input className="input mono" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
        <label className="field"><span className="label">Prot (g)</span><input className="input mono" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span className="label">Carbs (g)</span><input className="input mono" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
        <label className="field"><span className="label">Grasa (g)</span><input className="input mono" type="number" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" disabled={!label.trim()} onClick={() => onSave({ label, calories, protein, carbs, fat })}>Registrar</button>
      </div>
    </div>
  );
}
