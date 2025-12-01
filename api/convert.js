export const runtime = "nodejs";

// Tripo AI 2D → 3D API (async polling 방식)
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
    // 1) Body 읽기
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyString = Buffer.concat(chunks).toString();

    const data = JSON.parse(bodyString || "{}");
    const imageUrl = data.imageUrl;

    console.log("받은 이미지 URL:", imageUrl);

    if (!imageUrl) {
      return res.status(400).json({ error: "No imageUrl provided" });
    }

    const API_KEY = process.env.TRIPO_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "TRIPO API Key missing" });
    }

    // 2) Tripo AI: 이미지 → 3D 생성 요청
    const createRes = await fetch("https://api.tripo.ai/v1/image-to-3d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({
        image_url: imageUrl,
        format: "glb"
      })
    });

    const createData = await createRes.json();
    console.log("Tripo 생성 요청 응답:", createData);

    const taskId = createData.task_id;
    if (!taskId) {
      return res.status(500).json({ error: "Failed to create task", createData });
    }

    // 3) Polling: 결과 나올 때까지 조회
    let glbUrl = null;

    for (let i = 0; i < 20; i++) { // 최대 20번(약 60초)
      await new Promise(r => setTimeout(r, 3000)); // 3초 대기

      const statusRes = await fetch(`https://api.tripo.ai/v1/tasks/${taskId}`, {
        headers: { "x-api-key": API_KEY }
      });

      const statusData = await statusRes.json();
      console.log("Tripo 상태:", statusData);

      if (statusData.status === "success") {
        glbUrl = statusData.output?.model_url;
        break;
      }
    }

    if (!glbUrl) {
      return res.status(500).json({ error: "3D 변환 실패" });
    }

    return res.status(200).json({
      ok: true,
      glbUrl
    });

  } catch (err) {
    console.error("서버 오류:", err);
    return res.status(500).json({ error: "서버 내부 오류", detail: err.message });
  }
}
