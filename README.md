# FRP Oyun Sistemi

Bu proje, arkadaşlarınızla birlikte oynayabileceğiniz gerçek zamanlı bir Fantastik Rol Yapma (FRP) oyun sistemidir.

## Özellikler

- Gerçek zamanlı çok oyunculu oyun deneyimi
- Oyuncu adı ve karakter özelleştirme
- Entegre zar sistemi (d4, d6, d8, d10, d12, d20)
- Kullanıcı dostu arayüz

## Kurulum

1. Projeyi klonlayın:
```bash
git clone [repo-url]
cd frp-game
```

2. Backend bağımlılıklarını yükleyin:
```bash
npm install
```

3. Frontend bağımlılıklarını yükleyin:
```bash
cd client
npm install
```

## Çalıştırma

1. Backend sunucusunu başlatın:
```bash
npm run dev
```

2. Yeni bir terminal açın ve frontend uygulamasını başlatın:
```bash
cd client
npm start
```

3. Tarayıcınızda `http://localhost:3000` adresine gidin

## Teknolojiler

- Frontend: React.js, Material-UI
- Backend: Node.js, Express
- Gerçek zamanlı iletişim: Socket.IO 