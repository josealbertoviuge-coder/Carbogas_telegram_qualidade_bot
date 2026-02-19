import express from "express";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

// rota que o Telegram enviará mensagens
app.post(`/bot${TOKEN}`, async (req, res) => {
  console.log("Mensagem recebida:");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

// rota básica
app.get("/", (req, res) => {
  res.send("Bot online");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));
