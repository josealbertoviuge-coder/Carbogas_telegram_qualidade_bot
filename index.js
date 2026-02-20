import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

function normalizarTexto(texto) {
  const substituicoes = {
    "barra": "/",
    "dois pontos": ":",
    "vírgula": ",",
    "traço": "-",
    "ponto": "."
  };

  texto = texto.toLowerCase();

  // substituições especiais
  Object.keys(substituicoes).forEach(palavra => {
    const regex = new RegExp(`\\b${palavra}\\b`, "gi");
    texto = texto.replace(regex, substituicoes[palavra]);
  });

  // padronização de termos importantes
  texto = texto
    .replace(/\btag\b/gi, "TAG")
    .replace(/\bordem\b/gi, "ORDEM")
    .replace(/\bprodução\b/gi, "PRODUÇÃO")
    .replace(/\bobservação\b/gi, "OBSERVAÇÃO");

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

console.log("Texto processado:", texto);

  if (texto) {
    await enviarMensagem(chatId, "📝 Registro:\n" + texto);
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
