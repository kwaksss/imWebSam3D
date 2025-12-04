export const runtime = "nodejs";

import crypto from "crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    // -------- Body 읽기 --------
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body || "{}");

    const imageUrl = data.imageUrl;
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl missing" });
    }

    const API_KEY = process.env.MESHY_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Meshy API Key missing" });
    }

    // -------- 0) 이미지 해시 기반 파일명 생성 --------
    const hash = crypto.createHash("sha256").update(imageUrl).digest("hex");
    const bucketName = process.env.AWS_BUCKET_NAME;
    const fileName = `models/${hash}.glb`;
    const fileUrl = `https://${bucketName}.s3.ap-northeast-2.amazonaws.com/${fileName}`;

    // -------- 1) 이미 S3에 파일이 있는지 체크 --------
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: fileName }));
      console.log("S3에서 기존 GLB 발견 → 재생성 필요 없음");

      return res.status(200).json({
        ok: true,
        glbUrl: fileUrl
      });
    } catch (err) {
      console.log("기존 GLB 없음 → Meshy 변환 시작");
    }

    // -------- 2) Meshy 변환 요청 --------
    const createRes = await fetch("https://api.meshy.ai/v1/image-to-3d", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: imageUrl,
        output_format: "glb",
        texture: true
      })
    });

    const createData = await createRes.json();
    console.log("Meshy 생성 요청 응답:", createData);

    const taskId = createData.task_id || createData.result;
    if (!taskId) {
      return res.status(500).json({ error: "Meshy task_id missing", createData });
    }

    // -------- 3) Meshy 변환 상태 폴링 --------
    let resultUrl = null;

    for (let i = 0; i < 60; i++) {
      const statusRes = await fetch(`https://api.meshy.ai/v1/image-to-3d/${taskId}`, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });
      const status = await statusRes.json();
      console.log("현재 상태:", status.status);

      if (status.status === "SUCCEEDED") {
        resultUrl = status.model_urls?.glb;
        break;
      }
      await new Promise(r => setTimeout(r, 4500));
    }

    if (!resultUrl) {
      return res.status(500).json({ error: "3D 변환 실패" });
    }

    // -------- 4) GLB 다운로드 --------
    const fileResponse = await fetch(resultUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // -------- 5) S3 업로드 --------
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: "model/gltf-binary"
      })
    );

    console.log("S3 업로드 완료:", fileUrl);

    // -------- 6) 최종 반환 --------
    return res.status(200).json({
      ok: true,
      glbUrl: fileUrl
    });

  } catch (error) {
    console.error("서버 오류:", error);
    return res.status(500).json({
      error: "서버 내부 오류",
      detail: error.message
    });
  }
}
