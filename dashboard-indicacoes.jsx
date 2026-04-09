import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as recharts from "recharts";

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, AreaChart, Area,
} = recharts;

// ─── CONFIG ────────────────────────────────────────────────
const CONFIG = {
  API_URL: "", // ← Cole aqui sua URL do Google Apps Script
  POLL_INTERVAL: 300000,
  DEMO_MODE: true, // ← Mude para false quando conectar
};

// ─── THEME ─────────────────────────────────────────────────
const T = {
  bg: "#0A0E1A",
  surface: "#0F1629",
  surfaceAlt: "#161D33",
  surfaceHover: "#1C2440",
  border: "#1E293B",
  borderLight: "#2D3A52",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  textDim: "#64748B",
  accent: "#6366F1",
  accentHover: "#7C7FF7",
  accentGlow: "rgba(99,102,241,.15)",
  green: "#10B981",
  greenBg: "rgba(16,185,129,.10)",
  yellow: "#F59E0B",
  yellowBg: "rgba(245,158,11,.10)",
  red: "#EF4444",
  redBg: "rgba(239,68,68,.10)",
  blue: "#3B82F6",
  blueBg: "rgba(59,130,246,.10)",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
};

const STATUS_MAP = {
  ligar: { label: "Ligar indicador", color: T.red, bg: T.redBg, icon: "📞" },
  enviar: { label: "Enviar presente", color: T.yellow, bg: T.yellowBg, icon: "🎁" },
  confirmar: { label: "Confirmar recebimento", color: T.blue, bg: T.blueBg, icon: "✅" },
  concluido: { label: "Concluído", color: T.green, bg: T.greenBg, icon: "🏁" },
};

// ─── DEMO DATA ─────────────────────────────────────────────
function generateDemoData() {
  const nomes = [
    "Ana Silva","Bruno Costa","Carla Mendes","Diego Oliveira","Elena Santos",
    "Fabio Lima","Gabriela Rocha","Hugo Ferreira","Isabela Souza","João Almeida",
    "Karen Ribeiro","Lucas Martins","Mariana Pereira","Nathan Barbosa","Olivia Castro",
    "Paulo Nunes","Rafaela Dias","Samuel Gomes","Tatiana Moreira","Vinicius Cardoso",
    "Bianca Teixeira","Caio Araújo","Daniela Pinto","Eduardo Correia","Fernanda Vieira",
  ];
  const indicadores = [
    "Dr. Ricardo Lopes","Dra. Patrícia Melo","Dr. Fernando Bastos",
    "Dra. Camila Duarte","Dr. André Fonseca","Dra. Juliana Reis",
    "Dr. Marcos Tavares","Dra. Renata Cruz",
  ];
  const now = Date.now();
  return nomes.map((n, i) => {
    const daysAgo = Math.floor(Math.random() * 160);
    const fDate = new Date(now - daysAgo * 864e5);
    const hasL = Math.random() > 0.2;
    const hasE = hasL && Math.random() > 0.25;
    const hasC = hasE && Math.random() > 0.3;
    const lDate = hasL ? new Date(fDate.getTime() + Math.random() * 5 * 864e5) : null;
    const eDate = hasE ? new Date(lDate.getTime() + Math.random() * 7 * 864e5) : null;
    const cDate = hasC ? new Date(eDate.getTime() + Math.random() * 10 * 864e5) : null;
    return {
      _rowIndex: i,
      paciente_fechou: n,
      telefone_paciente: `(27) 9${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e3 + Math.random() * 9e3)}`,
      valor_contrato: Math.round((3e3 + Math.random() * 27e3) / 100) * 100,
      data_fechamento: fmt(fDate),
      paciente_indicador: indicadores[Math.floor(Math.random() * indicadores.length)],
      telefone_indicador: `(27) 9${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e3 + Math.random() * 9e3)}`,
      endereco: `Rua ${["das Flores","São Paulo","XV de Novembro","Beira Mar","da Paz"][i % 5]}, ${Math.floor(Math.random() * 999 + 1)}`,
      data_ligacao_confirmacao: lDate ? fmt(lDate) : "",
      data_envio_presente: eDate ? fmt(eDate) : "",
      data_confirmacao_recebimento: cDate ? fmt(cDate) : "",
    };
  });
}
function fmt(d) { return d.toISOString().split("T")[0]; }

// ─── UTILS ─────────────────────────────────────────────────
const getStatus = r => {
  if (!r.data_ligacao_confirmacao) return "ligar";
  if (!r.data_envio_presente) return "enviar";
  if (!r.data_confirmacao_recebimento) return "confirmar";
  return "concluido";
};
const money = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const fmtDate = d => { if(!d) return "—"; const p=d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const daysBetween = (a,b) => { if(!a||!b) return null; return Math.round((new Date(b)-new Date(a))/864e5); };
const monthLabel = d => new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
const today = () => new Date().toISOString().split("T")[0];

// ─── API HELPERS ───────────────────────────────────────────
async function apiPost(body) {
  if (CONFIG.DEMO_MODE) {
    await new Promise(r => setTimeout(r, 400));
    return { success: true, message: "Demo mode" };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── RESPONSIVE ────────────────────────────────────────────
function useWidth() {
  const [w,setW] = useState(typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{ const h=()=>setW(window.innerWidth); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);
  return w;
}

// ─── TOAST ─────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: T.green, error: T.red, info: T.accent };
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:9999,
      background: T.surface, border:`1px solid ${colors[type]||T.border}`,
      borderRadius:12, padding:"12px 20px", display:"flex", alignItems:"center", gap:10,
      boxShadow:`0 8px 32px rgba(0,0,0,.5)`, animation:"slideUp .3s ease-out",
      maxWidth:360,
    }}>
      <span style={{fontSize:18}}>{type==="success"?"✅":type==="error"?"❌":"ℹ️"}</span>
      <span style={{fontSize:13, color:T.text}}>{message}</span>
    </div>
  );
}

// ─── FORM MODAL ────────────────────────────────────────────
const EMPTY_FORM = {
  paciente_fechou:"", telefone_paciente:"", valor_contrato:"",
  data_fechamento: today(), paciente_indicador:"", telefone_indicador:"",
  endereco:"", data_ligacao_confirmacao:"", data_envio_presente:"",
  data_confirmacao_recebimento:"",
};

function FormModal({ initialData, onSave, onClose, saving, indicadores }) {
  const isEdit = !!initialData?._rowIndex && initialData._rowIndex >= 0;
  const [form, setForm] = useState(initialData ? {...EMPTY_FORM,...initialData, valor_contrato: initialData.valor_contrato||""} : {...EMPTY_FORM});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const canSave = form.paciente_fechou.trim() && form.valor_contrato && form.data_fechamento && form.paciente_indicador.trim();

  const fieldStyle = {
    width:"100%", background:T.surfaceAlt, border:`1px solid ${T.border}`,
    borderRadius:8, padding:"10px 12px", color:T.text, fontSize:14, outline:"none",
    transition:"border-color .2s",
  };
  const labelStyle = { fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", color:T.textDim, marginBottom:4, display:"block" };
  const groupStyle = { marginBottom:16 };

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)",padding:16,
    }} onClick={onClose}>
      <div style={{
        background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,
        width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",
      }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding:"20px 24px",borderBottom:`1px solid ${T.border}`,
          display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,
        }}>
          <div style={{fontSize:18,fontWeight:700}}>
            {isEdit ? "✏️ Editar Indicação" : "➕ Nova Indicação"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textDim,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        {/* Body */}
        <div style={{padding:24,overflowY:"auto",flex:1}}>
          {/* Seção: Paciente */}
          <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>
            Dados do Paciente
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={groupStyle}>
              <label style={labelStyle}>Nome do Paciente *</label>
              <input style={fieldStyle} value={form.paciente_fechou} onChange={e=>set("paciente_fechou",e.target.value)} placeholder="Nome completo" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Telefone</label>
              <input style={fieldStyle} value={form.telefone_paciente} onChange={e=>set("telefone_paciente",e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={groupStyle}>
              <label style={labelStyle}>Valor do Contrato *</label>
              <input style={fieldStyle} type="number" step="100" value={form.valor_contrato} onChange={e=>set("valor_contrato",e.target.value)} placeholder="0.00" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Data Fechamento *</label>
              <input style={{...fieldStyle,colorScheme:"dark"}} type="date" value={form.data_fechamento} onChange={e=>set("data_fechamento",e.target.value)} />
            </div>
          </div>

          {/* Seção: Indicador */}
          <div style={{fontSize:12,fontWeight:700,color:T.accent,marginTop:8,marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>
            Dados do Indicador
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={groupStyle}>
              <label style={labelStyle}>Nome do Indicador *</label>
              <input style={fieldStyle} list="indicadores-list" value={form.paciente_indicador} onChange={e=>set("paciente_indicador",e.target.value)} placeholder="Nome do indicador" />
              <datalist id="indicadores-list">
                {indicadores.map(i=><option key={i} value={i}/>)}
              </datalist>
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Telefone Indicador</label>
              <input style={fieldStyle} value={form.telefone_indicador} onChange={e=>set("telefone_indicador",e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Endereço</label>
            <input style={fieldStyle} value={form.endereco} onChange={e=>set("endereco",e.target.value)} placeholder="Endereço completo para envio" />
          </div>

          {/* Seção: Status (só no edit) */}
          {isEdit && (
            <>
              <div style={{fontSize:12,fontWeight:700,color:T.accent,marginTop:8,marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>
                Acompanhamento de Status
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div style={groupStyle}>
                  <label style={labelStyle}>📞 Ligação</label>
                  <input style={{...fieldStyle,colorScheme:"dark"}} type="date" value={form.data_ligacao_confirmacao} onChange={e=>set("data_ligacao_confirmacao",e.target.value)} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>🎁 Envio Presente</label>
                  <input style={{...fieldStyle,colorScheme:"dark"}} type="date" value={form.data_envio_presente} onChange={e=>set("data_envio_presente",e.target.value)} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>✅ Confirmação</label>
                  <input style={{...fieldStyle,colorScheme:"dark"}} type="date" value={form.data_confirmacao_recebimento} onChange={e=>set("data_confirmacao_recebimento",e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:"16px 24px",borderTop:`1px solid ${T.border}`,
          display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0,
        }}>
          <button onClick={onClose} style={{
            padding:"10px 20px",borderRadius:8,border:`1px solid ${T.border}`,
            background:"transparent",color:T.textMuted,fontSize:14,fontWeight:600,cursor:"pointer",
          }}>Cancelar</button>
          <button
            onClick={()=>canSave && onSave(form)}
            disabled={!canSave || saving}
            style={{
              padding:"10px 24px",borderRadius:8,border:"none",
              background:canSave && !saving ? T.accent : T.borderLight,
              color:canSave && !saving ? "#fff" : T.textDim,
              fontSize:14,fontWeight:700,cursor:canSave && !saving?"pointer":"not-allowed",
              display:"flex",alignItems:"center",gap:6,
            }}
          >
            {saving ? "⟳ Salvando..." : isEdit ? "💾 Salvar Alterações" : "➕ Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL + ACTIONS MODAL ────────────────────────────────
function DetailModal({ row, onClose, onAction, actionLoading }) {
  if (!row) return null;
  const st = getStatus(row);
  const si = STATUS_MAP[st];
  const steps = [
    { key: "data_fechamento", label: "Contrato fechado", date: row.data_fechamento, done: true },
    { key: "data_ligacao_confirmacao", label: "Ligação realizada", date: row.data_ligacao_confirmacao, done: !!row.data_ligacao_confirmacao },
    { key: "data_envio_presente", label: "Presente enviado", date: row.data_envio_presente, done: !!row.data_envio_presente },
    { key: "data_confirmacao_recebimento", label: "Recebimento confirmado", date: row.data_confirmacao_recebimento, done: !!row.data_confirmacao_recebimento },
  ];

  // Qual é a próxima ação?
  const nextStep = steps.find(s => !s.done && s.key !== "data_fechamento");

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)",padding:16,
    }} onClick={onClose}>
      <div style={{
        background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:28,
        maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto",
      }} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:20,fontWeight:700}}>{row.paciente_fechou}</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>{row.telefone_paciente}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textDim,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <div style={{background:T.surfaceAlt,borderRadius:10,padding:12}}>
            <div style={{fontSize:11,color:T.textDim}}>VALOR</div>
            <div style={{fontSize:20,fontWeight:800,color:T.green}}>{money(row.valor_contrato)}</div>
          </div>
          <div style={{background:T.surfaceAlt,borderRadius:10,padding:12}}>
            <div style={{fontSize:11,color:T.textDim}}>STATUS</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:600,color:si.color,background:si.bg,marginTop:2}}>
              {si.icon} {si.label}
            </div>
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:600,color:T.textDim,marginBottom:8}}>INDICADOR</div>
          <div style={{fontSize:14,fontWeight:600}}>{row.paciente_indicador}</div>
          <div style={{fontSize:12,color:T.textMuted}}>{row.telefone_indicador}</div>
          <div style={{fontSize:12,color:T.textDim,marginTop:2}}>{row.endereco}</div>
        </div>

        {/* TIMELINE */}
        <div style={{fontSize:12,fontWeight:600,color:T.textDim,marginBottom:12}}>TIMELINE</div>
        {steps.map((step,i)=>(
          <div key={i} style={{display:"flex",gap:12}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{
                width:26,height:26,borderRadius:"50%",
                background:step.done?T.green:T.border,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,color:step.done?"#fff":T.textDim,fontWeight:700,flexShrink:0,
              }}>{step.done?"✓":i+1}</div>
              {i<steps.length-1 && <div style={{width:2,height:24,background:step.done?T.green:T.border}}/>}
            </div>
            <div style={{paddingBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:step.done?T.text:T.textDim}}>{step.label}</div>
              <div style={{fontSize:12,color:T.textMuted}}>{step.date?fmtDate(step.date):"Pendente"}</div>
            </div>
          </div>
        ))}

        {/* ACTION BUTTON */}
        {nextStep && (
          <button
            onClick={()=>onAction(row._rowIndex, nextStep.key, today())}
            disabled={actionLoading}
            style={{
              marginTop:16,width:"100%",padding:"12px",borderRadius:10,border:"none",
              background:`linear-gradient(135deg, ${T.accent}, ${T.purple})`,
              color:"#fff",fontSize:14,fontWeight:700,cursor:actionLoading?"wait":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            }}
          >
            {actionLoading ? "⟳ Atualizando..." : `${STATUS_MAP[st].icon} Marcar: ${nextStep.label}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CUSTOM TOOLTIP ────────────────────────────────────────
function ChartTooltip({ active, payload, label, fmt: formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:T.surfaceAlt,border:`1px solid ${T.borderLight}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.text,boxShadow:"0 8px 32px rgba(0,0,0,.4)"}}>
      <div style={{fontWeight:600,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||T.text}}>{p.name}: {formatter?formatter(p.value):p.value}</div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const width = useWidth();
  const isMobile = width < 768;
  const isTablet = width < 1024;

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterIndicador, setFilterIndicador] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message, type="success") => setToast({message,type});

  // ─── FETCH ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (CONFIG.DEMO_MODE || !CONFIG.API_URL) {
        await new Promise(r=>setTimeout(r,500));
        setRawData(prev => prev.length ? prev : generateDemoData());
      } else {
        const res = await fetch(CONFIG.API_URL);
        const json = await res.json();
        setRawData(json.data || json);
      }
      setLastUpdate(new Date());
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{fetchData();},[fetchData]);

  // ─── CREATE / UPDATE ───────────────────────────────────
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const isEdit = editRow !== null && editRow._rowIndex >= 0;
      if (isEdit) {
        await apiPost({ action:"update", rowIndex:editRow._rowIndex, record:formData });
        if (CONFIG.DEMO_MODE) {
          setRawData(prev => prev.map(r => r._rowIndex === editRow._rowIndex ? {...r,...formData, valor_contrato:Number(formData.valor_contrato)||0} : r));
        }
        notify("Registro atualizado com sucesso!");
      } else {
        const result = await apiPost({ action:"create", record:formData });
        if (CONFIG.DEMO_MODE) {
          const newRow = {...formData, _rowIndex: rawData.length, valor_contrato:Number(formData.valor_contrato)||0 };
          setRawData(prev => [...prev, newRow]);
        }
        notify("Indicação cadastrada com sucesso!");
      }
      setShowForm(false);
      setEditRow(null);
      if (!CONFIG.DEMO_MODE) fetchData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── QUICK ACTION (marcar etapa) ───────────────────────
  const handleQuickAction = async (rowIndex, field, value) => {
    setActionLoading(true);
    try {
      await apiPost({ action:"update_field", rowIndex, field, value });
      if (CONFIG.DEMO_MODE) {
        setRawData(prev => prev.map(r => r._rowIndex === rowIndex ? {...r,[field]:value} : r));
      }
      // Atualizar o selectedRow também
      setSelectedRow(prev => prev && prev._rowIndex === rowIndex ? {...prev,[field]:value} : prev);
      notify("Status atualizado!");
      if (!CONFIG.DEMO_MODE) fetchData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── DELETE ────────────────────────────────────────────
  const handleDelete = async (rowIndex) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    try {
      await apiPost({ action:"delete", rowIndex });
      if (CONFIG.DEMO_MODE) {
        setRawData(prev => prev.filter(r => r._rowIndex !== rowIndex));
      }
      setSelectedRow(null);
      notify("Registro excluído.");
      if (!CONFIG.DEMO_MODE) fetchData();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  // ─── COMPUTED ──────────────────────────────────────────
  const enriched = useMemo(() => rawData.map(r=>({...r,status:getStatus(r),valor_contrato:Number(r.valor_contrato)||0})),[rawData]);
  const indicadores = useMemo(() => [...new Set(enriched.map(r=>r.paciente_indicador))].filter(Boolean).sort(),[enriched]);

  const filtered = useMemo(()=>{
    let d = enriched;
    if (filterStatus !== "todos") d = d.filter(r=>r.status===filterStatus);
    if (filterIndicador !== "todos") d = d.filter(r=>r.paciente_indicador===filterIndicador);
    if (filterPeriodo !== "todos") {
      const now = new Date(); const cut = new Date();
      if (filterPeriodo==="7d") cut.setDate(now.getDate()-7);
      else if (filterPeriodo==="30d") cut.setDate(now.getDate()-30);
      else if (filterPeriodo==="90d") cut.setDate(now.getDate()-90);
      else if (filterPeriodo==="180d") cut.setDate(now.getDate()-180);
      d = d.filter(r=>new Date(r.data_fechamento)>=cut);
    }
    if (searchTerm) { const q=searchTerm.toLowerCase(); d=d.filter(r=>r.paciente_fechou.toLowerCase().includes(q)||r.paciente_indicador.toLowerCase().includes(q)); }
    return d;
  },[enriched,filterStatus,filterIndicador,filterPeriodo,searchTerm]);

  const kpis = useMemo(()=>{
    const total = filtered.reduce((s,r)=>s+r.valor_contrato,0);
    const count = filtered.length;
    const byStatus = {ligar:0,enviar:0,confirmar:0,concluido:0};
    filtered.forEach(r=>byStatus[r.status]++);
    const times = {l:[],e:[],c:[]};
    filtered.forEach(r=>{
      const d1=daysBetween(r.data_fechamento,r.data_ligacao_confirmacao);
      const d2=daysBetween(r.data_ligacao_confirmacao,r.data_envio_presente);
      const d3=daysBetween(r.data_envio_presente,r.data_confirmacao_recebimento);
      if(d1!==null)times.l.push(d1); if(d2!==null)times.e.push(d2); if(d3!==null)times.c.push(d3);
    });
    const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:0;
    return { total,count,byStatus,ticket:count?total/count:0,
      taxa:count?Math.round(byStatus.concluido/count*100):0,
      avgL:avg(times.l),avgE:avg(times.e),avgC:avg(times.c) };
  },[filtered]);

  const monthlyData = useMemo(()=>{
    const m={};
    filtered.forEach(r=>{const k=r.data_fechamento.substring(0,7); if(!m[k])m[k]={month:k,fat:0,n:0}; m[k].fat+=r.valor_contrato; m[k].n++;});
    return Object.values(m).sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({...x,label:monthLabel(x.month+"-01")}));
  },[filtered]);

  const ranking = useMemo(()=>{
    const m={};
    filtered.forEach(r=>{const k=r.paciente_indicador; if(!m[k])m[k]={nome:k,count:0,total:0}; m[k].count++; m[k].total+=r.valor_contrato;});
    return Object.values(m).map(r=>({...r,avg:r.count?r.total/r.count:0})).sort((a,b)=>b.total-a.total);
  },[filtered]);

  const bottleneck = useMemo(()=>{
    const {ligar,enviar,confirmar}=kpis.byStatus;
    const max=Math.max(ligar,enviar,confirmar);
    if(!max) return null;
    if(ligar===max) return {step:"Ligar indicador",count:ligar,color:T.red};
    if(enviar===max) return {step:"Enviar presente",count:enviar,color:T.yellow};
    return {step:"Confirmar recebimento",count:confirmar,color:T.blue};
  },[kpis]);

  // ─── STYLES ────────────────────────────────────────────
  const card = {background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:20};
  const badge = (color,bg) => ({display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,color,background:bg,whiteSpace:"nowrap"});
  const sel = {background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:13,outline:"none",cursor:"pointer"};
  const th = {textAlign:"left",padding:"10px 12px",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.surface,zIndex:1};
  const td = {padding:"10px 12px",borderBottom:`1px solid ${T.border}`,color:T.textMuted,whiteSpace:"nowrap"};

  if (loading && !rawData.length) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:48,height:48,border:`3px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{color:T.textMuted}}>Carregando dados...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${T.borderLight} transparent}
        ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${T.borderLight};border-radius:3px}
        body{margin:0;background:${T.bg}} button:hover{filter:brightness(1.08)} tr:hover td{background:${T.surfaceAlt}!important}
        .ani{animation:fadeIn .35s ease-out both}
      `}</style>

      {/* HEADER */}
      <header style={{
        background:`linear-gradient(135deg,${T.surface},${T.surfaceAlt})`,
        borderBottom:`1px solid ${T.border}`,padding:"16px 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",flexShrink:0}}>G</div>
          <div>
            <div style={{fontSize:18,fontWeight:700,letterSpacing:"-.02em"}}>Gestão de Indicações</div>
            <div style={{fontSize:12,color:T.textDim}}>Dashboard Operacional</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {lastUpdate && <span style={{fontSize:11,color:T.textDim}}>Atualizado {lastUpdate.toLocaleTimeString("pt-BR")}</span>}
          <button onClick={()=>{setEditRow(null);setShowForm(true);}} style={{
            padding:"8px 16px",borderRadius:8,border:"none",
            background:`linear-gradient(135deg,${T.green},#059669)`,
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,
          }}>➕ Nova Indicação</button>
          <button onClick={fetchData} style={{
            padding:"8px 16px",borderRadius:8,border:`1px solid ${T.border}`,
            background:"transparent",color:T.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",
          }}>{loading?"⟳":"↻"} Atualizar</button>
        </div>
      </header>

      <div style={{maxWidth:1320,margin:"0 auto",padding:"20px 16px"}}>
        {CONFIG.DEMO_MODE && (
          <div style={{...card,border:`1px solid ${T.accent}40`,background:`linear-gradient(135deg,${T.surfaceAlt},${T.surface})`,marginBottom:20,padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>⚡</span>
              <span style={{fontWeight:700,fontSize:14}}>Modo Demonstração</span>
              <span style={{fontSize:13,color:T.textMuted,marginLeft:4}}>— Os dados são simulados. Conecte sua planilha no <code style={{background:T.surfaceAlt,padding:"1px 5px",borderRadius:4,color:T.accent,fontSize:12}}>CONFIG</code></span>
            </div>
          </div>
        )}

        {/* TABS */}
        <div style={{display:"flex",gap:2,background:T.surfaceAlt,borderRadius:10,padding:3,marginBottom:20,overflowX:"auto"}}>
          {[{id:"dashboard",l:"📊 Dashboard"},{id:"operacional",l:"📋 Operacional"},{id:"ranking",l:"🏆 Ranking"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:"8px 16px",borderRadius:8,border:"none",whiteSpace:"nowrap",cursor:"pointer",
              background:activeTab===t.id?T.accent:"transparent",
              color:activeTab===t.id?"#fff":T.textMuted,fontSize:13,fontWeight:600,transition:"all .15s",
            }}>{t.l}</button>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:20}}>
          <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
            style={{...sel,width:160}} />
          <select style={sel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="todos">Todos status</option>
            <option value="ligar">📞 Ligar</option><option value="enviar">🎁 Enviar</option>
            <option value="confirmar">✅ Confirmar</option><option value="concluido">🏁 Concluído</option>
          </select>
          <select style={sel} value={filterIndicador} onChange={e=>setFilterIndicador(e.target.value)}>
            <option value="todos">Todos indicadores</option>
            {indicadores.map(i=><option key={i} value={i}>{i}</option>)}
          </select>
          <select style={sel} value={filterPeriodo} onChange={e=>setFilterPeriodo(e.target.value)}>
            <option value="todos">Todo período</option>
            <option value="7d">7 dias</option><option value="30d">30 dias</option>
            <option value="90d">90 dias</option><option value="180d">180 dias</option>
          </select>
          <span style={{fontSize:12,color:T.textDim}}>{filtered.length} registro{filtered.length!==1?"s":""}</span>
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {activeTab==="dashboard" && (
          <div className="ani">
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"repeat(2,1fr)":"repeat(4,1fr)",gap:14,marginBottom:24}}>
              {[
                {icon:"💰",label:"Total Faturado",value:money(kpis.total),sub:`${kpis.count} contratos`,color:T.green},
                {icon:"📋",label:"Ticket Médio",value:money(kpis.ticket),color:T.accent},
                {icon:"✅",label:"Taxa de Conclusão",value:`${kpis.taxa}%`,sub:`${kpis.byStatus.concluido} concluídos`,color:T.cyan},
                {icon:"⏱️",label:"Pendentes",value:kpis.byStatus.ligar+kpis.byStatus.enviar+kpis.byStatus.confirmar,sub:"requerem ação",color:kpis.byStatus.ligar>3?T.red:T.yellow},
              ].map((k,i)=>(
                <div key={i} style={{...card,borderLeft:`3px solid ${k.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:13,color:T.textMuted}}>{k.label}</div>
                      <div style={{fontSize:28,fontWeight:800,letterSpacing:"-.03em",color:k.color,lineHeight:1.1}}>{k.value}</div>
                      {k.sub && <div style={{fontSize:12,color:T.textDim,marginTop:6}}>{k.sub}</div>}
                    </div>
                    <div style={{fontSize:24,width:44,height:44,borderRadius:10,background:`${k.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>{k.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {bottleneck && (
              <div style={{...card,borderColor:`${bottleneck.color}50`,background:`${bottleneck.color}08`,marginBottom:20,padding:16,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>⚠️</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:bottleneck.color}}>Gargalo: {bottleneck.step}</div>
                  <div style={{fontSize:12,color:T.textMuted}}>{bottleneck.count} indicações aguardando</div>
                </div>
              </div>
            )}

            {/* PIPELINE */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>🔄 Funil de Conversão</div>
              <div style={{display:"flex",gap:isMobile?10:20,flexWrap:isMobile?"wrap":"nowrap"}}>
                {[
                  {label:"Total",count:kpis.count,color:T.accent,bg:T.accentGlow,icon:"📥"},
                  {label:"Ligar",count:kpis.byStatus.ligar,color:T.red,bg:T.redBg,icon:"📞"},
                  {label:"Enviar",count:kpis.byStatus.enviar,color:T.yellow,bg:T.yellowBg,icon:"🎁"},
                  {label:"Confirmar",count:kpis.byStatus.confirmar,color:T.blue,bg:T.blueBg,icon:"✅"},
                  {label:"Concluído",count:kpis.byStatus.concluido,color:T.green,bg:T.greenBg,icon:"🏁"},
                ].map((s,i,arr)=>(
                  <div key={i} style={{flex:1,minWidth:isMobile?"45%":130,position:"relative"}}>
                    <div style={{background:s.bg,border:`1px solid ${s.color}30`,borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                      <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.count}</div>
                      <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
                      <div style={{fontSize:10,color:T.textDim,marginTop:4,fontWeight:600}}>
                        {kpis.count?Math.round(s.count/kpis.count*100):0}%
                      </div>
                    </div>
                    {i<arr.length-1 && !isMobile && <div style={{position:"absolute",right:-14,top:"50%",transform:"translateY(-50%)",color:T.textDim,fontSize:16,fontWeight:700}}>→</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* CHARTS */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:24}}>
              <div style={card}>
                <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,marginBottom:12}}>📈 Faturamento Mensal</div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <defs><linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={.3}/><stop offset="100%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke={T.border} strokeDasharray="3 3"/>
                    <XAxis dataKey="label" tick={{fill:T.textDim,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:T.textDim,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e3).toFixed(0)}k`}/>
                    <Tooltip content={<ChartTooltip fmt={money}/>}/>
                    <Area type="monotone" dataKey="fat" stroke={T.accent} strokeWidth={2.5} fill="url(#gF)" name="Faturamento"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,marginBottom:12}}>🎯 Distribuição por Status</div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={[
                      {name:"Ligar",value:kpis.byStatus.ligar},{name:"Enviar",value:kpis.byStatus.enviar},
                      {name:"Confirmar",value:kpis.byStatus.confirmar},{name:"Concluído",value:kpis.byStatus.concluido},
                    ].filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {[T.red,T.yellow,T.blue,T.green].map((c,i)=><Cell key={i} fill={c} stroke="none"/>)}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={v=><span style={{color:T.textMuted,fontSize:11}}>{v}</span>}/>
                    <Tooltip contentStyle={{background:T.surfaceAlt,border:`1px solid ${T.borderLight}`,borderRadius:8,fontSize:12,color:T.text}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TEMPO MÉDIO */}
            <div style={card}>
              <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,marginBottom:12}}>⏱️ Tempo Médio entre Etapas (dias)</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:16}}>
                {[
                  {label:"Fechamento → Ligação",value:kpis.avgL,color:T.red},
                  {label:"Ligação → Envio",value:kpis.avgE,color:T.yellow},
                  {label:"Envio → Confirmação",value:kpis.avgC,color:T.blue},
                ].map((m,i)=>(
                  <div key={i} style={{background:T.surfaceAlt,borderRadius:10,padding:16,textAlign:"center",borderLeft:`3px solid ${m.color}`}}>
                    <div style={{fontSize:32,fontWeight:800,color:m.color}}>{m.value}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ OPERACIONAL ═══ */}
        {activeTab==="operacional" && (
          <div className="ani">
            <div style={{...card,padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto",maxHeight:600}}>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,fontSize:13}}>
                  <thead>
                    <tr>
                      <th style={th}>Paciente</th><th style={th}>Valor</th>
                      <th style={th}>Fechamento</th><th style={th}>Indicador</th>
                      <th style={th}>Status</th><th style={th}>Ação Rápida</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filtered.length ? (
                      <tr><td colSpan={7} style={{...td,textAlign:"center",padding:40,color:T.textDim}}>Nenhum registro</td></tr>
                    ) : (
                      filtered
                        .sort((a,b)=>{const o={ligar:0,enviar:1,confirmar:2,concluido:3}; return o[a.status]-o[b.status];})
                        .map((row,i)=>{
                          const si=STATUS_MAP[row.status];
                          const nextField = row.status==="ligar"?"data_ligacao_confirmacao":row.status==="enviar"?"data_envio_presente":row.status==="confirmar"?"data_confirmacao_recebimento":null;
                          return (
                            <tr key={row._rowIndex} style={{cursor:"pointer"}} onClick={()=>setSelectedRow(row)}>
                              <td style={{...td,color:T.text,fontWeight:600}}>{row.paciente_fechou}</td>
                              <td style={{...td,fontWeight:700,color:T.green}}>{money(row.valor_contrato)}</td>
                              <td style={td}>{fmtDate(row.data_fechamento)}</td>
                              <td style={{...td,fontSize:12}}>{row.paciente_indicador}</td>
                              <td style={td}><span style={badge(si.color,si.bg)}>{si.icon} {si.label}</span></td>
                              <td style={td} onClick={e=>e.stopPropagation()}>
                                {nextField ? (
                                  <button onClick={()=>handleQuickAction(row._rowIndex,nextField,today())} style={{
                                    padding:"5px 12px",borderRadius:6,border:"none",
                                    background:`${si.color}20`,color:si.color,
                                    fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
                                  }}>
                                    {si.icon} Marcar
                                  </button>
                                ) : <span style={{color:T.green,fontSize:11}}>✓ OK</span>}
                              </td>
                              <td style={{...td,width:60}} onClick={e=>e.stopPropagation()}>
                                <div style={{display:"flex",gap:4}}>
                                  <button onClick={()=>{setEditRow(row);setShowForm(true);}} style={{
                                    padding:"4px 8px",borderRadius:4,border:`1px solid ${T.border}`,
                                    background:"transparent",color:T.textMuted,fontSize:12,cursor:"pointer",
                                  }}>✏️</button>
                                  <button onClick={()=>handleDelete(row._rowIndex)} style={{
                                    padding:"4px 8px",borderRadius:4,border:`1px solid ${T.border}`,
                                    background:"transparent",color:T.red,fontSize:12,cursor:"pointer",
                                  }}>🗑</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ RANKING ═══ */}
        {activeTab==="ranking" && (
          <div className="ani" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            <div style={card}>
              <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,marginBottom:12}}>🏆 Ranking de Indicadores</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,fontSize:13}}>
                  <thead><tr>
                    <th style={th}>#</th><th style={th}>Indicador</th>
                    <th style={th}>Qtd</th><th style={th}>Faturamento</th><th style={th}>Ticket</th>
                  </tr></thead>
                  <tbody>
                    {ranking.map((r,i)=>(
                      <tr key={i} style={{background:i===0?T.accentGlow:"transparent"}}>
                        <td style={{...td,fontWeight:700,color:i<3?T.accent:T.textDim}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                        <td style={{...td,color:T.text,fontWeight:600}}>{r.nome}</td>
                        <td style={{...td,fontWeight:700}}>{r.count}</td>
                        <td style={{...td,fontWeight:700,color:T.green}}>{money(r.total)}</td>
                        <td style={td}>{money(r.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={card}>
              <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color:T.textDim,marginBottom:12}}>📊 Faturamento por Indicador</div>
              <ResponsiveContainer width="100%" height={Math.max(250,ranking.length*40)}>
                <BarChart data={ranking.slice(0,10)} layout="vertical" margin={{left:10}}>
                  <CartesianGrid stroke={T.border} strokeDasharray="3 3" horizontal={false}/>
                  <XAxis type="number" tick={{fill:T.textDim,fontSize:10}} tickFormatter={v=>`${(v/1e3).toFixed(0)}k`} axisLine={false}/>
                  <YAxis type="category" dataKey="nome" width={130} tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip fmt={money}/>}/>
                  <Bar dataKey="total" name="Faturamento" radius={[0,6,6,0]} maxBarSize={28}>
                    {ranking.slice(0,10).map((_,i)=><Cell key={i} fill={i===0?T.accent:i===1?T.purple:i===2?T.cyan:T.borderLight}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showForm && (
        <FormModal
          initialData={editRow}
          onSave={handleSave}
          onClose={()=>{setShowForm(false);setEditRow(null);}}
          saving={saving}
          indicadores={indicadores}
        />
      )}
      <DetailModal row={selectedRow} onClose={()=>setSelectedRow(null)} onAction={handleQuickAction} actionLoading={actionLoading} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  );
}
