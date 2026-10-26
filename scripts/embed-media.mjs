// 把 story.src.json 里的 @media/xxx 占位符替换为内嵌 data URL，输出 story.json。
// 运行：node scripts/embed-media.mjs [src] [out]
// 故事正文只改 story.src.json；换图片时重跑本脚本即可，不需要手写 base64。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const src = resolve(
  process.argv[2] || "stories/template/story.src.json",
);
const out = resolve(process.argv[3] || "stories/template/story.json");
const mediaDir = join(dirname(src), "media");

// 与 src/schema.ts 的 safeMedia 保持一致：只允许这几种内嵌图片格式
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const cache = new Map();
async function toDataUrl(name) {
  if (cache.has(name)) return cache.get(name);
  const file = join(mediaDir, name);
  const ext = extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime)
    throw new Error(`不支持的媒体格式 ${ext}（${name}），仅支持 ${Object.keys(MIME).join(" ")}`);
  const buf = await readFile(file);
  const url = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(name, url);
  console.log(`  ${name} -> ${mime} ${(buf.length / 1024).toFixed(1)}KB`);
  return url;
}

async function walk(node) {
  if (typeof node === "string") {
    const m = /^@media\/(.+)$/.exec(node);
    return m ? await toDataUrl(m[1]) : node;
  }
  if (Array.isArray(node)) return Promise.all(node.map(walk));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = await walk(v);
    return out;
  }
  return node;
}

const raw = JSON.parse(await readFile(src, "utf8"));
console.log("内嵌媒体：");
const story = await walk(raw);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(story, null, 2) + "\n");
console.log(`已写入 ${out}`);
