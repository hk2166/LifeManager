import express from 'express';
import cors from 'cors';
import { PORT } from './config';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`api on http://localhost:${PORT}`));
