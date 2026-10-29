import { QRCodeSVG } from "qrcode.react";

export function QrScreen({ session, wifiVisible }: { session: string; wifiVisible: boolean }) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("session", session);
  const qrUrl = url.toString();
  return (
    <div className="qr-screen absolute inset-0 z-20 flex items-start justify-center text-center"
      style={{ background: "linear-gradient(rgba(64,23,19,.28),rgba(64,23,19,.42)), url('/dashera-sunset-wall-bg.png') center/cover" }}>
      <div className="qr-stage">
        <div className="qr-panel qr-panel-left">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Left QR code for ${qrUrl}`} />
          <p>SCAN TO ADD A NOTE</p>
        </div>
        <div className={`qr-middle ${wifiVisible ? "qr-middle-with-wifi" : ""}`}>
          <div className="qr-center">
            <img src="/dusshera-sabha-mythic-archer-duel.png" alt="Dusshera Sabha" />
            <h1>Burning the Ravan within</h1>
            <p>Scan either code, decorate a sticky note, and add it to the wall.</p>
          </div>
          {wifiVisible && <section className="wifi-card" aria-label="Wi-Fi network details">
            <h2>Wifi network</h2>
            <div className="wifi-detail"><span>Name</span><strong>REMOVED</strong></div>
            <div className="wifi-detail"><span>Password</span><strong>REMOVED</strong></div>
          </section>}
        </div>
        <div className="qr-panel qr-panel-right">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Right QR code for ${qrUrl}`} />
          <p>SCAN TO ADD A NOTE</p>
        </div>
      </div>
    </div>
  );
}
