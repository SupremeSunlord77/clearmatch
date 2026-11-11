import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`ClearMatch server listening on http://localhost:${port}`);
});
