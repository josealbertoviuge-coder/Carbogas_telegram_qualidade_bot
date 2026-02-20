import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

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

  const OP = texto.match(/\b(?:ORDEM(?:\s+DE\s+PRODUÇÃO)?|OP)\s+([A-Z0-9\/\-]+)/);
  if (OP && OP[1]) {
    dados.OP = OP[1].trim();
  }

  const observacoes = texto.match(/\bOBSERVAÇÕES?\s+(.+)/);
  if (observacoes && observacoes[1]) {
    dados.observacoes = observacoes[1].trim();
  }

  return dados;
}

async function salvarSupabase(dados) {
  await fetch("https://weqlfktnorahxteiypul.supabase.co/rest/v1/tags", {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(dados)
  });
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

  return data.text;
}

app.post(`/bot${TOKEN}`, async (req, res) => {
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
let texto = await transcreverAudio(fileUrl);

// aplica inteligência
texto = normalizarTexto(texto);
texto = converterNumeros(texto);
const dados = extrairCampos(texto);
console.log("Dados extraídos:", dados);

// ❗ não salvar se não houver TAG
if (!dados.tag) {
  await enviarMensagem(chatId, "⚠️ TAG não informada.");
  return res.sendStatus(200);
}

// salva apenas se válido
await salvarSupabase(dados);

console.log("Texto processado:", texto);

  if (texto) {
await enviarMensagem(
  chatId,
  "📋 REGISTRO:\n" + JSON.stringify(dados, null, 2)
);
  } else {
    await enviarMensagem(chatId, "Não consegui entender o áudio.");
  }
} else if (msg.text) {
  console.log("Texto:", msg.text);

  await enviarMensagem(chatId, "Recebi: " + msg.text);
}

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Bot online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));
