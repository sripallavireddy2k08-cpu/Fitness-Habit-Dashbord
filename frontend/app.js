const $ = (selector) => document.querySelector(selector);
const state = { token: sessionStorage.getItem("hf_token"), user: null, habits: [], todayLogs: [], page: "overview", authMode: "login" };
const icons = { Movement: "↗", Strength: "✦", Hydration: "◌", Mindfulness: "☼", Sleep: "☾", Nutrition: "✳", Other: "◉" };
const today = () => new Date().toLocaleDateString("en-CA");
const dateText = (value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
async function api(path, options = {}) {
  const headers = { "Content-Type":"application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try { response = await fetch(`/api${path}`, { ...options, headers }); }
  catch { throw new Error("Could not reach the server. Check that the backend is running."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) signOut(false);
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
function toast(message) { const node=$("#toast"); node.textContent=message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>node.classList.remove("show"),2800); }
function setMessage(node,message=""){ node.textContent=message; }
function safeText(tag,text,className=""){ const node=document.createElement(tag); node.textContent=text ?? ""; if(className)node.className=className; return node; }
function setAuthMode(mode) {
  state.authMode=mode; const register=mode==="register";
  $("#loginTab").classList.toggle("active",!register); $("#registerTab").classList.toggle("active",register);
  $("#authTitle").textContent=register?"Create your account":"Welcome back";
  $("#authSubtitle").textContent=register?"A few details, then you're ready to begin.":"Sign in to pick up where you left off.";
  $("#authEyebrow").textContent=register?"YOUR ROUTINE STARTS HERE":"YOUR PERSONAL WELLNESS SPACE";
  $("#authName").hidden=!register; $("#nameLabel").hidden=!register; $("#authName").required=register;
  $("#authPassword").autocomplete=register?"new-password":"current-password";
  $("#authSubmit").innerHTML=register?'Create account <span>→</span>':'Sign in <span>→</span>';
  setMessage($("#authMessage"));
}
$("#loginTab").addEventListener("click",()=>setAuthMode("login"));
$("#registerTab").addEventListener("click",()=>setAuthMode("register"));
$("#authForm").addEventListener("submit",async event=>{
  event.preventDefault(); const button=$("#authSubmit"); button.disabled=true; setMessage($("#authMessage"));
  const body={email:$("#authEmail").value.trim(),password:$("#authPassword").value};
  if(state.authMode==="register") body.name=$("#authName").value.trim();
  try {
    const result=await api(`/auth/${state.authMode}`,{method:"POST",body:JSON.stringify(body)});
    state.token=result.token;state.user=result.user;sessionStorage.setItem("hf_token",state.token);
    $("#authForm").reset(); await showApp();
  } catch(error){setMessage($("#authMessage"),error.message);}
  finally{button.disabled=false;}
});
function signOut(show=true){state.token=null;state.user=null;state.habits=[];state.todayLogs=[];sessionStorage.removeItem("hf_token");$("#appView").hidden=true;$("#authView").hidden=false;setAuthMode("login");if(show)toast("You've signed out.");}
$("#logoutBtn").addEventListener("click",()=>signOut());
async function showApp(){
  $("#authView").hidden=true;$("#appView").hidden=false;
  $("#profileName").textContent=state.user.name;$("#profileEmail").textContent=state.user.email;$("#avatar").textContent=(state.user.name[0]||"H").toUpperCase();
  const now=new Date();$("#todayText").textContent=now.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  $("#dateLabel").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
  const hour=now.getHours();$("#pageTitle").innerHTML=`${hour<12?"Good morning":hour<18?"Good afternoon":"Good evening"}<span class="period">.</span>`;
  try{await refreshData();}catch(error){showNotice(error.message);}
}
async function refreshData(){const result=await api("/habits");state.habits=result.habits;const logs=await api(`/logs?date=${today()}`);state.todayLogs=logs.logs;renderAll();}
function showNotice(message){const node=$("#globalMessage");node.textContent=message;node.hidden=false;}
function clearNotice(){$("#globalMessage").hidden=true;}
function isDone(habitId,date=today()){return state.todayLogs.some(log=>log.habit_id===habitId&&log.log_date===date&&log.completed);}
function setPage(page){
  state.page=page;["overview","habits","history"].forEach(name=>{$(`#${name}Page`).hidden=name!==page;document.querySelector(`[data-page="${name}"]`).classList.toggle("active",name===page);});
  $("#pageTitle").innerHTML=({overview:`${new Date().getHours()<12?"Good morning":new Date().getHours()<18?"Good afternoon":"Good evening"}<span class="period">.</span>`,habits:'My habits<span class="period">.</span>',history:'Activity history<span class="period">.</span>'})[page];
  if(page==="history")loadHistory();
}
document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.goto)));
function renderAll(){clearNotice();renderOverview();renderHabits();}
function renderOverview(){
  const active=state.habits.filter(h=>!h.archived_at),done=active.filter(h=>isDone(h.id)).length;
  $("#completedStat").textContent=done;$("#totalToday").textContent=`of ${active.length} habits`;$("#activeStat").textContent=active.length;
  $("#dailyProgress").style.width=active.length?`${done/active.length*100}%`:"0%";$("#routineCount").textContent=active.length;
  $("#overviewEmpty").hidden=active.length!==0;$("#todayHabits").hidden=active.length===0;$("#todayHabits").replaceChildren();
  active.forEach(habit=>$("#todayHabits").append(makeHabitRow(habit,true)));
  const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);
  api(`/logs?from=${weekStart.toLocaleDateString("en-CA")}&to=${today()}`).then(r=>{$("#weekStat").textContent=r.logs.filter(l=>l.completed).length;}).catch(()=>{$("#weekStat").textContent="—";});
}
function makeHabitRow(habit,showCheck){
  const row=document.createElement("article");row.className="habit-row";
  const icon=safeText("div",icons[habit.category]||"◉",`habit-icon ${habit.color||"mint"}`);
  const info=document.createElement("div");info.className="habit-info";info.append(safeText("strong",habit.name));
  const meta=document.createElement("div");meta.className="habit-meta";meta.append(safeText("span",habit.category,"tag"));if(habit.target)meta.append(safeText("span",habit.target,"habit-target"));info.append(meta);
  row.append(icon,info);
  if(showCheck){const done=isDone(habit.id);const button=safeText("button",done?"✓":"");button.type="button";button.className=`check-btn ${done?"done":""}`;button.setAttribute("aria-label",`${done?"Mark incomplete":"Mark complete"}: ${habit.name}`);button.addEventListener("click",()=>toggleLog(habit.id,!done));row.append(button);}
  return row;
}
async function toggleLog(id,completed){
  try{const result=await api(`/habits/${id}/check-in`,{method:"POST",body:JSON.stringify({date:today(),completed})});
    state.todayLogs=state.todayLogs.filter(log=>!(log.habit_id===id&&log.log_date===today()));state.todayLogs.push(result.log);
    renderAll();toast(completed?"Habit completed — nice work!":"Check-in updated.");
  }catch(error){toast(error.message);}
}
function renderHabits(){
  const query=$("#habitSearch").value.trim().toLowerCase(),filter=$("#habitFilter").value;
  const items=state.habits.filter(h=>(filter==="all"||(filter==="archived"?!!h.archived_at:!h.archived_at))&&h.name.toLowerCase().includes(query));
  $("#allHabits").replaceChildren();$("#habitsEmpty").hidden=items.length>0;
  items.forEach(h=>{
    const card=document.createElement("article");card.className="habit-card";
    const top=document.createElement("div");top.className="habit-card-top";top.append(safeText("div",icons[h.category]||"◉",`habit-icon ${h.color||"mint"}`));
    const info=document.createElement("div");info.className="habit-info";info.append(safeText("strong",h.name));info.append(safeText("span",h.category,"habit-meta"));top.append(info);
    const menu=safeText("button","⋯","icon-btn");menu.type="button";menu.setAttribute("aria-label",`Edit ${h.name}`);menu.addEventListener("click",()=>openHabitDialog(h));top.append(menu);card.append(top);
    card.append(safeText("p",h.target||"No daily target set","card-description"));
    const footer=document.createElement("div");footer.className="card-footer";footer.append(safeText("span",h.archived_at?"Archived":"Active",`status-label ${h.archived_at?"archived":""}`));
    const actions=document.createElement("div");actions.className="card-actions";
    const edit=safeText("button","Edit","small-btn");edit.type="button";edit.addEventListener("click",()=>openHabitDialog(h));actions.append(edit);
    const archive=safeText("button",h.archived_at?"Restore":"Archive","small-btn");archive.type="button";archive.addEventListener("click",()=>archiveHabit(h));actions.append(archive);
    const remove=safeText("button","Delete","small-btn");remove.type="button";remove.addEventListener("click",()=>deleteHabit(h));actions.append(remove);
    footer.append(actions);card.append(footer);$("#allHabits").append(card);
  });
}
$("#habitSearch").addEventListener("input",renderHabits);$("#habitFilter").addEventListener("change",renderHabits);
function openHabitDialog(habit=null){
  $("#habitForm").reset();setMessage($("#habitMessage"));$("#habitId").value=habit?.id||"";
  $("#dialogTitle").textContent=habit?"Edit habit":"Create a habit";$("#habitName").value=habit?.name||"";$("#habitCategory").value=habit?.category||"Movement";$("#habitTarget").value=habit?.target||"";$("#habitColor").value=habit?.color||"mint";$("#habitDialog").showModal();$("#habitName").focus();
}
$("#topAddBtn").addEventListener("click",()=>openHabitDialog());$("#habitsAddBtn").addEventListener("click",()=>openHabitDialog());$("#emptyAddBtn").addEventListener("click",()=>openHabitDialog());
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>$("#habitDialog").close()));
$("#habitForm").addEventListener("submit",async event=>{
  event.preventDefault();const id=$("#habitId").value;const body={name:$("#habitName").value.trim(),category:$("#habitCategory").value,target:$("#habitTarget").value.trim(),color:$("#habitColor").value};
  const button=$("#saveHabitBtn");button.disabled=true;setMessage($("#habitMessage"));
  try{await api(id?`/habits/${id}`:"/habits",{method:id?"PATCH":"POST",body:JSON.stringify(body)});$("#habitDialog").close();await refreshData();toast(id?"Habit updated.":"Habit created.");}
  catch(error){setMessage($("#habitMessage"),error.message);}
  finally{button.disabled=false;}
});
async function archiveHabit(h){
  try{await api(`/habits/${h.id}`,{method:"PATCH",body:JSON.stringify({archived:!h.archived_at})});await refreshData();toast(h.archived_at?"Habit restored.":"Habit archived.");}
  catch(error){toast(error.message);}
}
async function deleteHabit(h){
  if(!confirm(`Delete "${h.name}" and its check-in history? This cannot be undone.`))return;
  try{await api(`/habits/${h.id}`,{method:"DELETE"});await refreshData();toast("Habit deleted.");}
  catch(error){toast(error.message);}
}
$("#historyDate").value=today();$("#historyDate").addEventListener("change",loadHistory);
async function loadHistory(){
  const date=$("#historyDate").value||today();
  try{
    const result=await api(`/logs?date=${encodeURIComponent(date)}`);const logs=result.logs;
    const active=state.habits.filter(h=>!h.archived_at);const completed=logs.filter(l=>l.completed).length;
    $("#historyCount").textContent=`${completed} / ${active.length}`;
    $("#historyList").replaceChildren();
    if(!active.length){$("#historyList").append(safeText("p","Create a habit to start building your history.","muted"));return;}
    active.forEach(h=>{const log=logs.find(l=>l.habit_id===h.id);const row=makeHabitRow(h,false);row.className="history-item";row.append(safeText("span",log?.completed?"Completed":"Not yet",`history-state ${log?.completed?"done":"missed"}`));$("#historyList").append(row);});
  }catch(error){showNotice(error.message);}
}
(async()=>{if(state.token){try{const result=await api("/auth/me");state.user=result.user;await showApp();}catch{signOut(false);}}})();
