export default async function handler(req, res) {
  const method = req.method;
  if (method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // JSON body 파싱
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  const data = JSON.parse(body || "{}");

  const imageUrl = data.imageUrl;

  console.log("이미지 URL 받음:", imageUrl);

  return res.status(200).json({
    ok: true,
    receivedImageUrl: imageUrl || null
  });
}
