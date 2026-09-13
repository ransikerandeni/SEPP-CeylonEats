import 'dotenv/config';
import { app } from './app';
import { pool } from './db';
const port=Number(process.env.PORT||3001);
await pool.query('SELECT 1');
const server=app.listen(port,'127.0.0.1',()=>console.log(`API ready at http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{pool.end().then(()=>process.exit(0));}));
