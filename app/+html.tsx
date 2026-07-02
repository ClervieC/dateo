import { ScrollViewStyleReset } from 'expo-router/html'

// This file is web-only and used to configure the root HTML for every
// web page. The contents of this function only run in Node.js
// environments and do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/*
          Prevent any accidental sub-pixel/child overflow from producing a page-level
          horizontal scrollbar, while leaving intentional horizontal ScrollViews (which
          set their own overflow-x) free to scroll internally.
        */}
        <style id="dateo-web-reset" dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            overflow-x: hidden;
            max-width: 100%;
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
