import express from "express";
import fetch from "node-fetch";

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

app.post(`/bot${TOKEN}`, async (req, res) => {
  const msg = req.body.message;

  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;

if (msg.voice) {
  console.log("Áudio recebido!");

  await enviarMensagem(chatId, "🎤 Áudio recebido!");
  const fileId = msg.voice.file_id;

// obter caminho do arquivo
const fileInfo = await fetch(
  `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`
).then(r => r.json());

const filePath = fileInfo.result.file_path;

const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

console.log("URL do áudio:", fileUrl);

} else if (msg.text) {
  console.log("Texto:", msg.text);

  await enviarMensagem(chatId, "Recebi: " + msg.text);
}

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Bot online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));
