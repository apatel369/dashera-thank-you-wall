import { QRCodeSVG } from "qrcode.react";

export function QrScreen({ session }: { session: string }) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("session", session);
  const qrUrl = url.toString();
  return (
    <div className="qr-screen absolute inset-0 z-20 flex items-start justify-center text-center"
      style={{ background: "linear-gradient(rgba(20,10,35,.35),rgba(20,10,35,.5)), url('/diwali-night-wall-bg.png') center/cover" }}>
      <div className="qr-stage">
        <div className="qr-panel qr-panel-left">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Left QR code for ${qrUrl}`} />
          <p>SCAN TO ADD A NOTE</p>
        </div>
        <div className="qr-middle">
          <div className="qr-center">
            <img src="/diwali-sabha-artwork.png" alt="Diwali Sabha" />
            <h1>Light a diya of gratitude</h1>
            <p>Scan either code, decorate a sticky note, and add it to the wall.</p>
          </div>
        </div>
        <div className="qr-panel qr-panel-right">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Right QR code for ${qrUrl}`} />
          <p>SCAN TO ADD A NOTE</p>
        </div>
      </div>
    </div>
  );
}
