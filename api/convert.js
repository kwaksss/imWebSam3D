export const runtime = "nodejs";

// Meshy API 호출
export default async function handler(req, res) {
  // CORS 허용
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
    // 1) Body 수신
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyString = Buffer.concat(chunks).toString();

    const data = JSON.parse(bodyString || "{}");
    const imageUrl = data.imageUrl;

    console.log("받은 이미지 URL:", imageUrl);

    if (!imageUrl) {
      return res.status(400).json({ error: "No imageUrl provided" });
    }

    // 2) API 키
    const API_KEY = process.env.MESHY_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Meshy API Key missing" });
    }

    // 3) Meshy 3D 요청
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

    if (!meshyData.task_id) {
      return res.status(500).json({ error: "Meshy task_id missing", meshyData });
    }

    const taskId = meshyData.task_id;

    // 4) Polling
    let resultUrl = null;

    for (let i = 0; i < 20; i++) {
      const checkRes = await fetch(`https://api.meshy.ai/v1/image-to-3d/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        }
      });

      const status = await checkRes.json();
      console.log("변환 상태:", status.status);

      if (status.status === "SUCCEEDED") {
        resultUrl = status.result.glb;
        break;
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    if (!resultUrl) {
      return res.status(500).json({ error: "3D 변환 실패" });
    }

    return res.status(200).json({
      ok: true,
      glbUrl: resultUrl
    });

  } catch (err) {
    console.error("서버 오류:", err);
    return res.status(500).json({ error: "서버 내부 오류", detail: err.message });
  }
}
