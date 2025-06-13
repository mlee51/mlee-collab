import { Geist, Geist_Mono, Doto } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata = {
  title: "drop files anywhere",
  description: "dropfilesanywhere.com",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
