import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await ctx.params;
    const rel = segments?.join("/") ?? "";
    const safeRel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/g, "");
    const abs = path.join(process.cwd(), "uploads", safeRel);

    const data = await fs.readFile(abs);

    const ext = path.extname(abs).toLowerCase();
    const types: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const ct = types[ext] ?? "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
