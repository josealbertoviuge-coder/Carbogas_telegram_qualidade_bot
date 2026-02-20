import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const pendentes = new Map();
const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

function gerarId() {
  return Math.random().toString(36).substring(2, 8);
}

async function removerBotoes(chatId, messageId) {
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] }
      })
    });
  } catch (err) {
    console.log("Erro ao remover botões:", err);
  }
}

function extrairTabela(texto) {
  const match = texto.match(/INCLUIR NA TABELA\s+([A-Z]+)/);
  return match ? match[1].toLowerCase() : null;
}

async function enviarConfirmacao(chatId, dados, tabela) {
  const id = gerarId();

  // salva temporariamente
  pendentes.set(id, { dados, tabela });
  setTimeout(() => pendentes.delete(id), 30 * 60 * 1000);

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        `📋 REGISTRO:\n\nTAG: ${dados.tag}\nOP: ${dados.op || "-"}\nOBS: ${dados.observacoes || "-"}\n\nOs dados estão corretos?`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ SIM", callback_data: `confirmar|${id}` },
            { text: "❌ NÃO", callback_data: `cancelar|${id}` }
          ]
        ]
      }
    })
  });
}

function normalizarTexto(texto) {
  const substituicoes = {
    "barra": "/",
    "traço": "-",
    "não aplicável": "N/A",
    "ponto": "."
  };

  texto = texto.toLowerCase();

  // substituições especiais
  Object.keys(substituicoes).forEach(palavra => {
    const regex = new RegExp(`\\b${palavra}\\b`, "gi");
    texto = texto.replace(regex, substituicoes[palavra]);
  });

  // remove dois pontos
texto = texto.replace(/:/g, "");
  
  // padronização de termos importantes
  texto = texto
    .replace(/\btag\b/gi, "TAG")
    .replace(/\bordem\b/gi, "ORDEM")
    .replace(/\bprodução\b/gi, "PRODUÇÃO")
    .replace(/\bobservações\b/gi, "OBSERVAÇÕES");
  
  texto = texto.toUpperCase();
  return texto;
}

function converterNumeros(texto) {
  const mapa = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    três: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9
  };

  Object.keys(mapa).forEach(palavra => {
    const regex = new RegExp(`\\b${palavra}\\b`, "gi");
    texto = texto.replace(regex, mapa[palavra]);
  });

  return texto;
}

function extrairCampos(texto) {
  const dados = {};

  const tag = texto.match(/\bTAG\s+([A-Z0-9\-]+)/);
  if (tag && tag[1]) {
    dados.tag = tag[1].trim();
  }

  const op = texto.match(/\b(?:ORDEM(?:\s+DE\s+PRODUÇÃO)?|OP)\s+([A-Z0-9\/\-]+)/);
  if (op && op[1]) {
    dados.op = op[1].trim();
  }

  const observacoes = texto.match(/\bOBSERVAÇÕES?\s+(.+)/);
  if (observacoes && observacoes[1]) {
    dados.observacoes = observacoes[1].trim();
  }

  return dados;
}

async function salvarSupabase(dados) {
  const resp = await fetch("https://weqlfktnorahxteiypul.supabase.co/rest/v1/tags", {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(dados)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt);
  }
}

async function enviarMensagem(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto
    })
  });
}

async function transcreverAudio(fileUrl) {
  const audioResp = await fetch(fileUrl);
  const buffer = await audioResp.arrayBuffer();

  const form = new FormData();
  form.append("file", Buffer.from(buffer), "audio.ogg");
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  form.append(
  "prompt",
  "Relatório de produção industrial em português do Brasil."
);

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_KEY}`
    },
    body: form
  });

  const data = await resp.json();

  console.log("Resposta OpenAI:", data);

return data.text || "";
}

app.post(`/bot${TOKEN}`, async (req, res) => {

// ✅ TRATAR CLIQUE DOS BOTÕES
if (req.body.callback_query) {
  const query = req.body.callback_query;
  const chatId = query.message.chat.id;
  const data = query.data;

  // remove loading do botão
try {
  await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: query.id })
  });
} catch {}

  // remove botões após clicar
  await removerBotoes(chatId, query.message.message_id);

  const [acao, id] = data.split("|");

  // ❌ CANCELAR
  if (acao === "cancelar") {
    pendentes.delete(id);
    await enviarMensagem(chatId, "❌ Registro cancelado.");
    return res.sendStatus(200);
  }

  // ✅ CONFIRMAR
  if (acao === "confirmar") {
    const registro = pendentes.get(id);

    if (!registro) {
      await enviarMensagem(chatId, "⚠️ Registro expirado.");
      return res.sendStatus(200);
    }

    try {
      await salvarSupabase(registro.dados);
    } catch (err) {
      console.log(err);
      await enviarMensagem(chatId, "Erro ao salvar no banco.");
      return res.sendStatus(200);
    }

    pendentes.delete(id);

    await enviarMensagem(chatId, "✅ Dados gravados com sucesso!");
    return res.sendStatus(200);
  }
}
  const msg = req.body.message;

  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;

if (msg.voice) {
  console.log("Áudio recebido!");

  await enviarMensagem(chatId, "🎧 ouvindo áudio...");

  const fileId = msg.voice.file_id;

  const fileInfo = await fetch(
    `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`
  ).then(r => r.json());

  const filePath = fileInfo.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

  console.log("URL do áudio:", fileUrl);

  // 🎤 TRANSCRIÇÃO
let texto;
try {
  texto = await transcreverAudio(fileUrl);
} catch (err) {
  console.log(err);
  await enviarMensagem(chatId, "Erro ao transcrever áudio.");
  return res.sendStatus(200);
}

  // aplica inteligência
  texto = normalizarTexto(texto);
  texto = converterNumeros(texto);

  const dados = extrairCampos(texto);
  console.log("Dados extraídos:", dados);

  // valida TAG
  if (!dados.tag) {
    await enviarMensagem(chatId, "⚠️ TAG não informada.");
    return res.sendStatus(200);
  }

  // identifica tabela falada
  const tabela = extrairTabela(texto);

  if (!tabela) {
    await enviarMensagem(chatId, "Diga: incluir na tabela TAGs");
    return res.sendStatus(200);
  }

  // envia confirmação com botões
  await enviarConfirmacao(chatId, dados, tabela);

  console.log("Texto processado:", texto);

  // ⚠️ para execução aqui e aguarda confirmação
  return res.sendStatus(200);
} else if (msg.text) {
  console.log("Texto:", msg.text);

  await enviarMensagem(chatId, "Recebi: " + msg.text);
}

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Bot online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));
