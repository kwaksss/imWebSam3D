# 🧵 imWeb 2D → 3D 자동 변환 시스템  
아임웹 상품 대표 이미지를 자동으로 Meshy AI로 3D 모델(GLB)로 변환하고,  
AWS S3에 영구 캐싱하여 model-viewer로 렌더링하는 자동 파이프라인.

---

## 📸 Demo
<p align="center">
  <img src="https://github.com/user-attachments/assets/56e70453-de2b-4ee0-930e-13281e73d855" width="100%">
</p>
>실제 쇼핑몰 페이지
(https://www.papiierofficial.com/25/?idx=12)

---

## 🧩 프로젝트 소개

아임웹(Imweb)에서는 상품 이미지를 기반으로 자동으로 3D 모델을 생성하는 기능이 없다.  
또한 Vercel 서버의 메모리 캐싱은 환경이 내려가면 초기화되기 때문에  
3D 모델 생성 API(Meshy)를 매번 호출해야 한다는 비용/성능 문제가 있다.

본 프로젝트는 이를 해결하기 위해:

- 상품 이미지를 자동으로 감지하고  
- 최초 1회만 Meshy AI로 GLB 변환  
- 변환된 GLB 파일은 AWS S3에 저장하여 영구 캐싱  
- 이후 3D 모델을 즉시 로딩

하는 완전 자동화 3D 생성 파이프라인을 구축했다.

---

## ✨ 주요 기능 (Features)

- 아임웹 상품 상세페이지의 대표 이미지 자동 감지
- Meshy AI로 2D → 3D(GLB) 모델 생성
- 변환 완료까지 비동기 Polling
- AWS S3에 GLB 영구 저장
- 기존 GLB 존재 시 Meshy API 호출 없이 즉시 반환 (무료)
- model-viewer로 웹페이지 내 즉시 3D 렌더링
- 모든 과정 완전 자동화

---

## 🏗 Architecture
<p align="center">
  <img src="https://github.com/user-attachments/assets/5242bddf-59ba-4dbe-bc67-631d239eb9d1" width="100%">
</p>

---

## 🔧 기술 스택

### Backend & Infra
- Vercel Serverless Functions  
- AWS S3  
- AWS IAM  

### AI
- Meshy AI (image-to-3d)

### Frontend
- Imweb HTML + JS widget  
- `<model-viewer>` for rendering

---
## 🔧 핵심 코드 설명

### 1) 이미지 URL → SHA-256 해시 생성 (파일명 고정)

```js
const hash = crypto.createHash("sha256").update(imageUrl).digest("hex");
const glbKey = `${hash}.glb`;
```

### 2) S3에서 기존 GLB 존재 확인

```js
try {
  await s3.send(new HeadObjectCommand({ Bucket, Key: glbKey }));
  return S3 url; // Meshy 호출 없이 즉시 끝
} catch (e) {
  // 존재하지 않으면 Meshy로 생성
}
```

### 3) Meshy 변환 요청 → 상태 Polling
```js
const meshyResponse = await fetch("https://api.meshy.ai/v1/image-to-3d", {...})

for (...) {
   const status = await fetch(...)
   if (status.status === "SUCCEEDED") break;
}
```

### 4) GLB 다운로드 후 S3 업로드
```js
await s3.send(new PutObjectCommand({
  Bucket,
  Key: glbKey,
  Body: glbBuffer,
  ContentType: "model/gltf-binary"
}));
```

