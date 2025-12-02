export const runtime = "nodejs";

export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Missing glb url" });
    }

    // --- Meshy GLB 파일 다운로드 ---
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({
        error: "Failed to fetch GLB from Meshy",
        status: response.status
      });
    }

    // --- GLB 바이너리로 받기 ---
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- CORS 허용 ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // --- GLB 콘텐츠 타입 ---
    res.setHeader("Content-Type", "model/gltf-binary");

    // --- 브라우저로 전송 ---
    res.send(buffer);

  } catch (err) {
    console.error("Proxy Error:", err);
    res.status(500).json({
      error: "Proxy error",
      detail: err.message
    });
  }
}
