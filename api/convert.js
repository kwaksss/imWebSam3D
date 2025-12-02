export const runtime = "nodejs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body || "{}");

    const imageUrl = data.imageUrl;
    if (!imageUrl) return res.status(400).json({ error: "imageUrl missing" });

    const API_KEY = process.env.MESHY_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "Meshy API Key missing" });

    // 1) 생성 요청
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

    const taskId = meshyData.task_id || meshyData.result;
    if (!taskId) {
      return res.status(500).json({ error: "Meshy task_id missing", meshyData });
    }

    // 2) 처리 완료까지 폴링
    let resultUrl = null;

    for (let i = 0; i < 60; i++) { // 3분 기다리기
      const check = await fetch(
        `https://api.meshy.ai/v1/image-to-3d/${taskId}`,
        {
          headers: { "Authorization": `Bearer ${API_KEY}` }
        }
      );

      const status = await check.json();
      console.log("전체 상태 응답:", JSON.stringify(status, null, 2));
      console.log("현재 변환 상태:", status.status);

      if (status.status === "SUCCEEDED") {
        if (status.model_urls && status.model_urls.glb) {
        resultUrl = status.model_urls.glb;
        }
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

  } catch (error) {
    console.error("서버 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류", detail: error.message });
  }
}
