import './env.js';

import { createApp } from './app.factory.js';

const app = await createApp();
const port = Number(process.env.PORT ?? 3001);
await app.listen(port, '0.0.0.0'); // 0.0.0.0 so phones on the same Wi-Fi can reach it
console.log(`BrainBox API ready on http://localhost:${port}`);
