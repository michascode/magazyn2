import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TParams = { id: string };

export async function POST(req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const bytes = Buffer.from(await (file as File).arrayBuffer());
  const uploadsDir = process.env.UPLOAD_DIR ?? "uploads";
  const absDir = path.join(process.cwd(), uploadsDir);
  await fs.mkdir(absDir, { recursive: true });

  const safeName = (file as File).name.replace(/\s+/g, "_");
  const fileName = `${id}_${Date.now()}_${safeName}`;
  const dest = path.join(absDir, fileName);
  await fs.writeFile(dest, bytes);

  const url = `/${uploadsDir}/${fileName}`;

  const created = await prisma.photo.create({
    data: {
      productId: id,
      url,
      isFront: false,
    },
  });

  return NextResponse.json(created, { status: 200 });
}
