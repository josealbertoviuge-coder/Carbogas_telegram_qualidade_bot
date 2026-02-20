import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

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
  form.append("model", "whisper-1");

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
  const texto = await transcreverAudio(fileUrl);

  if (texto) {
    await enviarMensagem(chatId, "📝 Transcrição:\n" + texto);
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
