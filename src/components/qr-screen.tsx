import { QRCodeSVG } from "qrcode.react";
import {
  WALL_BG,
  CENTER_ART,
  QR_HEADLINE,
  QR_BODY,
  QR_CAPTION,
} from "../lib/theme.ts";

export function QrScreen({ session }: { session: string }) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("session", session);
  const qrUrl = url.toString();
  return (
    <div
      className="qr-screen absolute inset-0 z-20 flex items-start justify-center text-center"
      style={{
        background: `linear-gradient(rgba(10, 8, 24, 0.45), rgba(10, 8, 24, 0.65)), url('${WALL_BG}') center/cover`,
      }}
    >
      <div className="qr-stage">
        <div className="qr-panel qr-panel-left">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Left QR code for ${qrUrl}`} />
          <p>{QR_CAPTION}</p>
        </div>
        <div className="qr-middle">
          <div className="qr-center">
            <img src={CENTER_ART} alt="Diwali Diya" />
            <h1>{QR_HEADLINE}</h1>
            <p>{QR_BODY}</p>
          </div>
        </div>
        <div className="qr-panel qr-panel-right">
          <QRCodeSVG value={qrUrl} size={1024} level="H" includeMargin aria-label={`Right QR code for ${qrUrl}`} />
          <p>{QR_CAPTION}</p>
        </div>
      </div>
    </div>
  );
}
