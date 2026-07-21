import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/skyen-systems.png" />
      </Head>
      <body className="antialiased font-sans">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
