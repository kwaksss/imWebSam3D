// api/convert.js

// Meshy API 호출을 위한 fetch
import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- CORS 허용 (아임웹에서 호출 가능) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // 1) JSON body 읽기
  let body = "";
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body || "{}");
  const imageUrl = data.imageUrl;

  console.log("받은 이미지 URL:", imageUrl);

  // 2) Meshy API 키 가져오기
  const API_KEY = process.env.MESHY_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "Meshy API Key missing" });
  }

  // 3) Meshy 3D 생성 API 호출
  const meshyResponse = await fetch(
    "https://api.meshy.ai/v1/image-to-3d", 
    {
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
    }
  );

  const meshyData = await meshyResponse.json();
  console.log("Meshy 응답:", meshyData);

  // 4) Meshy 응답에서 task_id 받기
  const taskId = meshyData.task_id;

  // 5) 작업 완료될 때까지 폴링(polling)
  let resultUrl = null;

  for (let i = 0; i < 20; i++) {  
    const check = await fetch(
      `https://api.meshy.ai/v1/image-to-3d/${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        }
      }
    );

    const status = await check.json();
    console.log("현재 변환 상태:", status.status);

    if (status.status === "SUCCEEDED") {
      resultUrl = status.result.glb;
      break;
    }

    await new Promise(r => setTimeout(r, 3000)); // 3초 대기
  }

  if (!resultUrl) {
    return res.status(500).json({ error: "3D 변환 실패" });
  }

  return res.status(200).json({
    ok: true,
    glbUrl: resultUrl
  });
}
