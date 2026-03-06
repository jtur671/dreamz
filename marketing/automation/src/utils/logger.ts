const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export const log = {
  info: (tag: string, msg: string) => console.log(`[${timestamp()}] [${tag}] ${msg}`),
  ok: (tag: string, msg: string) => console.log(`[${timestamp()}] [${tag}] OK: ${msg}`),
  err: (tag: string, msg: string) => console.error(`[${timestamp()}] [${tag}] ERR: ${msg}`),
  warn: (tag: string, msg: string) => console.warn(`[${timestamp()}] [${tag}] WARN: ${msg}`),
};
