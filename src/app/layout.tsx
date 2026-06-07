import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Code Assistant Portal',
  description: '在浏览器中运行的 AI 代码助手',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
