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

app.post(`/bot${8294267757:AAG6F4Lp0ivlxZxWfp7O2xApWuFuyAyUBy0}`, async (req, res) => {
  const msg = req.body.message;

  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;

  if (msg.text) {
    console.log("Texto:", msg.text);

    await enviarMensagem(chatId, "Recebi: " + msg.text);
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Bot online"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));
