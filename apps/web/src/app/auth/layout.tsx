import "../globals.css";

/** 登录回调页（地址里不带语言，方便在 LINE 后台只登记一个回调地址） */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body><div className="wrap">{children}</div></body>
    </html>
  );
}
