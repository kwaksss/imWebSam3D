export default async function handler(req, res) {
  // --- CORS 허용 (아임웹에서 호출 가능하게) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight 요청 처리 (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // --------------------------------------------------------

  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // JSON body 파싱
  let body = "";
  for await (const chunk of req) body += chunk;

  const data = JSON.parse(body || "{}");
  const imageUrl = data.imageUrl;

  console.log("이미지 URL 받음:", imageUrl);

  return res.status(200).json({
    ok: true,
    receivedImageUrl: imageUrl || null
  });
}
