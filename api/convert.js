export const runtime = "nodejs";

// ---- 간단한 메모리 캐시 ----
const cache = {};  
// 구조 예: { "https://image-url.jpg": "/api/proxy-glb?url=...." }

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

    // ------------------------------------
    // 0) 캐시 확인 (이미 생성한 GLB가 있다면 즉시 반환)
    // ------------------------------------
    if (cache[imageUrl]) {
      console.log("📦 캐시된 GLB 반환:", cache[imageUrl]);
      return res.status(200).json({
        ok: true,
        glbUrl: cache[imageUrl]
      });
    }

    // ------------------------------------
    // 1) Meshy 생성 요청
    // ------------------------------------
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

    // ------------------------------------
    // 2) 변환 상태 폴링(완료될 때까지 대기)
    // ------------------------------------
    let resultUrl = null;

    for (let i = 0; i < 60; i++) { // 최대 3분
      const check = await fetch(`https://api.meshy.ai/v1/image-to-3d/${taskId}`, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });

      const status = await check.json();
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

    // Vercel 프록시 GLB 주소
    const finalUrl = `/api/proxy-glb?url=${encodeURIComponent(resultUrl)}`;

    // ------------------------------------
    // 3) 캐시에 저장
    // ------------------------------------
    cache[imageUrl] = finalUrl;
    console.log("💾 캐시에 저장됨!");

    // ------------------------------------
    // 4) 최종 반환
    // ------------------------------------
    return res.status(200).json({
      ok: true,
      glbUrl: finalUrl
    });

  } catch (error) {
    console.error("서버 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류", detail: error.message });
  }
}
