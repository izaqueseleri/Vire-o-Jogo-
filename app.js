const SUPABASE_URL = 'https://yiomclcnytuqwkrbchwe.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpb21jbGNueXR1cXdrcmJjaHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTUzMTAsImV4cCI6MjA5ODA5MTMxMH0.4P6vzDHmRXlvpwP7IEy8pz5fdEHVFlxnwXXs6EdDwxM'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)
let usuarioAtual = null
let dadosGastos = []
let dadosMetas = []

const frases = [
  'Cada real é uma escolha sobre como você usa sua vida.',
  'Não é sobre quanto você ganha. É sobre o que você faz com o que ganha.',
  'Cada real guardado hoje é uma preocupação a menos amanhã.',
  'A mudança não começa no banco. Começa na sua cabeça.',
  'Quitar uma dívida é reconquistar a sua liberdade.',
  'Pequenos progressos todo dia se transformam em grandes resultados.',
]
let fraseIdx = 0

function mudarTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('ativo'))
  document.getElementById('form-entrar').style.display = tab === 'entrar' ? 'flex' : 'none'
  document.getElementById('form-cadastrar').style.display = tab === 'cadastrar' ? 'flex' : 'none'
  document.querySelectorAll('.auth-tab')[tab === 'entrar' ? 0 : 1].classList.add('ativo')
}

async function cadastrar() {
  const nome = document.getElementById('nome-cad').value.trim()
  const email = document.getElementById('email-cad').value.trim()
  const senha = document.getElementById('senha-cad').value
  if (!nome || !email || !senha) return mostrarMsg('msg-auth', 'Preencha todos os campos.', 'erro')
  const { error } = await db.auth.signUp({ email, password: senha, options: { data: { nome } } })
  if (error) mostrarMsg('msg-auth', 'Erro: ' + error.message, 'erro')
  else mostrarMsg('msg-auth', '✅ Conta criada! Verifique seu e-mail.', 'sucesso')
}

async function entrar() {
  const email = document.getElementById('email-entrar').value.trim()
  const senha = document.getElementById('senha-entrar').value
  if (!email || !senha) return mostrarMsg('msg-auth', 'Preencha e-mail e senha.', 'erro')
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha })
  if (error) mostrarMsg('msg-auth', 'E-mail ou senha incorretos.', 'erro')
  else { usuarioAtual = data.user; abrirPainel() }
}

async function sair() {
  await db.auth.signOut()
  usuarioAtual = null
  document.getElementById('tela-auth').style.display = 'block'
  document.getElementById('tela-painel').style.display = 'none'
}

async function abrirPainel() {
  document.getElementById('tela-auth').style.display = 'none'
  document.getElementById('tela-painel').style.display = 'block'
  const nome = usuarioAtual.user_metadata?.nome || usuarioAtual.email.split('@')[0]
  document.getElementById('nome-usuario').textContent = nome
  await carregarDados()
  renderizarConquistas()
  renderizarMentor()
}

async function carregarDados() {
  const uid = usuarioAtual.id
  const mes = new Date().toISOString().slice(0, 7)
  const { data: perfil } = await db.from('perfis').select('renda').eq('user_id', uid).single()
  const renda = perfil?.renda || 0
  const { data: gastos } = await db.from('gastos').select('*').eq('user_id', uid).gte('criado_em', mes + '-01').order('criado_em', { ascending: false })
  dadosGastos = gastos || []
  const totalGastos = dadosGastos.reduce((s, g) => s + parseFloat(g.valor), 0)
  const disponivel = renda - totalGastos
  const pct = renda > 0 ? Math.min(100, Math.round(totalGastos / renda * 100)) : 0
  document.getElementById('renda-val').textContent = fmt(renda)
  document.getElementById('gastos-val').textContent = fmt(totalGastos)
  document.getElementById('saldo-disp').textContent = fmt(disponivel)
  document.getElementById('saldo-sub').textContent = `Gastou ${fmt(totalGastos)} de ${fmt(renda)}`
  document.getElementById('saldo-prog').style.width = pct + '%'
  document.getElementById('dash-gastos').textContent = fmt(totalGastos)
  document.getElementById('dash-sub').textContent = `de ${fmt(renda)} disponíveis`
  renderizarGastos()
  renderizarCats(renda)
  const { data: metas } = await db.from('metas').select('*').eq('user_id', uid)
  dadosMetas = metas || []
  renderizarMetas()
}

function renderizarGastos() {
  const el = document.getElementById('lista-gastos')
  if (!dadosGastos.length) { el.innerHTML = '<div class="vazio">Nenhum gasto registrado ainda!</div>'; return }
  const emojis = {'Alimentação':'🍽️','Transporte':'🚗','Moradia':'🏠','Saúde':'💊','Lazer':'🎮','Educação':'📚','Dívidas':'💳','Outros':'📦'}
  el.innerHTML = dadosGastos.slice(0, 10).map(g => `
    <div class="item-gasto">
      <div class="ig-emoji">${emojis[g.categoria]||'📦'}</div>
      <div class="ig-info"><div class="ig-desc">${g.descricao}</div><div class="ig-cat">${g.categoria}</div></div>
      <div class="ig-valor">- ${fmt(g.valor)}</div>
    </div>`).join('')
}

function renderizarCats(renda) {
  const el = document.getElementById('cats-chart')
  const cats = {}
  dadosGastos.forEach(g => { cats[g.categoria] = (cats[g.categoria]||0) + parseFloat(g.valor) })
  if (!Object.keys(cats).length) { el.innerHTML = '<div class="vazio">Nenhum gasto registrado</div>'; return }
  const max = Math.max(...Object.values(cats))
  el.innerHTML = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([nome, val]) => `
    <div class="cat-item">
      <div class="cat-header"><span class="cat-nome">${nome}</span><span class="cat-valor">${fmt(val)}</span></div>
      <div class="cat-bg"><div class="cat-fill" style="width:${Math.round(val/max*100)}%"></div></div>
    </div>`).join('')
}

function renderizarMetas() {
  const el = document.getElementById('lista-metas')
  if (!dadosMetas.length) { el.innerHTML = '<div class="vazio">Nenhuma meta criada ainda!</div>'; return }
  el.innerHTML = dadosMetas.map(m => {
    const pct = Math.min(100, Math.round(m.atual / m.valor_alvo * 100))
    return `<div class="meta-item">
      <div class="meta-header"><span class="meta-nome">${m.nome}</span><span class="meta-pct">${pct}%</span></div>
      <div class="meta-bg"><div class="meta-fill" style="width:${pct}%"></div></div>
      <div class="meta-vals">${fmt(m.atual)} de ${fmt(m.valor_alvo)}</div>
    </div>`}).join('')
}

function renderizarConquistas() {
  const medalhas = [
    {emoji:'🎯', nome:'Primeiro passo', desc:'Fez seu cadastro', desbloqueada:true},
    {emoji:'🔥', nome:'7 dias', desc:'7 dias seguidos', desbloqueada:dadosGastos.length>=7},
    {emoji:'💰', nome:'Economia', desc:'Primeiro gasto registrado', desbloqueada:dadosGastos.length>0},
    {emoji:'🏆', nome:'Meta criada', desc:'Criou uma meta', desbloqueada:dadosMetas.length>0},
    {emoji:'⭐', nome:'30 dias', desc:'30 dias no controle', desbloqueada:false},
    {emoji:'👑', nome:'Dívida zerada', desc:'Quitou uma dívida', desbloqueada:false},
  ]
  document.getElementById('medalhas-grid').innerHTML = medalhas.map(m => `
    <div class="medalha">
      <div class="medalha-circle ${m.desbloqueada ? (m.emoji==='🎯'||m.emoji==='🔥' ? 'ouro' : 'verde') : 'bloq'}">${m.emoji}</div>
      <div class="medalha-nome">${m.nome}</div>
    </div>`).join('')
  document.getElementById('streak-val').textContent = dadosGastos.length + ' registros'
  const missoes = [
    {emoji:'🚗', nome:'3 dias sem delivery', prog:66},
    {emoji:'💰', nome:'Guardar R$50', prog:40},
    {emoji:'📊', nome:'Registrar todos os gastos', prog:80},
  ]
  document.getElementById('missoes-list').innerHTML = missoes.map(m => `
    <div class="missao-item">
      <div class="missao-icon">${m.emoji}</div>
      <div class="missao-info">
        <div class="missao-nome">${m.nome}</div>
        <div class="missao-prog"><div class="missao-fill" style="width:${m.prog}%"></div></div>
      </div>
      <span style="font-size:11px;color:var(--verde);font-weight:600">${m.prog}%</span>
    </div>`).join('')
}

function renderizarMentor() {
  const insights = [
    {icon:'ti-bulb', txt:'Registre seus gastos todos os dias para ter uma visão clara das suas finanças.'},
    {icon:'ti-target', txt:'Defina metas claras e acompanhe seu progresso regularmente.'},
    {icon:'ti-heart', txt:'Cada pequena economia conta. Você está no caminho certo!'},
  ]
  document.getElementById('insights-list').innerHTML = insights.map(i => `
    <div class="insight-item"><i class="ti ${i.icon}"></i><p>${i.txt}</p></div>`).join('')
  document.getElementById('frase-texto').textContent = frases[fraseIdx]
}

function proximaFrase() {
  fraseIdx = (fraseIdx + 1) % frases.length
  document.getElementById('frase-texto').textContent = frases[fraseIdx]
}

function responderPergunta(resp) {
  const msgs = {
    'Sim': '✅ Ótimo! Continue assim!',
    'Mais ou menos': '📊 Vamos ajustar seu planejamento juntos.',
    'Não': '💪 Tudo bem! O próximo mês será melhor. Vamos planejar!'
  }
  mostrarMsg('resp-pergunta', msgs[resp], 'sucesso')
}

async function lancarGasto() {
  const desc = document.getElementById('desc-gasto').value.trim()
  const valor = parseFloat(document.getElementById('valor-gasto').value)
  const categoria = document.getElementById('cat-gasto').value
  if (!desc || !valor || valor <= 0) return mostrarMsg('msg-painel', 'Preencha descrição e valor.', 'erro')
  const { error } = await db.from('gastos').insert({ user_id: usuarioAtual.id, descricao: desc, valor, categoria, criado_em: new Date().toISOString() })
  if (error) mostrarMsg('msg-painel', 'Erro ao salvar: ' + error.message, 'erro')
  else {
    document.getElementById('desc-gasto').value = ''
    document.getElementById('valor-gasto').value = ''
    mostrarMsg('msg-painel', '✅ Gasto registrado!', 'sucesso')
    await carregarDados()
  }
}

async function salvarRenda() {
  const renda = parseFloat(document.getElementById('renda-input').value)
  if (!renda || renda <= 0) return mostrarMsg('msg-painel', 'Digite sua renda.', 'erro')
  const { error } = await db.from('perfis').upsert({ user_id: usuarioAtual.id, renda }, { onConflict: 'user_id' })
  if (error) mostrarMsg('msg-painel', 'Erro: ' + error.message, 'erro')
  else { mostrarMsg('msg-painel', '✅ Renda salva!', 'sucesso'); await carregarDados() }
}

async function adicionarMeta() {
  const nome = document.getElementById('meta-nome').value.trim()
  const valor_alvo = parseFloat(document.getElementById('meta-valor').value)
  const atual = parseFloat(document.getElementById('meta-atual').value) || 0
  if (!nome || !valor_alvo) return mostrarMsg('msg-metas', 'Preencha nome e valor.', 'erro')
  const { error } = await db.from('metas').insert({ user_id: usuarioAtual.id, nome, valor_alvo, atual })
  if (error) mostrarMsg('msg-metas', 'Erro: ' + error.message, 'erro')
  else {
    document.getElementById('meta-nome').value = ''
    document.getElementById('meta-valor').value = ''
    document.getElementById('meta-atual').value = ''
    mostrarMsg('msg-metas', '✅ Meta criada!', 'sucesso')
    await carregarDados()
  }
}

function mostrarAba(aba) {
  document.querySelectorAll('.aba-content').forEach(a => a.style.display = 'none')
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'))
  document.getElementById('aba-' + aba).style.display = 'block'
  const idx = ['inicio','gastos','metas','conquistas','mentor'].indexOf(aba)
  document.querySelectorAll('.nav-btn')[idx]?.classList.add('ativo')
}

function fmt(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0) }
function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id)
  el.textContent = texto; el.className = 'msg ' + tipo
  setTimeout(()=>{ el.textContent=''; el.className='msg' }, 4000)
}

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) { usuarioAtual = session.user; abrirPainel() }
})
