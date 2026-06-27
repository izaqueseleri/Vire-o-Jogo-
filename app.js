const SUPABASE_URL = 'https://yiomclcnytuqwkrbchwe.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpb21jbGNueXR1cXdrcmJjaHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTUzMTAsImV4cCI6MjA5ODA5MTMxMH0.4P6vzDHmRXlvpwP7IEy8pz5fdEHVFlxnwXXs6EdDwxM'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

let usuarioAtual = null

// ─── AUTENTICAÇÃO ───────────────────────────────────────
function mudarTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('ativo'))
  document.getElementById('form-entrar').style.display = tab === 'entrar' ? 'flex' : 'none'
  document.getElementById('form-cadastrar').style.display = tab === 'cadastrar' ? 'flex' : 'none'
  document.querySelectorAll('.auth-tab')[tab === 'entrar' ? 0 : 1].classList.add('ativo')
  document.getElementById('form-entrar').style.flexDirection = 'column'
  document.getElementById('form-entrar').style.gap = '10px'
  document.getElementById('form-cadastrar').style.flexDirection = 'column'
  document.getElementById('form-cadastrar').style.gap = '10px'
}

async function cadastrar() {
  const nome = document.getElementById('nome-cad').value.trim()
  const email = document.getElementById('email-cad').value.trim()
  const senha = document.getElementById('senha-cad').value
  const msg = document.getElementById('msg-auth')

  if (!nome || !email || !senha) {
    mostrarMsg('msg-auth', 'Preencha todos os campos.', 'erro')
    return
  }

  const { data, error } = await db.auth.signUp({
    email, password: senha,
    options: { data: { nome } }
  })

  if (error) {
    mostrarMsg('msg-auth', 'Erro: ' + error.message, 'erro')
  } else {
    mostrarMsg('msg-auth', 'Conta criada! Verifique seu e-mail.', 'sucesso')
  }
}

async function entrar() {
  const email = document.getElementById('email-entrar').value.trim()
  const senha = document.getElementById('senha-entrar').value
  const msg = document.getElementById('msg-auth')

  if (!email || !senha) {
    mostrarMsg('msg-auth', 'Preencha e-mail e senha.', 'erro')
    return
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password: senha })

  if (error) {
    mostrarMsg('msg-auth', 'E-mail ou senha incorretos.', 'erro')
  } else {
    usuarioAtual = data.user
    abrirPainel()
  }
}

async function sair() {
  await db.auth.signOut()
  usuarioAtual = null
  document.getElementById('tela-auth').style.display = 'block'
  document.getElementById('tela-painel').style.display = 'none'
}

// ─── PAINEL ─────────────────────────────────────────────
async function abrirPainel() {
  document.getElementById('tela-auth').style.display = 'none'
  document.getElementById('tela-painel').style.display = 'block'

  const nome = usuarioAtual.user_metadata?.nome || usuarioAtual.email.split('@')[0]
  document.getElementById('nome-usuario').textContent = nome

  await carregarDados()
}

async function carregarDados() {
  const userId = usuarioAtual.id
  const mes = new Date().toISOString().slice(0, 7)

  // Busca perfil (renda)
  const { data: perfil } = await db.from('perfis').select('renda').eq('user_id', userId).single()
  const renda = perfil?.renda || 0

  // Busca gastos do mês
  const { data: gastos } = await db.from('gastos')
    .select('*')
    .eq('user_id', userId)
    .gte('criado_em', mes + '-01')
    .order('criado_em', { ascending: false })

  const totalGastos = (gastos || []).reduce((s, g) => s + parseFloat(g.valor), 0)
  const disponivel = renda - totalGastos

  document.getElementById('renda-val').textContent = formatarReais(renda)
  document.getElementById('gastos-val').textContent = formatarReais(totalGastos)
  document.getElementById('saldo-disp').textContent = formatarReais(disponivel)
  document.getElementById('saldo-sub').textContent = `Gastou ${formatarReais(totalGastos)} de ${formatarReais(renda)}`

  renderizarGastos(gastos || [])
}

function renderizarGastos(gastos) {
  const lista = document.getElementById('lista-gastos')
  if (gastos.length === 0) {
    lista.innerHTML = '<div class="vazio">Nenhum gasto registrado ainda. Comece agora!</div>'
    return
  }
  const emojis = { 'Alimentação':'🍽️','Transporte':'🚗','Moradia':'🏠','Saúde':'💊','Lazer':'🎮','Educação':'📚','Dívidas':'💳','Outros':'📦' }
  lista.innerHTML = gastos.map(g => `
    <div class="item-gasto">
      <div class="ig-cat">${emojis[g.categoria] || '📦'}</div>
      <div class="ig-info">
        <div class="ig-desc">${g.descricao}</div>
        <div class="ig-cat-nome">${g.categoria}</div>
      </div>
      <div class="ig-valor">- ${formatarReais(g.valor)}</div>
    </div>
  `).join('')
}

async function lancarGasto() {
  const desc = document.getElementById('desc-gasto').value.trim()
  const valor = parseFloat(document.getElementById('valor-gasto').value)
  const categoria = document.getElementById('cat-gasto').value

  if (!desc || !valor || valor <= 0) {
    mostrarMsg('msg-painel', 'Preencha descrição e valor.', 'erro')
    return
  }

  const { error } = await db.from('gastos').insert({
    user_id: usuarioAtual.id,
    descricao: desc,
    valor: valor,
    categoria: categoria,
    criado_em: new Date().toISOString()
  })

  if (error) {
    mostrarMsg('msg-painel', 'Erro ao salvar gasto.', 'erro')
  } else {
    document.getElementById('desc-gasto').value = ''
    document.getElementById('valor-gasto').value = ''
    mostrarMsg('msg-painel', '✅ Gasto registrado com sucesso!', 'sucesso')
    await carregarDados()
  }
}

async function salvarRenda() {
  const renda = parseFloat(document.getElementById('renda-input').value)
  if (!renda || renda <= 0) {
    mostrarMsg('msg-painel', 'Digite sua renda mensal.', 'erro')
    return
  }

  const { error } = await db.from('perfis').upsert({
    user_id: usuarioAtual.id,
    renda: renda
  }, { onConflict: 'user_id' })

  if (error) {
    mostrarMsg('msg-painel', 'Erro ao salvar renda.', 'erro')
  } else {
    mostrarMsg('msg-painel', '✅ Renda salva com sucesso!', 'sucesso')
    await carregarDados()
  }
}

// ─── UTILITÁRIOS ─────────────────────────────────────────
function formatarReais(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
}

function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id)
  el.textContent = texto
  el.className = 'msg ' + tipo
  setTimeout(() => { el.textContent = ''; el.className = 'msg' }, 4000)
}

// ─── INICIALIZAÇÃO ───────────────────────────────────────
document.getElementById('form-entrar').style.display = 'flex'
document.getElementById('form-entrar').style.flexDirection = 'column'
document.getElementById('form-entrar').style.gap = '10px'
document.getElementById('form-cadastrar').style.display = 'none'

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    usuarioAtual = session.user
    abrirPainel()
  }
})
