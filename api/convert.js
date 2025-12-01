// api/convert.js

export const runtime = "nodejs";

// Meshy API 호출을 위한 fetch (Node18 기본 fetch 사용)
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

  try {
    // Body 읽기
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body || "{}");

    const imageUrl = data.imageUrl;
    console.log("받은 이미지 URL:", imageUrl);

    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl missing" });
    }

    // Meshy API Key
    const API_KEY = process.env.MESHY_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Meshy API Key missing" });
    }

    // 1) Meshy 3D 생성 API 호출
    const meshyResponse = await fetch("https://api.meshy.ai/v1/image-to-3d", {
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

    const meshyData = await meshyResponse.json();
    console.log("Meshy 응답:", meshyData);

    // 작업 ID(task_id)
    const taskId = meshyData.task_id;

    if (!taskId) {
      return res.status(500).json({ error: "Meshy task_id missing", meshyData });
    }

    // Meshy 처리 완료까지 폴링
    let resultUrl = null;

    for (let i = 0; i < 20; i++) {   // 최대 60초(20 × 3초)
      const check = await fetch(
        `https://api.meshy.ai/v1/image-to-3d/${taskId}`,
        {
          headers: {
            "Authorization": `Bearer ${API_KEY}`
          }
        }
      );

      const status = await check.json();
      console.log("현재 변환 상태:", status.status);

      if (status.status === "SUCCEEDED") {
        resultUrl = status.result.glb;
        break;
      }

      await new Promise(r => setTimeout(r, 3000));  // 3초 대기
    }

    if (!resultUrl) {
      return res.status(500).json({ error: "3D 변환 실패" });
    }

    // 최종 GLB URL 반환
    return res.status(200).json({
      ok: true,
      glbUrl: resultUrl
    });

  } catch (error) {
    console.error("서버 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류", detail: error.message });
  }
}
