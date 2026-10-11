// A port the operating system says is free right now. Test files run in parallel, and random picks from
// overlapping ranges collided now and then (EADDRINUSE in CI); asking the OS does not.
import net from 'node:net';

export const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.unref();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
