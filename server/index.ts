import { app } from './app.ts';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Brilliant Budget Backend running on http://localhost:${PORT}`);
});
